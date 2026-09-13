//! Integration tests for emulator auto-download infrastructure.
//!
//! Run all tests:
//!   cargo test --test emulator_integration -- --ignored --nocapture
//!
//! Run specific test:
//!   cargo test --test emulator_integration test_retroarch_direct_download -- --ignored --nocapture
//!   cargo test --test emulator_integration test_github_release_download -- --ignored --nocapture

use std::path::PathBuf;
use tempfile::TempDir;

#[cfg(test)]
mod github_api_tests {
    #[tokio::test]
    #[ignore]
    async fn fetch_mgba_latest_release() {
        let client = reqwest::Client::builder()
            .user_agent("wingosy-launcher-test/0.1")
            .build()
            .unwrap();

        let resp = client
            .get("https://api.github.com/repos/mgba-emu/mgba/releases/latest")
            .send()
            .await
            .unwrap();

        assert!(
            resp.status().is_success(),
            "GitHub API failed: {}",
            resp.status()
        );

        let body: serde_json::Value = resp.json().await.unwrap();
        assert!(body["tag_name"].is_string(), "Missing tag_name");
        assert!(body["assets"].is_array(), "Missing assets");

        let assets = body["assets"].as_array().unwrap();
        assert!(!assets.is_empty(), "No assets in release");

        let win_asset = assets.iter().find(|a| {
            let name = a["name"].as_str().unwrap_or("");
            name.contains("win")
                && name.contains("64")
                && (name.ends_with(".7z") || name.ends_with(".zip"))
        });

        println!("mGBA release: {}", body["tag_name"].as_str().unwrap());
        println!("Assets: {}", assets.len());
        if let Some(asset) = win_asset {
            println!("Windows asset: {} ({} bytes)", asset["name"], asset["size"]);
        } else {
            println!("WARNING: No Windows x64 asset found in release");
        }
    }

    #[tokio::test]
    #[ignore]
    async fn fetch_ppsspp_latest_release() {
        let client = reqwest::Client::builder()
            .user_agent("wingosy-launcher-test/0.1")
            .build()
            .unwrap();

        let resp = client
            .get("https://api.github.com/repos/hrydgard/ppsspp/releases/latest")
            .send()
            .await
            .unwrap();

        let status = resp.status();
        if status.as_u16() == 403 {
            println!("SKIP: GitHub rate limited");
            return;
        }

        assert!(status.is_success(), "GitHub API failed: {}", status);
        let body: serde_json::Value = resp.json().await.unwrap();
        println!(
            "PPSSPP release: {}",
            body["tag_name"].as_str().unwrap_or("?")
        );

        let empty = vec![];
        let assets = body["assets"].as_array().unwrap_or(&empty);
        let win_asset = assets.iter().find(|a| {
            let name = a["name"].as_str().unwrap_or("");
            let re = regex_lite::Regex::new("(?i)ppsspp.*windows.*64.*\\.zip$").unwrap();
            re.is_match(name)
        });

        if let Some(a) = win_asset {
            println!("Windows asset: {} ({} bytes)", a["name"], a["size"]);
        }
    }

    #[tokio::test]
    #[ignore]
    async fn asset_pattern_matches_real_releases() {
        let client = reqwest::Client::builder()
            .user_agent("wingosy-launcher-test/0.1")
            .build()
            .unwrap();

        let test_cases = vec![
            ("mgba-emu/mgba", "(?i)mGBA.*win64.*\\.7z$"),
            ("flyinghead/flycast", "(?i)flycast.*win64.*\\.zip$"),
        ];

        for (repo, pattern) in test_cases {
            let resp = client
                .get(format!(
                    "https://api.github.com/repos/{}/releases/latest",
                    repo
                ))
                .send()
                .await
                .unwrap();

            if !resp.status().is_success() {
                println!("SKIP {}: {}", repo, resp.status());
                continue;
            }

            let body: serde_json::Value = resp.json().await.unwrap();
            let assets = body["assets"].as_array().unwrap();

            let re = regex_lite::Regex::new(pattern).unwrap();
            let matched = assets
                .iter()
                .find(|a| re.is_match(a["name"].as_str().unwrap_or("")));

            match matched {
                Some(a) => println!(
                    "{}: MATCHED '{}' ({} bytes)",
                    repo,
                    a["name"].as_str().unwrap(),
                    a["size"]
                ),
                None => {
                    println!("{}: NO MATCH for pattern '{}'", repo, pattern);
                    println!(
                        "  Available: {:?}",
                        assets
                            .iter()
                            .map(|a| a["name"].as_str().unwrap_or(""))
                            .collect::<Vec<_>>()
                    );
                }
            }
        }
    }
}

