//! Integration tests against a live RomM server.
//! Run with: cargo test --test romm_integration -- --ignored --nocapture

#[cfg(test)]
mod romm_live_tests {
    fn load_env() -> (String, String, String) {
        dotenvy::from_filename("../.env").ok();
        let url = std::env::var("ROMM_SERVER_URL").expect("ROMM_SERVER_URL not set");
        let user = std::env::var("ROMM_USERNAME").expect("ROMM_USERNAME not set");
        let pass = std::env::var("ROMM_PASSWORD").expect("ROMM_PASSWORD not set");
        (url, user, pass)
    }

    fn make_client() -> reqwest::Client {
        reqwest::Client::builder()
            .cookie_store(true)
            .build()
            .unwrap()
    }

    async fn authenticate(client: &reqwest::Client, url: &str, user: &str, pass: &str) -> String {
        let resp = client
            .post(format!("{}/api/token", url))
            .form(&[
                ("username", user),
                ("password", pass),
                ("grant_type", "password"),
                (
                    "scope",
                    "me.read me.write roms.read platforms.read roms.user.read roms.user.write",
                ),
            ])
            .send()
            .await
            .expect("Failed to connect");
        assert!(resp.status().is_success(), "Auth failed: {}", resp.status());
        let body: serde_json::Value = resp.json().await.unwrap();
        body["access_token"].as_str().unwrap().to_string()
    }

    // --- Auth ---

    #[tokio::test]
    #[ignore]
    async fn auth_returns_valid_jwt_with_scopes() {
        let (url, user, pass) = load_env();
        let client = make_client();
        let token = authenticate(&client, &url, &user, &pass).await;

        let parts: Vec<&str> = token.split('.').collect();
        assert_eq!(parts.len(), 3, "JWT should have 3 parts");
        let payload: serde_json::Value = serde_json::from_slice(&base64_decode(parts[1])).unwrap();
        let scopes = payload["scopes"].as_str().unwrap_or("");
        assert!(scopes.contains("roms.read"), "Missing roms.read scope");
        assert!(
            scopes.contains("platforms.read"),
            "Missing platforms.read scope"
        );
        println!("JWT OK: sub={}, scopes={}", payload["sub"], scopes);
    }

    #[tokio::test]
    #[ignore]
    async fn auth_bad_password_rejected() {
        let (url, user, _) = load_env();
        let client = make_client();
        let resp = client
            .post(format!("{}/api/token", url))
            .form(&[("username", user.as_str()), ("password", "wrong")])
            .send()
            .await
            .unwrap();
        assert!(!resp.status().is_success());
        println!("Bad password correctly rejected: {}", resp.status());
    }

    #[tokio::test]
    #[ignore]
    async fn heartbeat_returns_version() {
        let (url, _, _) = load_env();
        let client = make_client();
        let body: serde_json::Value = client
            .get(format!("{}/api/heartbeat", url))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        let version = body["SYSTEM"]["VERSION"].as_str().unwrap_or("?");
        assert!(!version.is_empty());
        println!("RomM v{}", version);
    }

    // --- Platforms ---

    #[tokio::test]
    #[ignore]
    async fn fetch_platforms_with_schema_validation() {
        let (url, user, pass) = load_env();
        let client = make_client();
        let token = authenticate(&client, &url, &user, &pass).await;

        let platforms: Vec<serde_json::Value> = client
            .get(format!("{}/api/platforms", url))
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();

        assert!(!platforms.is_empty(), "No platforms");
        for p in &platforms {
            assert!(p["id"].is_number(), "Missing 'id'");
            assert!(p["slug"].is_string(), "Missing 'slug'");
            assert!(p["name"].is_string(), "Missing 'name'");
            assert!(p["rom_count"].is_number(), "Missing 'rom_count'");
        }
        println!("{} platforms validated", platforms.len());
    }

    // --- ROMs deserialization (the test that would have caught the parse failure) ---