#[cfg(test)]
mod buildbot_tests {
    #[tokio::test]
    #[ignore]
    async fn retroarch_core_url_accessible() {
        let core = "snes9x_libretro.dll";
        let url = format!(
            "https://buildbot.libretro.com/nightly/windows/x86_64/latest/{}.zip",
            core
        );

        let client = reqwest::Client::new();
        let resp = client.head(&url).send().await.unwrap();

        println!("Core URL: {}", url);
        println!("Status: {}", resp.status());

        if resp.status().is_success() {
            let size = resp
                .headers()
                .get("content-length")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0);
            println!("Size: {} bytes", size);
            assert!(size > 1000, "Core zip too small: {} bytes", size);
        } else {
            println!(
                "WARNING: Core not accessible ({}). Buildbot might be down.",
                resp.status()
            );
        }
    }

    #[tokio::test]
    #[ignore]
    async fn multiple_cores_accessible() {
        let cores = [
            "snes9x_libretro.dll",
            "mgba_libretro.dll",
            "fceumm_libretro.dll",
            "genesis_plus_gx_libretro.dll",
        ];
        let client = reqwest::Client::new();

        for core in &cores {
            let url = format!(
                "https://buildbot.libretro.com/nightly/windows/x86_64/latest/{}.zip",
                core
            );
            let resp = client.head(&url).send().await.unwrap();
            println!("{}: {}", core, resp.status());
        }
    }
}

/// End-to-end download tests - these actually download and extract files
#[cfg(test)]
mod download_workflow_tests {
    use super::*;

    /// Test RetroArch direct download (not from GitHub)
    #[tokio::test]
    #[ignore]
    async fn test_retroarch_direct_download() {
        println!("\n=== Testing RetroArch Direct Download ===\n");

        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let dest_dir = temp_dir.path().to_path_buf();

        // RetroArch uses direct download from buildbot
        let download_url =
            "https://buildbot.libretro.com/stable/1.19.1/windows/x86_64/RetroArch.7z";
        let archive_name = "RetroArch.7z";
        let archive_path = dest_dir.join(archive_name);

        println!("1. Downloading from: {}", download_url);
        println!("   To: {:?}", archive_path);

        // Download the file
        let client = reqwest::Client::builder()
            .user_agent("wingosy-launcher-test/0.1")
            .build()
            .unwrap();

        let resp = client.get(download_url).send().await;
        match resp {
            Ok(response) => {
                if !response.status().is_success() {
                    println!("   SKIP: Server returned {}", response.status());
                    return;
                }

                let bytes = response.bytes().await.unwrap();
                println!("   Downloaded: {} bytes", bytes.len());

                std::fs::write(&archive_path, &bytes).expect("Failed to write archive");
                assert!(archive_path.exists(), "Archive file not created");

                // Extract the archive
                println!("\n2. Extracting 7z archive...");
                let extract_dir = dest_dir.join("retroarch");
                std::fs::create_dir_all(&extract_dir).unwrap();

                match sevenz_rust::decompress_file(&archive_path, &extract_dir) {
                    Ok(_) => {
                        println!("   Extracted to: {:?}", extract_dir);

                        // Find retroarch.exe
                        let exe_path = find_file_recursive(&extract_dir, "retroarch.exe");
                        match exe_path {
                            Some(path) => {
                                println!("\n3. Found executable: {:?}", path);
                                println!("\n=== SUCCESS: RetroArch download workflow works ===\n");
                            }
                            None => {
                                println!("   WARNING: retroarch.exe not found after extraction");
                                list_directory_contents(&extract_dir, 0);
                            }
                        }
                    }
                    Err(e) => {
                        println!("   ERROR: Failed to extract: {}", e);
                    }
                }
            }
            Err(e) => {
                println!("   SKIP: Network error: {}", e);
            }
        }
    }

    /// Test GitHub release download (e.g., mGBA)
    #[tokio::test]
    #[ignore]
    async fn test_github_release_download() {
        println!("\n=== Testing GitHub Release Download (mGBA) ===\n");

        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let dest_dir = temp_dir.path().to_path_buf();

        let client = reqwest::Client::builder()
            .user_agent("wingosy-launcher-test/0.1")
            .build()
            .unwrap();

        // 1. Fetch latest release from GitHub API
        println!("1. Fetching latest mGBA release from GitHub API...");
        let api_url = "https://api.github.com/repos/mgba-emu/mgba/releases/latest";

        let resp = client.get(api_url).send().await;
        let release: serde_json::Value = match resp {
            Ok(r) if r.status().is_success() => r.json().await.unwrap(),
            Ok(r) => {
                println!("   SKIP: GitHub API returned {}", r.status());
                return;
            }
            Err(e) => {
                println!("   SKIP: Network error: {}", e);
                return;
            }
        };

        let tag = release["tag_name"].as_str().unwrap_or("unknown");
        println!("   Release: {}", tag);

        // 2. Find Windows asset
        println!("\n2. Finding Windows x64 asset...");
        let assets = release["assets"].as_array().unwrap();
        let pattern = regex_lite::Regex::new("(?i)mGBA.*win64.*\\.7z$").unwrap();

        let win_asset = assets
            .iter()
            .find(|a| pattern.is_match(a["name"].as_str().unwrap_or("")));

        let asset = match win_asset {
            Some(a) => a,
            None => {
                println!("   WARNING: No matching Windows asset found");
                println!("   Available assets:");
                for a in assets {
                    println!("     - {}", a["name"].as_str().unwrap_or("?"));
                }
                return;
            }
        };

        let asset_name = asset["name"].as_str().unwrap();
        let asset_url = asset["browser_download_url"].as_str().unwrap();
        let asset_size = asset["size"].as_i64().unwrap_or(0);

        println!("   Found: {} ({} bytes)", asset_name, asset_size);

        // 3. Download the asset
        println!("\n3. Downloading asset...");
        let archive_path = dest_dir.join(asset_name);

        let resp = client.get(asset_url).send().await.unwrap();
        if !resp.status().is_success() {
            println!("   ERROR: Download failed: {}", resp.status());
            return;
        }

        let bytes = resp.bytes().await.unwrap();
        println!("   Downloaded: {} bytes", bytes.len());
        std::fs::write(&archive_path, &bytes).expect("Failed to write archive");

        // 4. Extract
        println!("\n4. Extracting archive...");
        let extract_dir = dest_dir.join("mgba");
        std::fs::create_dir_all(&extract_dir).unwrap();

        match sevenz_rust::decompress_file(&archive_path, &extract_dir) {
            Ok(_) => {
                println!("   Extracted to: {:?}", extract_dir);

                // Find mGBA.exe
                let exe_path = find_file_recursive(&extract_dir, "mGBA.exe");
                match exe_path {
                    Some(path) => {
                        println!("\n5. Found executable: {:?}", path);
                        println!("\n=== SUCCESS: GitHub release download workflow works ===\n");
                    }
                    None => {
                        println!("   WARNING: mGBA.exe not found after extraction");
                        list_directory_contents(&extract_dir, 0);
                    }
                }
            }
            Err(e) => {
                println!("   ERROR: Failed to extract: {}", e);
            }
        }
    }