    #[tokio::test]
    #[ignore]
    async fn roms_deserialize_via_manual_extraction() {
        let (url, user, pass) = load_env();
        let client = make_client();
        let token = authenticate(&client, &url, &user, &pass).await;

        let resp = client
            .get(format!("{}/api/roms", url))
            .query(&[("limit", "20"), ("offset", "0")])
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await
            .unwrap();

        assert!(resp.status().is_success());
        let text = resp.text().await.unwrap();
        let raw: serde_json::Value = serde_json::from_str(&text).unwrap();

        let items = raw["items"].as_array().expect("Missing items array");
        assert!(!items.is_empty(), "No ROMs returned");

        let mut parsed_count = 0;
        let mut skipped_count = 0;

        for v in items {
            let id = match v["id"].as_i64() {
                Some(id) => id as i32,
                None => {
                    skipped_count += 1;
                    continue;
                }
            };

            let name = v["name"].as_str().unwrap_or("").to_string();
            let _fs_name = v["fs_name"]
                .as_str()
                .or_else(|| v["file_name"].as_str())
                .unwrap_or("")
                .to_string();
            let platform_slug = v["platform_slug"].as_str().unwrap_or("").to_string();
            let url_cover = v["url_cover"].as_str().map(|s| s.to_string());
            let igdb_id = v["igdb_id"].as_i64().map(|x| x as i32);

            assert!(id > 0, "ROM id should be positive");
            assert!(
                !platform_slug.is_empty(),
                "ROM {} missing platform_slug",
                id
            );

            // Verify igdb_metadata parses without panic
            if let Some(meta) = v.get("igdb_metadata") {
                if meta.is_object() && !meta.as_object().unwrap().is_empty() {
                    let _genres: Option<Vec<String>> = meta
                        .get("genres")
                        .and_then(|g| serde_json::from_value(g.clone()).ok());
                    let _release: Option<i64> =
                        meta.get("first_release_date").and_then(|d| d.as_i64());
                    let _rating: Option<f64> =
                        meta.get("aggregated_rating").and_then(|r| r.as_f64());
                }
            }

            parsed_count += 1;
            println!(
                "  [{}] {} ({}) cover={} igdb={:?}",
                id,
                name,
                platform_slug,
                url_cover.is_some(),
                igdb_id
            );
        }

        println!("\nParsed: {}, Skipped: {}", parsed_count, skipped_count);
        assert!(parsed_count > 0, "No ROMs successfully parsed");
        assert_eq!(skipped_count, 0, "Some ROMs failed to parse");
    }

    // --- Cover art ---

    #[tokio::test]
    #[ignore]
    async fn cover_art_downloadable() {
        let (url, user, pass) = load_env();
        let client = make_client();
        let token = authenticate(&client, &url, &user, &pass).await;

        let resp: serde_json::Value = client
            .get(format!("{}/api/roms", url))
            .query(&[("limit", "20"), ("offset", "0")])
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();

        let items = resp["items"].as_array().unwrap();
        let with_cover = items.iter().find(|r| r["url_cover"].is_string());

        match with_cover {
            Some(rom) => {
                let cover_url = rom["url_cover"].as_str().unwrap();
                let cover_resp = reqwest::get(cover_url).await.unwrap();
                assert!(cover_resp.status().is_success(), "Cover download failed");
                let bytes = cover_resp.bytes().await.unwrap();
                assert!(bytes.len() > 100, "Cover too small: {} bytes", bytes.len());
                println!("Cover OK: {} bytes", bytes.len());
            }
            None => println!("SKIP: No ROMs with covers"),
        }
    }

    // --- Full sync with performance assertion ---

    #[tokio::test]
    #[ignore]
    async fn full_sync_completes_within_timeout() {
        let (url, user, pass) = load_env();
        let client = make_client();

        let start = std::time::Instant::now();
        let token = authenticate(&client, &url, &user, &pass).await;

        let mut all_rom_ids = std::collections::HashSet::new();
        let mut total_covers = 0u64;
        let mut total_with_metadata = 0u64;
        let mut offset = 0;

        loop {
            let resp: serde_json::Value = client
                .get(format!("{}/api/roms", url))
                .query(&[("limit", "100"), ("offset", &offset.to_string())])
                .header("Authorization", format!("Bearer {}", token))
                .send()
                .await
                .unwrap()
                .json()
                .await
                .unwrap();

            let items = resp["items"].as_array().unwrap();
            let total = resp["total"].as_i64().unwrap_or(0);

            if items.is_empty() {
                break;
            }

            for rom in items {
                let id = rom["id"].as_i64().unwrap_or(0);
                if !all_rom_ids.insert(id) {
                    continue;
                }

                if rom["url_cover"].is_string() {
                    total_covers += 1;
                }
                if rom["igdb_id"].is_number() {
                    total_with_metadata += 1;
                }
            }

            offset += items.len();
            if offset as i64 >= total {
                break;
            }
        }

        let elapsed = start.elapsed();

        println!("Sync completed in {:.1}s", elapsed.as_secs_f64());
        println!("  Unique ROMs: {}", all_rom_ids.len());
        println!("  With covers: {}", total_covers);
        println!("  With IGDB metadata: {}", total_with_metadata);

        assert!(!all_rom_ids.is_empty(), "No ROMs synced");
        assert!(
            elapsed.as_secs() < 60,
            "Sync took {}s, should complete within 60s (no cover downloads)",
            elapsed.as_secs()
        );
        println!("Performance OK: {:.1}s < 60s limit", elapsed.as_secs_f64());
    }

    fn base64_decode(input: &str) -> Vec<u8> {
        let padded = match input.len() % 4 {
            2 => format!("{}==", input),
            3 => format!("{}=", input),
            _ => input.to_string(),
        };
        let padded = padded.replace('-', "+").replace('_', "/");
        fn decode_group(chars: &[u8]) -> Vec<u8> {
            let table = |c: u8| -> u8 {
                match c {
                    b'A'..=b'Z' => c - b'A',
                    b'a'..=b'z' => c - b'a' + 26,
                    b'0'..=b'9' => c - b'0' + 52,
                    b'+' => 62,
                    b'/' => 63,
                    _ => 0,
                }
            };
            let mut out = Vec::new();
            if chars.len() >= 2 {
                out.push((table(chars[0]) << 2) | (table(chars[1]) >> 4));
            }
            if chars.len() >= 3 && chars[2] != b'=' {
                out.push((table(chars[1]) << 4) | (table(chars[2]) >> 2));
            }
            if chars.len() >= 4 && chars[3] != b'=' {
                out.push((table(chars[2]) << 6) | table(chars[3]));
            }
            out
        }
        padded.as_bytes().chunks(4).flat_map(decode_group).collect()
    }
}