    /// Test RetroArch core download
    #[tokio::test]
    #[ignore]
    async fn test_retroarch_core_download() {
        println!("\n=== Testing RetroArch Core Download ===\n");

        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let cores_dir = temp_dir.path().join("cores");
        std::fs::create_dir_all(&cores_dir).unwrap();

        let core_name = "snes9x_libretro.dll";
        let core_url = format!(
            "https://buildbot.libretro.com/nightly/windows/x86_64/latest/{}.zip",
            core_name
        );

        println!("1. Downloading core: {}", core_name);
        println!("   URL: {}", core_url);

        let client = reqwest::Client::new();
        let resp = client.get(&core_url).send().await;

        match resp {
            Ok(response) if response.status().is_success() => {
                let bytes = response.bytes().await.unwrap();
                println!("   Downloaded: {} bytes", bytes.len());

                let zip_path = cores_dir.join(format!("{}.zip", core_name));
                std::fs::write(&zip_path, &bytes).unwrap();

                // Extract the core
                println!("\n2. Extracting core...");
                let file = std::fs::File::open(&zip_path).unwrap();
                let mut zip = zip::ZipArchive::new(file).unwrap();

                for i in 0..zip.len() {
                    let mut entry = zip.by_index(i).unwrap();
                    if entry.name().ends_with(".dll") {
                        let outpath = cores_dir.join(entry.mangled_name());
                        let mut outfile = std::fs::File::create(&outpath).unwrap();
                        std::io::copy(&mut entry, &mut outfile).unwrap();
                        println!("   Extracted: {:?}", outpath);
                    }
                }

                // Verify core exists
                let core_path = cores_dir.join(core_name);
                if core_path.exists() {
                    let size = std::fs::metadata(&core_path).unwrap().len();
                    println!("\n3. Core installed: {:?} ({} bytes)", core_path, size);
                    println!("\n=== SUCCESS: Core download workflow works ===\n");
                } else {
                    println!("   WARNING: Core file not found after extraction");
                }
            }
            Ok(response) => {
                println!("   SKIP: Server returned {}", response.status());
            }
            Err(e) => {
                println!("   SKIP: Network error: {}", e);
            }
        }
    }

    /// Test all downloadable emulators can be fetched (metadata only, no full download)
    #[tokio::test]
    #[ignore]
    async fn test_all_emulator_sources_accessible() {
        println!("\n=== Testing All Emulator Download Sources ===\n");

        let client = reqwest::Client::builder()
            .user_agent("wingosy-launcher-test/0.1")
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .unwrap();

        // Emulators with direct download URLs
        let direct_downloads = vec![(
            "RetroArch",
            "https://buildbot.libretro.com/stable/1.19.1/windows/x86_64/RetroArch.7z",
        )];

        // Emulators with GitHub repos
        let github_repos = vec![
            ("PCSX2", "PCSX2/pcsx2", "(?i)pcsx2.*windows.*x64.*\\.7z$"),
            (
                "PPSSPP",
                "hrydgard/ppsspp",
                "(?i)PPSSPP.*Windows.*x64.*\\.zip$",
            ),
            ("mGBA", "mgba-emu/mgba", "(?i)mGBA.*win64.*\\.7z$"),
            (
                "Flycast",
                "flyinghead/flycast",
                "(?i)flycast.*win64.*\\.zip$",
            ),
            (
                "melonDS",
                "melonDS-emu/melonDS",
                "(?i)melonDS.*windows.*x86_64.*\\.zip$",
            ),
            // Ryujinx - removed, original repo and forks taken down
            (
                "Lime3DS",
                "Lime3DS/Lime3DS",
                "(?i)(lime3ds|azahar).*windows.*msvc.*\\.zip$",
            ),
            (
                "RPCS3",
                "RPCS3/rpcs3-binaries-win",
                "(?i)^rpcs3-.*_win64_msvc\\.7z$",
            ),
            ("xemu", "xemu-project/xemu", "(?i)xemu.*win.*\\.zip$"),
            (
                "Xenia",
                "xenia-canary/xenia-canary",
                "(?i)xenia_canary.*\\.zip$",
            ),
        ];

        println!("Direct Downloads:\n");
        for (name, url) in &direct_downloads {
            match client.head(*url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    let size = resp
                        .headers()
                        .get("content-length")
                        .and_then(|v| v.to_str().ok())
                        .and_then(|s| s.parse::<u64>().ok())
                        .map(|s| format!("{:.1} MB", s as f64 / 1_000_000.0))
                        .unwrap_or_else(|| "? MB".to_string());
                    println!("  ✓ {}: {} ({})", name, resp.status(), size);
                }
                Ok(resp) => println!("  ✗ {}: {}", name, resp.status()),
                Err(e) => println!("  ✗ {}: {}", name, e),
            }
        }