/// Unit test for ROM JSON extraction — uses fixture data, no network needed.
#[cfg(test)]
mod rom_parsing_tests {
    #[test]
    fn parses_rom_with_full_metadata() {
        let json = serde_json::json!({
            "id": 126,
            "platform_id": 18,
            "platform_slug": "ps2",
            "name": "Ben 10 Alien Force",
            "fs_name": "Ben 10 - Alien Force",
            "fs_size_bytes": 4698210304_i64,
            "igdb_id": 2802,
            "summary": "A fighting game",
            "url_cover": "https://cdn.example.com/cover.jpg",
            "igdb_metadata": {
                "genres": ["Fighting", "Adventure"],
                "first_release_date": 1256601600_i64,
                "aggregated_rating": 62.5,
                "total_rating": 65.0
            }
        });

        let id = json["id"].as_i64().unwrap() as i32;
        let name = json["name"].as_str().unwrap_or("");
        let platform_slug = json["platform_slug"].as_str().unwrap_or("");
        let fs_name = json["fs_name"].as_str().unwrap_or("");
        let url_cover = json["url_cover"].as_str();
        let igdb_id = json["igdb_id"].as_i64().map(|x| x as i32);

        assert_eq!(id, 126);
        assert_eq!(name, "Ben 10 Alien Force");
        assert_eq!(platform_slug, "ps2");
        assert_eq!(fs_name, "Ben 10 - Alien Force");
        assert!(url_cover.is_some());
        assert_eq!(igdb_id, Some(2802));

        let meta = json.get("igdb_metadata").unwrap();
        let genres: Vec<String> = serde_json::from_value(meta["genres"].clone()).unwrap();
        assert_eq!(genres, vec!["Fighting", "Adventure"]);
        assert_eq!(meta["first_release_date"].as_i64(), Some(1256601600));
        assert_eq!(meta["aggregated_rating"].as_f64(), Some(62.5));
    }

    #[test]
    fn parses_rom_with_null_fields() {
        let json = serde_json::json!({
            "id": 134,
            "platform_id": 19,
            "platform_slug": "psp",
            "name": ".keep",
            "fs_name": ".keep",
            "fs_size_bytes": 0,
            "igdb_id": null,
            "summary": null,
            "url_cover": null,
            "igdb_metadata": {}
        });

        let id = json["id"].as_i64().unwrap() as i32;
        let name = json["name"].as_str().unwrap_or("");
        let igdb_id = json["igdb_id"].as_i64().map(|x| x as i32);
        let url_cover = json["url_cover"].as_str();
        let summary = json["summary"].as_str();

        assert_eq!(id, 134);
        assert_eq!(name, ".keep");
        assert_eq!(igdb_id, None);
        assert_eq!(url_cover, None);
        assert_eq!(summary, None);

        let meta = json.get("igdb_metadata").unwrap();
        assert!(meta.is_object());
        assert!(
            meta.as_object().unwrap().is_empty()
                || meta.get("genres").and_then(|g| g.as_array()).is_none()
        );
    }

    #[test]
    fn parses_rom_with_missing_optional_fields() {
        let json = serde_json::json!({
            "id": 200,
            "platform_id": 15,
            "platform_slug": "gba",
            "name": "Pokemon Emerald",
            "fs_name": "Pokemon Emerald.gba",
            "fs_size_bytes": 16777216
        });

        let id = json["id"].as_i64().unwrap() as i32;
        let name = json["name"].as_str().unwrap_or("");
        let igdb_id = json["igdb_id"].as_i64().map(|x| x as i32);
        let url_cover = json["url_cover"].as_str();
        let igdb_metadata = json.get("igdb_metadata");

        assert_eq!(id, 200);
        assert_eq!(name, "Pokemon Emerald");
        assert_eq!(igdb_id, None);
        assert_eq!(url_cover, None);
        assert!(igdb_metadata.is_none());
    }

    #[test]
    fn parses_paginated_response() {
        let json = serde_json::json!({
            "items": [
                {"id": 1, "platform_slug": "snes", "name": "Game 1", "fs_name": "game1.sfc", "fs_size_bytes": 1024},
                {"id": 2, "platform_slug": "gba", "name": "Game 2", "fs_name": "game2.gba", "fs_size_bytes": 2048}
            ],
            "total": 55
        });

        let total = json["total"].as_i64().unwrap();
        let items = json["items"].as_array().unwrap();

        assert_eq!(total, 55);
        assert_eq!(items.len(), 2);
        assert_eq!(items[0]["name"].as_str().unwrap(), "Game 1");
        assert_eq!(items[1]["platform_slug"].as_str().unwrap(), "gba");
    }
}