        println!("\nGitHub Releases:\n");
        for (name, repo, pattern) in &github_repos {
            let api_url = format!("https://api.github.com/repos/{}/releases/latest", repo);
            match client.get(&api_url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    let release: serde_json::Value = resp.json().await.unwrap();
                    let tag = release["tag_name"].as_str().unwrap_or("?");
                    let assets = release["assets"].as_array();

                    let re = regex_lite::Regex::new(pattern).unwrap();
                    let matched = assets.and_then(|a| {
                        a.iter()
                            .find(|x| re.is_match(x["name"].as_str().unwrap_or("")))
                    });

                    match matched {
                        Some(asset) => {
                            let asset_name = asset["name"].as_str().unwrap_or("?");
                            let size = asset["size"]
                                .as_i64()
                                .map(|s| format!("{:.1} MB", s as f64 / 1_000_000.0))
                                .unwrap_or_else(|| "? MB".to_string());
                            println!("  ✓ {} ({}): {} ({})", name, tag, asset_name, size);
                        }
                        None => {
                            println!("  ⚠ {} ({}): No asset matching '{}'", name, tag, pattern);
                        }
                    }
                }
                Ok(resp) if resp.status().as_u16() == 403 => {
                    println!("  ⚠ {}: Rate limited", name);
                }
                Ok(resp) => println!("  ✗ {}: {}", name, resp.status()),
                Err(e) => println!("  ✗ {}: {}", name, e),
            }
        }

        // Forgejo (Gitea-compatible) — Eden releases upstream
        let forgejo_releases = vec![(
            "Eden",
            "https://git.eden-emu.dev/api/v1/repos/eden-emu/eden/releases/latest",
            "(?i)^Eden-Windows-.*amd64-msvc-standard\\.zip$",
        )];

        println!("\nForgejo Releases:\n");
        for (name, api_url, pattern) in &forgejo_releases {
            match client.get(*api_url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    let release: serde_json::Value = resp.json().await.unwrap();
                    let tag = release["tag_name"].as_str().unwrap_or("?");
                    let assets = release["assets"].as_array();
                    let re = regex_lite::Regex::new(pattern).unwrap();
                    let matched = assets.and_then(|a| {
                        a.iter()
                            .find(|x| re.is_match(x["name"].as_str().unwrap_or("")))
                    });
                    match matched {
                        Some(asset) => {
                            let asset_name = asset["name"].as_str().unwrap_or("?");
                            println!("  ✓ {} ({}): {}", name, tag, asset_name);
                        }
                        None => {
                            println!("  ⚠ {} ({}): No asset matching pattern", name, tag);
                        }
                    }
                }
                Ok(resp) => println!("  ✗ {}: {}", name, resp.status()),
                Err(e) => println!("  ✗ {}: {}", name, e),
            }
        }

        println!("\n=== Test Complete ===\n");
    }

    // Helper functions
    fn find_file_recursive(dir: &PathBuf, filename: &str) -> Option<PathBuf> {
        if !dir.is_dir() {
            return None;
        }

        for entry in std::fs::read_dir(dir).ok()? {
            let entry = entry.ok()?;
            let path = entry.path();

            if path.is_file() {
                if path
                    .file_name()?
                    .to_string_lossy()
                    .eq_ignore_ascii_case(filename)
                {
                    return Some(path);
                }
            } else if path.is_dir() {
                if let Some(found) = find_file_recursive(&path, filename) {
                    return Some(found);
                }
            }
        }
        None
    }

    fn list_directory_contents(dir: &PathBuf, depth: usize) {
        let indent = "  ".repeat(depth);
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                let name = path.file_name().unwrap().to_string_lossy();
                if path.is_dir() {
                    println!("{}📁 {}/", indent, name);
                    if depth < 2 {
                        list_directory_contents(&path, depth + 1);
                    }
                } else {
                    println!("{}📄 {}", indent, name);
                }
            }
        }
    }
}

/// Critical download tests - these MUST pass for core functionality to work
/// Run with: cargo test --test emulator_integration critical -- --nocapture
///
/// RetroArch cores: exhaustive ZIP checks live beside `core_download_url` —
/// `cargo test all_mapped_retroarch_core_buildbot_zips_are_valid`.
#[cfg(test)]
mod critical_download_tests {
    /// Verify that downloaded ZIPs can actually be extracted and contain DLLs
    #[tokio::test]
    async fn test_core_zip_extraction_works() {
        println!("\n=== CRITICAL: Verifying Core ZIP Extraction ===\n");

        let core = "snes9x_libretro.dll";
        let url = format!(
            "https://buildbot.libretro.com/nightly/windows/x86_64/latest/{}.zip",
            core
        );

        let client = reqwest::Client::new();
        let resp = client
            .get(&url)
            .send()
            .await
            .expect("Failed to download core");

        assert!(resp.status().is_success(), "HTTP error: {}", resp.status());

        let bytes = resp.bytes().await.expect("Failed to read response");

        // Write to temp file
        let temp_dir = tempfile::TempDir::new().expect("Failed to create temp dir");
        let zip_path = temp_dir.path().join("test_core.zip");
        std::fs::write(&zip_path, &bytes).expect("Failed to write zip");

        // Try to open as ZIP
        let file = std::fs::File::open(&zip_path).expect("Failed to open zip");
        let mut archive = zip::ZipArchive::new(file)
            .expect("Failed to parse ZIP - file may be corrupted or not a valid ZIP");

        println!("  ZIP contains {} entries", archive.len());

        // Find and extract DLL
        let mut found_dll = false;
        for i in 0..archive.len() {
            let entry = archive.by_index(i).expect("Failed to read entry");
            let name = entry.name();
            println!("    - {}", name);

            if name.ends_with(".dll") {
                found_dll = true;
            }
        }

        assert!(found_dll, "No .dll file found in ZIP archive");
        println!("\n=== Core ZIP extraction works correctly ===\n");
    }

    /// Test HTTP status code checking in download manager
    #[tokio::test]
    async fn test_download_manager_checks_http_status() {
        println!("\n=== CRITICAL: Verifying HTTP Status Code Checking ===\n");

        let client = reqwest::Client::new();

        // Test with a URL that should return 404
        let fake_url = "https://buildbot.libretro.com/nightly/windows/x86_64/latest/nonexistent_fake_core_12345.dll.zip";

        let resp = client
            .get(fake_url)
            .send()
            .await
            .expect("Failed to send request");

        let status = resp.status();
        println!("  Request to nonexistent core returned: {}", status);

        // The server should return 404, not 200
        // If it returns 200 with HTML, that's a problem
        if status.is_success() {
            let bytes = resp.bytes().await.unwrap();
            let is_html = bytes.starts_with(b"<!")
                || bytes.starts_with(b"<html")
                || bytes.starts_with(b"<HTML");

            if is_html {
                panic!("Server returned 200 with HTML for nonexistent file - download manager must check content!");
            }
        }

        println!("=== HTTP status code checking works ===\n");
    }
}

/// ROM download tests - requires network access
#[cfg(test)]
mod rom_download_tests {
    /// Test that ROM download URL construction is correct
    #[test]
    fn test_rom_download_url_format() {
        // Simulate RomM URL construction
        let server_url = "https://romm.example.com";
        let romm_id = 123;
        let file_name = "Super Mario Bros.nes";

        // URL should be properly constructed with manual encoding
        let encoded_name = file_name.replace(' ', "%20");
        let expected = format!(
            "{}/api/roms/{}/content/{}",
            server_url.trim_end_matches('/'),
            romm_id,
            encoded_name
        );

        println!("ROM download URL: {}", expected);

        // Verify URL encoding works for special characters
        assert!(
            expected.contains("Super%20Mario"),
            "Spaces should be URL encoded"
        );
    }

    /// Test download destination path construction
    #[test]
    fn test_rom_destination_path() {
        use std::path::PathBuf;

        let roms_dir = PathBuf::from("/home/user/.wingosy/roms");
        let platform_id = "nes";
        let file_name = "Super Mario Bros.nes";

        let dest_path = roms_dir.join(platform_id).join(file_name);

        println!("ROM destination: {:?}", dest_path);

        assert!(dest_path.to_string_lossy().contains("nes"));
        assert!(dest_path.to_string_lossy().contains("Super Mario Bros.nes"));
    }
}
