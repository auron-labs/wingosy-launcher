use anyhow::{Context, Result};
use chrono::Datelike;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const WINGOSY_CLIENT: &str = "wingosy-launcher";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const READ_TIMEOUT: Duration = Duration::from_secs(30);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(120);

#[derive(Debug, Clone)]
pub struct RomMClient {
    client: Client,
    base_url: String,
    token: Option<String>,
}

impl RomMClient {
    pub fn new(base_url: impl Into<String>) -> Self {
        let client = Client::builder()
            .cookie_store(true)
            .connect_timeout(CONNECT_TIMEOUT)
            .read_timeout(READ_TIMEOUT)
            .timeout(REQUEST_TIMEOUT)
            .build()
            .unwrap_or_else(|_| Client::new());

        Self {
            client,
            base_url: base_url.into().trim_end_matches('/').to_string(),
            token: None,
        }
    }

    pub fn with_token(mut self, token: String) -> Self {
        self.token = Some(token);
        self
    }

    pub async fn authenticate(&mut self, username: &str, password: &str) -> Result<TokenResponse> {
        tracing::info!(
            "[RomM] Authenticating user '{}' at {}",
            username,
            self.base_url
        );

        let response = self
            .client
            .post(format!("{}/api/token", self.base_url))
            .form(&[
                ("username", username),
                ("password", password),
                ("grant_type", "password"),
                ("scope", "me.read me.write roms.read platforms.read firmware.read roms.user.read roms.user.write"),
            ])
            .send()
            .await
            .context("Failed to connect to RomM server")?;

        let status = response.status();
        let text = response
            .text()
            .await
            .context("Failed to read authentication response")?;
        if !status.is_success() {
            tracing::error!("[RomM] Authentication failed: HTTP {}", status);
            let detail = serde_json::from_str::<serde_json::Value>(&text)
                .ok()
                .and_then(|body| body.get("detail")?.as_str().map(str::to_owned))
                .unwrap_or_else(|| format!("HTTP {}", status));
            anyhow::bail!("Authentication failed: {}", detail);
        }

        let token: TokenResponse =
            serde_json::from_str(&text).context("Failed to parse authentication response")?;

        self.token = Some(token.access_token.clone());
        tracing::info!("[RomM] Authentication successful for '{}'", username);
        Ok(token)
    }

    pub async fn refresh_authentication(&mut self, refresh_token: &str) -> Result<TokenResponse> {
        let response = self
            .client
            .post(format!("{}/api/token", self.base_url))
            .form(&[
                ("grant_type", "refresh_token"),
                ("refresh_token", refresh_token),
            ])
            .send()
            .await
            .context("Failed to connect to RomM server")?;
        let status = response.status();
        let text = response
            .text()
            .await
            .context("Failed to read token refresh response")?;
        if !status.is_success() {
            let detail = serde_json::from_str::<serde_json::Value>(&text)
                .ok()
                .and_then(|body| body.get("detail")?.as_str().map(str::to_owned))
                .unwrap_or_else(|| format!("HTTP {}", status));
            anyhow::bail!("RomM session renewal failed: {}", detail);
        }

        let token: TokenResponse =
            serde_json::from_str(&text).context("Failed to parse token refresh response")?;
        self.token = Some(token.access_token.clone());
        Ok(token)
    }

    pub async fn begin_device_auth(
        &self,
        client_device_identifier: &str,
        device_name: &str,
    ) -> Result<DeviceAuthInitResponse> {
        let response = self
            .client
            .post(format!("{}/api/auth/device/init", self.base_url))
            .json(&serde_json::json!({
                "client_device_identifier": client_device_identifier,
                "name": device_name,
                "client": WINGOSY_CLIENT,
                "platform": "Windows",
                "client_version": env!("CARGO_PKG_VERSION"),
                "requested_scopes": [
                    "me.read", "me.write",
                    "platforms.read", "platforms.write",
                    "roms.read", "roms.write",
                    "roms.user.read", "roms.user.write",
                    "assets.read", "assets.write",
                    "firmware.read", "firmware.write",
                    "collections.read", "collections.write",
                    "devices.read", "devices.write"
                ]
            }))
            .send()
            .await
            .context("Failed to start RomM device pairing")?;

        parse_json_response(response, "Device pairing could not be started").await
    }

    pub async fn poll_device_auth(&self, device_code: &str) -> Result<DeviceAuthPollResponse> {
        let response = self
            .client
            .post(format!("{}/api/auth/device/token", self.base_url))
            .json(&serde_json::json!({ "device_code": device_code }))
            .send()
            .await
            .context("Failed to check RomM device pairing")?;

        if response.status().is_success() {
            let token: DeviceAuthTokenResponse = response
                .json()
                .await
                .context("Failed to parse RomM device token")?;
            return Ok(DeviceAuthPollResponse {
                status: "approved".to_string(),
                access_token: Some(token.access_token),
                device_id: Some(token.device_id),
            });
        }

        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        let detail = serde_json::from_str::<serde_json::Value>(&text)
            .ok()
            .and_then(|body| body.get("detail")?.as_str().map(str::to_owned))
            .unwrap_or_else(|| format!("HTTP {status}"));
        match detail.as_str() {
            "authorization_pending" | "slow_down" | "access_denied" | "expired_token" => {
                Ok(DeviceAuthPollResponse {
                    status: detail,
                    access_token: None,
                    device_id: None,
                })
            }
            _ => anyhow::bail!("Device pairing failed: {detail}"),
        }
    }

    /// Register a Wingosy install as an API-mode sync device when the user supplies
    /// an existing RomM client/access token instead of using device pairing.
    pub async fn register_wingosy_device(
        &self,
        device_name: &str,
        hostname: &str,
    ) -> Result<String> {
        let mut request = self
            .client
            .post(format!("{}/api/devices", self.base_url))
            .json(&serde_json::json!({
                "name": device_name,
                "platform": "Windows",
                "client": WINGOSY_CLIENT,
                "client_version": env!("CARGO_PKG_VERSION"),
                "hostname": hostname,
                "sync_mode": "api"
            }));

        if let Some(auth) = self.auth_header() {
            request = request.header("Authorization", auth);
        }

        let response: DeviceRegistrationResponse = parse_json_response(
            request
                .send()
                .await
                .context("Failed to register Wingosy as a RomM device")?,
            "Device registration failed",
        )
        .await?;
        Ok(response.device_id)
    }

    /// Update the exact RomM device previously returned to this Wingosy
    /// installation. Returns `false` when that device no longer exists so the
    /// caller can fall back to registering a new one.
    pub async fn update_wingosy_device(
        &self,
        device_id: &str,
        device_name: &str,
        hostname: &str,
    ) -> Result<bool> {
        let mut request = self
            .client
            .put(format!("{}/api/devices/{}", self.base_url, device_id))
            .json(&serde_json::json!({
                "name": device_name,
                "platform": "Windows",
                "client": WINGOSY_CLIENT,
                "client_version": env!("CARGO_PKG_VERSION"),
                "hostname": hostname,
                "sync_mode": "api"
            }));

        if let Some(auth) = self.auth_header() {
            request = request.header("Authorization", auth);
        }

        let response = request
            .send()
            .await
            .context("Failed to update the existing Wingosy device")?;
        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(false);
        }
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Device update failed (HTTP {status}): {body}");
        }
        Ok(true)
    }

    fn auth_header(&self) -> Option<String> {
        self.token.as_ref().map(|t| format!("Bearer {}", t))
    }

    pub async fn get_platforms(&self) -> Result<Vec<RomMPlatform>> {
        tracing::debug!("[RomM] Fetching platforms from {}", self.base_url);

        let mut request = self.client.get(format!("{}/api/platforms", self.base_url));

        if let Some(auth) = self.auth_header() {
            request = request.header("Authorization", auth);
        }

        let response = request.send().await.context("Failed to fetch platforms")?;

        let status = response.status();
        let text = response
            .text()
            .await
            .context("Failed to read platforms response body")?;

        if !status.is_success() {
            tracing::error!("[RomM] Platforms API returned {}", status);
            anyhow::bail!(
                "Platforms API returned {}: {}",
                status,
                &text[..text.len().min(200)]
            );
        }

        let platforms: Vec<RomMPlatform> = serde_json::from_str(&text).context(format!(
            "Failed to parse platforms JSON (first 300 chars): {}",
            &text[..text.len().min(300)]
        ))?;

        tracing::info!("[RomM] Found {} platforms", platforms.len());
        Ok(platforms)
    }

    pub async fn download_firmware(
        &self,
        firmware_id: i64,
        file_name: &str,
    ) -> Result<reqwest::Response> {
        let encoded_name = urlencoding::encode(file_name);
        let mut request = self.client.get(format!(
            "{}/api/firmware/{}/content/{}",
            self.base_url, firmware_id, encoded_name
        ));
        if let Some(auth) = self.auth_header() {
            request = request.header("Authorization", auth);
        }
        let response = request
            .send()
            .await
            .context("Failed to download firmware")?;
        let status = response.status();
        if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
            anyhow::bail!(
                "RomM denied firmware access (HTTP {}). Reconnect in Settings > RomM so the token includes firmware.read.",
                status
            );
        }
        if !status.is_success() {
            anyhow::bail!("Firmware download returned HTTP {}", status);
        }
        Ok(response)
    }

    pub async fn get_roms(
        &self,
        platform_id: Option<i32>,
        limit: i32,
        offset: i32,
    ) -> Result<PaginatedResponse<RomMRom>> {
        tracing::debug!(
            "[RomM] Fetching ROMs (platform_id={:?}, limit={}, offset={})",
            platform_id,
            limit,
            offset
        );

        let mut request = self
            .client
            .get(format!("{}/api/roms", self.base_url))
            .query(&[("limit", limit.to_string()), ("offset", offset.to_string())]);

        if let Some(pid) = platform_id {
            request = request.query(&[("platform_id", pid.to_string())]);
        }

        if let Some(auth) = self.auth_header() {
            request = request.header("Authorization", auth);
        }

        let response = request.send().await.context("Failed to fetch ROMs")?;

        let status = response.status();
        let text = response
            .text()
            .await
            .context("Failed to read ROMs response body")?;

        if !status.is_success() {
            tracing::error!("[RomM] ROMs API returned {}", status);
            anyhow::bail!(
                "ROMs API returned {}: {}",
                status,
                &text[..text.len().min(200)]
            );
        }

        let raw: serde_json::Value =
            serde_json::from_str(&text).context("ROMs response is not valid JSON")?;

        let total = raw["total"].as_i64().unwrap_or(0) as i32;
        let items_raw = raw["items"]
            .as_array()
            .context("ROMs response missing 'items' array")?;

        let base = self.base_url.clone();
        let items: Vec<RomMRom> = items_raw
            .iter()
            .filter_map(|v| {
                let screenshots = screenshot_urls_from_rom_json(v, &base);
                Some(RomMRom {
                    id: v["id"].as_i64()? as i32,
                    platform_id: v["platform_id"].as_i64().unwrap_or(0) as i32,
                    platform_slug: v["platform_slug"].as_str().unwrap_or("").to_string(),
                    name: v["name"].as_str().unwrap_or("").to_string(),
                    fs_name: v["fs_name"]
                        .as_str()
                        .or_else(|| v["file_name"].as_str())
                        .unwrap_or("")
                        .to_string(),
                    fs_size_bytes: v["fs_size_bytes"]
                        .as_i64()
                        .or_else(|| v["file_size_bytes"].as_i64())
                        .unwrap_or(0),
                    igdb_id: v["igdb_id"].as_i64().map(|x| x as i32),
                    summary: v["summary"].as_str().map(|s| s.to_string()),
                    url_cover: v["url_cover"].as_str().map(|s| s.to_string()),
                    igdb_metadata: v
                        .get("igdb_metadata")
                        .filter(|m| m.is_object() && !m.as_object().unwrap().is_empty())
                        .and_then(|m| serde_json::from_value(m.clone()).ok()),
                    screenshots,
                    title_id_candidates: None,
                    files: None,
                })
            })
            .collect();

        tracing::info!("[RomM] Fetched {} ROMs (total: {})", items.len(), total);

        Ok(PaginatedResponse {
            items,
            total,
            page: raw["page"].as_i64().map(|x| x as i32),
            size: raw["size"].as_i64().map(|x| x as i32),
        })
    }

    pub async fn get_rom(&self, rom_id: i32) -> Result<RomMRom> {
        tracing::debug!("[RomM] Fetching ROM id={}", rom_id);

        let mut request = self
            .client
            .get(format!("{}/api/roms/{}", self.base_url, rom_id));

        if let Some(auth) = self.auth_header() {
            request = request.header("Authorization", auth);
        }

        let response = request.send().await.context("Failed to fetch ROM")?;

        let status = response.status();
        let text = response
            .text()
            .await
            .context("Failed to read ROM response")?;

        if !status.is_success() {
            tracing::error!(
                "[RomM] ROM API returned {}: {}",
                status,
                &text[..text.len().min(200)]
            );
            anyhow::bail!("ROM API returned {}", status);
        }

        // Parse with flexible field handling
        let raw: serde_json::Value = serde_json::from_str(&text).context(format!(
            "ROM response is not valid JSON: {}",
            &text[..text.len().min(100)]
        ))?;

        let screenshots = screenshot_urls_from_rom_json(&raw, &self.base_url);
        let files = raw
            .get("files")
            .map(|value| {
                serde_json::from_value::<Vec<RomMFile>>(value.clone())
                    .context("Detailed ROM metadata 'files' must be an array")
            })
            .transpose()?;
        let rom = RomMRom {
            id: raw["id"].as_i64().context("ROM missing 'id' field")? as i32,
            platform_id: raw["platform_id"].as_i64().unwrap_or(0) as i32,
            platform_slug: raw["platform_slug"].as_str().unwrap_or("").to_string(),
            name: raw["name"].as_str().unwrap_or("").to_string(),
            fs_name: raw["fs_name"]
                .as_str()
                .or_else(|| raw["file_name"].as_str())
                .unwrap_or("")
                .to_string(),
            fs_size_bytes: raw["fs_size_bytes"]
                .as_i64()
                .or_else(|| raw["file_size_bytes"].as_i64())
                .unwrap_or(0),
            igdb_id: raw["igdb_id"].as_i64().map(|x| x as i32),
            summary: raw["summary"].as_str().map(|s| s.to_string()),
            url_cover: raw["url_cover"].as_str().map(|s| s.to_string()),
            igdb_metadata: raw
                .get("igdb_metadata")
                .filter(|m| m.is_object() && !m.as_object().unwrap().is_empty())
                .and_then(|m| serde_json::from_value(m.clone()).ok()),
            screenshots,
            title_id_candidates: Some(title_id_candidates_from_rom_json(&raw)),
            files,
        };

        tracing::debug!("[RomM] Fetched ROM: {} (fs_name={})", rom.name, rom.fs_name);
        Ok(rom)
    }

    pub async fn get_retroachievements(
        &self,
        rom_id: i32,
        refresh_progression: bool,
    ) -> Result<Vec<RomMAchievement>> {
        let mut request = self
            .client
            .get(format!("{}/api/roms/{}", self.base_url, rom_id));
        if let Some(auth) = self.auth_header() {
            request = request.header("Authorization", auth);
        }

        let response = request
            .send()
            .await
            .context("Failed to fetch ROM achievements")?;
        let status = response.status();
        let text = response
            .text()
            .await
            .context("Failed to read ROM achievements response")?;
        if !status.is_success() {
            anyhow::bail!("ROM achievements request returned {status}");
        }
        let rom: serde_json::Value =
            serde_json::from_str(&text).context("ROM achievements response is not valid JSON")?;

        let definitions = rom
            .get("merged_ra_metadata")
            .and_then(|metadata| metadata.get("achievements"))
            .and_then(serde_json::Value::as_array)
            .cloned()
            .unwrap_or_default();
        if definitions.is_empty() {
            return Ok(Vec::new());
        }
        let ra_game_id = rom.get("ra_id").and_then(valid_identifier);

        let user = self.get_current_user_json().await?;
        let user = if refresh_progression {
            let user_id = user
                .get("id")
                .and_then(valid_identifier)
                .context("RomM user response did not include a valid user id; cannot refresh RetroAchievements progression")?;
            self.refresh_retroachievements_progression(user_id).await?;
            self.get_current_user_json().await?
        } else {
            user
        };

        let earned = ra_game_id
            .and_then(|game_id| progression_for_game(&user, game_id))
            .unwrap_or_default();

        Ok(definitions
            .iter()
            .filter_map(|definition| achievement_from_json(definition, &earned))
            .collect())
    }

    async fn get_current_user_json(&self) -> Result<serde_json::Value> {
        let mut request = self.client.get(format!("{}/api/users/me", self.base_url));
        if let Some(auth) = self.auth_header() {
            request = request.header("Authorization", auth);
        }
        let response = request
            .send()
            .await
            .context("Failed to fetch RomM user progression")?;
        parse_json_response(response, "RomM user progression request failed").await
    }

    async fn refresh_retroachievements_progression(&self, user_id: i64) -> Result<()> {
        let mut request = self
            .client
            .post(format!("{}/api/users/{user_id}/ra/refresh", self.base_url))
            .json(&serde_json::json!({ "incremental": true }));
        if let Some(auth) = self.auth_header() {
            request = request.header("Authorization", auth);
        }

        let response = request
            .send()
            .await
            .context("Failed to request RetroAchievements progression refresh")?;
        let status = response.status();
        let text = response
            .text()
            .await
            .context("Failed to read RetroAchievements refresh response")?;
        if !status.is_success() {
            let detail = serde_json::from_str::<serde_json::Value>(&text)
                .ok()
                .and_then(|body| body.get("detail")?.as_str().map(str::to_owned))
                .unwrap_or_else(|| format!("HTTP {status}"));
            anyhow::bail!("RetroAchievements progression refresh failed: {detail}");
        }
        Ok(())
    }

    pub fn rom_download_url(&self, rom_id: i32, filename: &str) -> String {
        format!("{}/api/roms/{}/content/{}", self.base_url, rom_id, filename)
    }

    pub fn rom_file_download_url(&self, file_id: i32, filename: &str) -> String {
        let encoded_name = urlencoding::encode(filename);
        format!(
            "{}/api/roms/{}/files/content/{}",
            self.base_url, file_id, encoded_name
        )
    }

    pub fn cover_url(&self, rom_id: i32) -> String {
        format!("{}/api/roms/{}/cover", self.base_url, rom_id)
    }

    pub async fn get_saves(&self, rom_id: i32) -> Result<Vec<RomMSave>> {
        tracing::debug!("[RomM] Fetching saves for ROM id={}", rom_id);

        let mut request = self
            .client
            .get(format!("{}/api/saves", self.base_url))
            .query(&[("rom_id", rom_id.to_string())]);

        if let Some(auth) = self.auth_header() {
            request = request.header("Authorization", auth);
        }

        let response = request.send().await.context("Failed to fetch saves")?;

        let status = response.status();
        let text = response
            .text()
            .await
            .context("Failed to read saves response")?;

        if !status.is_success() {
            // 404 means saves feature might not be enabled or no saves exist
            if status.as_u16() == 404 {
                tracing::debug!("[RomM] Saves not available for ROM id={} (404)", rom_id);
                return Ok(vec![]);
            }
            tracing::error!(
                "[RomM] Saves API returned {}: {}",
                status,
                &text[..text.len().min(200)]
            );
            anyhow::bail!("Saves API returned {}", status);
        }

        let saves = Self::parse_saves_list_response(&text, rom_id)?;
        tracing::info!("[RomM] Found {} saves for ROM id={}", saves.len(), rom_id);
        Ok(saves)
    }

    fn parse_saves_list_response(text: &str, rom_id: i32) -> Result<Vec<RomMSave>> {
        if text.is_empty() || text == "[]" || text == "null" {
            return Ok(vec![]);
        }
        let raw: serde_json::Value = serde_json::from_str(text).context(format!(
            "Saves response is not valid JSON: {}",
            &text[..text.len().min(100)]
        ))?;
        let saves_array = if raw.is_array() {
            raw.as_array().cloned().unwrap_or_default()
        } else if let Some(items) = raw.get("items").and_then(|v| v.as_array()) {
            items.clone()
        } else if let Some(saves) = raw.get("saves").and_then(|v| v.as_array()) {
            saves.clone()
        } else {
            return Ok(vec![]);
        };
        Ok(saves_array
            .iter()
            .filter_map(|v| parse_save_value(v, rom_id))
            .collect())
    }

    pub async fn upload_save(&self, rom_id: i32, save_data: Vec<u8>, filename: &str) -> Result<()> {
        let part = reqwest::multipart::Part::bytes(save_data).file_name(filename.to_string());

        let form = reqwest::multipart::Form::new().part("saveFile", part);

        let mut request = self
            .client
            .post(format!("{}/api/saves", self.base_url))
            .multipart(form)
            .query(&[("rom_id", rom_id.to_string())]);

        if let Some(auth) = self.auth_header() {
            request = request.header("Authorization", auth);
        }

        let response = request.send().await.context("Failed to upload save")?;
        let status = response.status();
        let text = response.text().await.context("read upload response")?;
        if !status.is_success() {
            let detail: String = text.chars().take(300).collect();
            anyhow::bail!("Upload returned {}: {}", status, detail);
        }

        Ok(())
    }

    pub async fn download_save(&self, _rom_id: i32, save_id: i32) -> Result<Vec<u8>> {
        let mut request = self
            .client
            .get(format!("{}/api/saves/{}/content", self.base_url, save_id));

        if let Some(auth) = self.auth_header() {
            request = request.header("Authorization", auth);
        }

        let response = request.send().await.context("Failed to download save")?;
        read_save_response(response, "Save download returned an error").await
    }

    /// RomM 4.7+ device-aware save list (Argosy-compatible).
    pub async fn get_saves_for_rom_device(
        &self,
        rom_id: i32,
        device_id: &str,
    ) -> Result<Vec<RomMSave>> {
        let mut request = self
            .client
            .get(format!("{}/api/saves", self.base_url))
            .query(&[
                ("rom_id", rom_id.to_string()),
                ("device_id", device_id.to_string()),
            ]);

        if let Some(auth) = self.auth_header() {
            request = request.header("Authorization", auth);
        }

        let response = request.send().await.context("Failed to list saves")?;
        let status = response.status();
        let text = response.text().await.context("read saves list")?;
        if !status.is_success() {
            if status.as_u16() == 404 {
                return Ok(vec![]);
            }
            anyhow::bail!(
                "Saves list returned {}: {}",
                status,
                &text[..text.len().min(200)]
            );
        }
        Self::parse_saves_list_response(&text, rom_id)
    }

    /// Upload a Switch save ZIP using Argosy-compatible query parameters.
    #[allow(clippy::too_many_arguments)]
    pub async fn upload_save_device(
        &self,
        rom_id: i32,
        emulator: &str,
        device_id: &str,
        slot: Option<&str>,
        zip_bytes: Vec<u8>,
        filename: &str,
        overwrite: bool,
    ) -> Result<RomMSave> {
        let part = reqwest::multipart::Part::bytes(zip_bytes).file_name(filename.to_string());
        let form = reqwest::multipart::Form::new().part("saveFile", part);

        let mut request = self
            .client
            .post(format!("{}/api/saves", self.base_url))
            .multipart(form)
            .query(&[
                ("rom_id", rom_id.to_string()),
                ("emulator", emulator.to_string()),
                ("device_id", device_id.to_string()),
                ("overwrite", overwrite.to_string()),
                ("autocleanup", "true".to_string()),
                ("autocleanup_limit", "10".to_string()),
            ]);

        if let Some(slot) = slot {
            request = request.query(&[("slot", slot.to_string())]);
        }

        if let Some(auth) = self.auth_header() {
            request = request.header("Authorization", auth);
        }

        let response = request.send().await.context("Failed to upload save")?;
        let status = response.status();
        let text = response.text().await.context("read upload response")?;
        if !status.is_success() {
            anyhow::bail!(
                "Upload returned {}: {}",
                status,
                &text[..text.len().min(300)]
            );
        }
        serde_json::from_str(&text).context("parse upload save response")
    }

    /// Download save bytes via the device-aware content route.
    pub async fn download_save_content_device(
        &self,
        save: &RomMSave,
        device_id: &str,
    ) -> Result<Vec<u8>> {
        let mut request = self
            .client
            .get(format!("{}/api/saves/{}/content", self.base_url, save.id))
            .query(&[("device_id", device_id), ("optimistic", "false")]);

        if let Some(auth) = self.auth_header() {
            request = request.header("Authorization", auth);
        }

        let response = request
            .send()
            .await
            .context("Failed to download device-aware save")?;
        if response.status().is_success() {
            return read_save_response(response, "Failed to read save body").await;
        }

        // RomM 4.7+ uses the endpoint above. Keep old clients usable when a
        // proxy/server reports that endpoint as unavailable, but never treat
        // its error document as save content.
        let status = response.status();
        if !sync_negotiate_is_unsupported(status) {
            return read_save_response(response, "Device-aware save download returned an error")
                .await;
        }
        tracing::debug!(
            "Device-aware save download returned {}; trying legacy route",
            status
        );
        self.download_save_legacy(save.rom_id, save.id).await
    }

    async fn download_save_legacy(&self, rom_id: i32, save_id: i32) -> Result<Vec<u8>> {
        let mut request = self.client.get(format!(
            "{}/api/roms/{}/saves/{}/content",
            self.base_url, rom_id, save_id
        ));
        if let Some(auth) = self.auth_header() {
            request = request.header("Authorization", auth);
        }

        let response = request
            .send()
            .await
            .context("Failed to download save from legacy route")?;
        read_save_response(response, "Legacy save download returned an error").await
    }

    /// Confirm a device-aware download only after the caller has successfully
    /// validated and installed the save locally.
    pub async fn confirm_save_downloaded(&self, save_id: i32, device_id: &str) -> Result<()> {
        let mut request = self
            .client
            .post(format!(
                "{}/api/saves/{}/downloaded",
                self.base_url, save_id
            ))
            .json(&serde_json::json!({ "device_id": device_id }));
        if let Some(auth) = self.auth_header() {
            request = request.header("Authorization", auth);
        }
        let response = request
            .send()
            .await
            .context("Failed to confirm save download")?;
        // Older RomM releases do not expose the confirmation route. The save
        // is already installed locally at this point, so retain legacy
        // compatibility without pretending a modern confirmation succeeded.
        if response.status() == reqwest::StatusCode::NOT_FOUND {
            tracing::warn!("RomM does not support confirmed save downloads");
            return Ok(());
        }
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Save download confirmation returned {status}: {body}");
        }
        Ok(())
    }

    pub async fn negotiate_sync(
        &self,
        device_id: &str,
        saves: Vec<ClientSaveState>,
    ) -> Result<Option<SyncNegotiateResponse>> {
        let mut request = self
            .client
            .post(format!("{}/api/sync/negotiate", self.base_url))
            .json(&serde_json::json!({ "device_id": device_id, "saves": saves }));
        if let Some(auth) = self.auth_header() {
            request = request.header("Authorization", auth);
        }
        let response = request
            .send()
            .await
            .context("Failed to negotiate save sync")?;
        if sync_negotiate_is_unsupported(response.status()) {
            tracing::info!(
                "RomM does not expose the negotiated sync engine; using legacy save sync"
            );
            return Ok(None);
        }
        parse_json_response(response, "Save sync negotiation failed")
            .await
            .map(Some)
    }

    pub async fn complete_sync_session(
        &self,
        session_id: i64,
        completed: u32,
        failed: u32,
    ) -> Result<()> {
        let mut request = self
            .client
            .post(format!(
                "{}/api/sync/sessions/{}/complete",
                self.base_url, session_id
            ))
            .json(&serde_json::json!({
                "operations_completed": completed,
                "operations_failed": failed
            }));
        if let Some(auth) = self.auth_header() {
            request = request.header("Authorization", auth);
        }
        let response = request
            .send()
            .await
            .context("Failed to complete save sync session")?;
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Save sync session completion returned {status}: {body}");
        }
        Ok(())
    }

    pub fn token(&self) -> Option<&str> {
        self.token.as_deref()
    }

    pub fn is_authenticated(&self) -> bool {
        self.token.is_some()
    }
}

async fn read_save_response(response: reqwest::Response, context: &'static str) -> Result<Vec<u8>> {
    response
        .error_for_status()
        .context(context)?
        .bytes()
        .await
        .map(|bytes| bytes.to_vec())
        .context("Failed to read save data")
}

fn sync_negotiate_is_unsupported(status: reqwest::StatusCode) -> bool {
    matches!(
        status,
        reqwest::StatusCode::NOT_FOUND
            | reqwest::StatusCode::METHOD_NOT_ALLOWED
            | reqwest::StatusCode::NOT_IMPLEMENTED
    )
}

async fn parse_json_response<T: serde::de::DeserializeOwned>(
    response: reqwest::Response,
    context: &str,
) -> Result<T> {
    let status = response.status();
    let text = response
        .text()
        .await
        .context("Failed to read RomM response")?;
    if !status.is_success() {
        let detail = serde_json::from_str::<serde_json::Value>(&text)
            .ok()
            .and_then(|body| body.get("detail")?.as_str().map(str::to_owned))
            .unwrap_or_else(|| format!("HTTP {status}"));
        anyhow::bail!("{context}: {detail}");
    }
    serde_json::from_str(&text)
        .with_context(|| format!("Failed to parse RomM response for {context}"))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    #[serde(default)]
    pub refresh_token: Option<String>,
    #[serde(default)]
    pub expires: Option<i64>,
    #[serde(default)]
    pub refresh_expires: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceAuthInitResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_path: String,
    pub verification_path_complete: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DeviceAuthTokenResponse {
    access_token: String,
    device_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DeviceRegistrationResponse {
    device_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ClientSaveState {
    pub rom_id: i32,
    pub file_name: String,
    pub slot: Option<String>,
    pub emulator: Option<String>,
    pub content_hash: Option<String>,
    pub updated_at: String,
    pub file_size_bytes: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SyncOperation {
    pub action: String,
    pub rom_id: i32,
    pub save_id: Option<i32>,
    pub file_name: String,
    pub slot: Option<String>,
    pub emulator: Option<String>,
    pub reason: String,
    pub server_updated_at: Option<String>,
    pub server_content_hash: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SyncNegotiateResponse {
    pub session_id: i64,
    pub operations: Vec<SyncOperation>,
    pub total_upload: u32,
    pub total_download: u32,
    pub total_conflict: u32,
    pub total_no_op: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceAuthPollResponse {
    pub status: String,
    pub access_token: Option<String>,
    pub device_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    pub total: i32,
    #[serde(default)]
    pub page: Option<i32>,
    #[serde(default)]
    pub size: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RomMPlatform {
    pub id: i32,
    #[serde(default)]
    pub slug: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub rom_count: i32,
    #[serde(default)]
    pub igdb_id: Option<i32>,
    #[serde(default)]
    pub url_logo: Option<String>,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub firmware: Vec<RomMFirmware>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RomMFirmware {
    pub id: i64,
    #[serde(default)]
    pub file_name: String,
    #[serde(default)]
    pub file_path: String,
    #[serde(default)]
    pub full_path: String,
    #[serde(default)]
    pub file_size_bytes: u64,
    #[serde(default)]
    pub md5_hash: Option<String>,
    #[serde(default)]
    pub sha1_hash: Option<String>,
    #[serde(default)]
    pub missing_from_fs: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IgdbMetadata {
    #[serde(default)]
    pub genres: Option<Vec<String>>,
    #[serde(default)]
    pub first_release_date: Option<i64>,
    #[serde(default)]
    pub aggregated_rating: Option<f64>,
    #[serde(default)]
    pub total_rating: Option<f64>,
    #[serde(default)]
    pub franchises: Option<Vec<String>>,
    #[serde(default)]
    pub companies: Option<Vec<String>>,
    /// IGDB game mode labels when RomM exposes them (e.g. Single player, Multiplayer).
    #[serde(default)]
    pub game_modes: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RomMRom {
    pub id: i32,
    #[serde(default)]
    pub platform_id: i32,
    #[serde(default)]
    pub platform_slug: String,
    #[serde(default)]
    pub name: String,
    #[serde(default, alias = "file_name")]
    pub fs_name: String,
    #[serde(default, alias = "file_size_bytes")]
    pub fs_size_bytes: i64,

    #[serde(default)]
    pub igdb_id: Option<i32>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub url_cover: Option<String>,
    #[serde(default)]
    pub igdb_metadata: Option<IgdbMetadata>,
    /// Resolved from RomM JSON (`screenshots`, `igdb_screenshots`, etc.); not serde-filled from list API.
    #[serde(default)]
    pub screenshots: Vec<String>,
    /// Valid base application IDs found in authenticated detailed ROM metadata.
    /// `None` means the response did not include detailed identity metadata.
    #[serde(default)]
    pub title_id_candidates: Option<Vec<String>>,
    /// Child files from authenticated detailed metadata. List responses leave this unset.
    #[serde(default)]
    pub files: Option<Vec<RomMFile>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RomMAchievement {
    pub id: i64,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    pub points: i32,
    #[serde(rename = "type", default)]
    pub achievement_type: Option<String>,
    #[serde(default)]
    pub badge_url: Option<String>,
    #[serde(default)]
    pub badge_url_lock: Option<String>,
    pub unlocked: bool,
    pub unlocked_hardcore: bool,
    #[serde(default)]
    pub unlocked_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RomMFile {
    #[serde(default)]
    pub id: Option<i32>,
    #[serde(default)]
    pub rom_id: Option<i32>,
    #[serde(default)]
    pub file_name: Option<String>,
    #[serde(default)]
    pub file_path: Option<String>,
    #[serde(default)]
    pub file_size_bytes: Option<u64>,
    #[serde(default)]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub last_modified: Option<RomMFileLastModified>,
    #[serde(default)]
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum RomMFileLastModified {
    Number(f64),
    Text(String),
}

fn valid_identifier(value: &serde_json::Value) -> Option<i64> {
    let id = value
        .as_i64()
        .or_else(|| value.as_str()?.trim().parse::<i64>().ok())?;
    (id > 0).then_some(id)
}

fn identifiers(value: &serde_json::Value, keys: &[&str]) -> Vec<i64> {
    keys.iter()
        .filter_map(|key| value.get(*key).and_then(valid_identifier))
        .collect()
}

fn progression_for_game(
    user: &serde_json::Value,
    ra_game_id: i64,
) -> Option<Vec<serde_json::Value>> {
    user.pointer("/ra_progression/results")?
        .as_array()?
        .iter()
        .find(|result| result.get("rom_ra_id").and_then(valid_identifier) == Some(ra_game_id))
        .and_then(|result| result.get("earned_achievements"))
        .and_then(serde_json::Value::as_array)
        .cloned()
}

fn non_empty_string(value: Option<&serde_json::Value>) -> Option<String> {
    value
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn achievement_from_json(
    definition: &serde_json::Value,
    earned: &[serde_json::Value],
) -> Option<RomMAchievement> {
    let id = definition.get("ra_id").and_then(valid_identifier)?;
    let definition_ids = identifiers(definition, &["ra_id", "badge_id"]);
    let earned_record = earned.iter().find(|item| {
        identifiers(item, &["id", "achievement_id", "ra_id", "badge_id"])
            .iter()
            .any(|earned_id| definition_ids.contains(earned_id))
    });
    let unlocked_at = non_empty_string(earned_record.and_then(|item| item.get("date")));
    let unlocked_hardcore_at =
        non_empty_string(earned_record.and_then(|item| item.get("date_hardcore")));

    Some(RomMAchievement {
        id,
        title: definition
            .get("title")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("Achievement")
            .to_owned(),
        description: non_empty_string(definition.get("description")),
        points: definition
            .get("points")
            .and_then(serde_json::Value::as_i64)
            .and_then(|points| i32::try_from(points).ok())
            .unwrap_or(0),
        achievement_type: non_empty_string(definition.get("type")),
        badge_url: non_empty_string(definition.get("badge_url")),
        badge_url_lock: non_empty_string(definition.get("badge_url_lock")),
        unlocked: unlocked_at.is_some() || unlocked_hardcore_at.is_some(),
        unlocked_hardcore: unlocked_hardcore_at.is_some(),
        unlocked_at: unlocked_hardcore_at.or(unlocked_at),
    })
}

impl RomMRom {
    pub fn has_cover(&self) -> bool {
        self.url_cover.is_some()
    }

    pub fn genres(&self) -> Vec<String> {
        self.igdb_metadata
            .as_ref()
            .and_then(|m| m.genres.clone())
            .unwrap_or_default()
    }

    pub fn first_release_date(&self) -> Option<i64> {
        self.igdb_metadata
            .as_ref()
            .and_then(|m| m.first_release_date)
    }

    pub fn aggregated_rating(&self) -> Option<f32> {
        self.igdb_metadata
            .as_ref()
            .and_then(|m| m.aggregated_rating.or(m.total_rating))
            .map(|r| r as f32)
    }

    pub fn into_game(self, server_url: &str) -> crate::models::Game {
        let platform_id = crate::models::map_romm_slug(&self.platform_slug);

        let release_year = self
            .first_release_date()
            .and_then(|ts| chrono::DateTime::from_timestamp(ts, 0).map(|dt| dt.year()));

        let cover_path = self.url_cover.clone().map(|url| {
            if url.starts_with("http") {
                url
            } else {
                format!("{}{}", server_url.trim_end_matches('/'), url)
            }
        });

        let file_name = if self.fs_name.is_empty() {
            self.name.clone()
        } else {
            self.fs_name.clone()
        };

        let genres = self.genres();
        let rating = self.aggregated_rating();
        let (developer, publisher) = self
            .igdb_metadata
            .as_ref()
            .and_then(|m| m.companies.as_ref())
            .map(|c| {
                let dev = c.first().cloned();
                let pub_ = if c.len() > 1 { c.get(1).cloned() } else { None };
                (dev, pub_)
            })
            .unwrap_or((None, None));

        let player_count = self
            .igdb_metadata
            .as_ref()
            .and_then(|m| m.game_modes.as_ref())
            .filter(|modes| !modes.is_empty())
            .map(|modes| modes.join(", "));

        crate::models::Game {
            id: 0,
            platform_id,
            name: self.name,
            file_path: file_name,
            source: crate::models::GameSource::RomM,
            romm_id: Some(self.id),
            summary: self.summary,
            developer,
            publisher,
            release_year,
            genres,
            player_count,
            cover_path,
            screenshot_paths: self.screenshots,
            is_favorite: false,
            is_hidden: false,
            user_rating: rating,
            library_status: None,
            personal_rating: 0,
            personal_difficulty: 0,
            last_played_at: None,
            play_count: 0,
            play_time_minutes: 0,
            sync_state: crate::models::SyncState::RemoteOnly,
            local_file_path: None,
        }
    }
}

fn add_title_id_candidates(text: Option<&str>, candidates: &mut Vec<String>) {
    let Some(text) = text else {
        return;
    };
    for title_id in crate::sync::switch_save::extract_title_ids_from_path(text) {
        if !candidates.contains(&title_id) {
            candidates.push(title_id);
        }
    }
}

fn file_category(value: &serde_json::Value) -> Option<&serde_json::Value> {
    value
        .get("category")
        .or_else(|| value.get("file_category"))
        .or_else(|| value.get("file_type"))
        .or_else(|| value.get("type"))
}

fn file_category_name(category: &serde_json::Value) -> Option<&str> {
    category
        .as_str()
        .or_else(|| category.get("name").and_then(|name| name.as_str()))
}

fn is_base_game_file(value: &serde_json::Value) -> bool {
    let Some(category) = file_category(value) else {
        return true;
    };
    category.is_null()
        || file_category_name(category).is_some_and(|name| name.eq_ignore_ascii_case("game"))
}

fn add_file_title_id_candidates(file: &serde_json::Value, candidates: &mut Vec<String>) {
    for key in [
        "fs_name",
        "file_name",
        "filename",
        "name",
        "file_path",
        "full_path",
        "path",
    ] {
        add_title_id_candidates(file.get(key).and_then(|value| value.as_str()), candidates);
    }
}

fn add_game_file_candidates(value: &serde_json::Value, candidates: &mut Vec<String>) {
    match value {
        serde_json::Value::Array(files) => {
            for file in files {
                add_game_file_candidates(file, candidates);
            }
        }
        serde_json::Value::Object(files) if is_base_game_file(value) => {
            if files.keys().any(|key| {
                [
                    "fs_name",
                    "file_name",
                    "filename",
                    "name",
                    "file_path",
                    "full_path",
                    "path",
                ]
                .iter()
                .any(|file_key| key == file_key)
            }) {
                add_file_title_id_candidates(value, candidates);
            }
            for key in ["game", "files", "items", "children"] {
                if let Some(nested) = files.get(key) {
                    add_game_file_candidates(nested, candidates);
                }
            }
        }
        _ => {}
    }
}

fn title_id_candidates_from_rom_json(raw: &serde_json::Value) -> Vec<String> {
    let mut candidates = Vec::new();
    add_title_id_candidates(
        raw.get("fs_name").and_then(|value| value.as_str()),
        &mut candidates,
    );
    add_title_id_candidates(
        raw.get("file_name").and_then(|value| value.as_str()),
        &mut candidates,
    );
    if let Some(files) = raw.get("files") {
        add_game_file_candidates(files, &mut candidates);
    }
    candidates
}

fn absolutize_media_url(path: &str, server_url: &str) -> String {
    let p = path.trim();
    if p.starts_with("http://") || p.starts_with("https://") {
        return p.to_string();
    }
    let base = server_url.trim_end_matches('/');
    if p.starts_with('/') {
        format!("{}{}", base, p)
    } else {
        format!("{}/{}", base, p)
    }
}

/// Collect screenshot / artwork URLs from a RomM `/api/roms` or `/api/roms/{id}` JSON object.
///
/// RomM’s OpenAPI exposes the on-disk / resolved gallery as **`merged_screenshots`** (same field Argosy
/// and the RomM web UI use). Older payloads may use `screenshots`, `url_screenshots`, etc.
fn screenshot_urls_from_rom_json(raw: &serde_json::Value, server_url: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut push = |u: &str| {
        let s = absolutize_media_url(u, server_url);
        if !s.is_empty() && !out.contains(&s) {
            out.push(s);
        }
    };

    // Primary: RomM 4.x SimpleRomSchema / DetailedRomSchema — cached files + IGDB URLs merged server-side
    if let Some(arr) = raw.get("merged_screenshots").and_then(|v| v.as_array()) {
        for item in arr {
            if let Some(s) = item.as_str() {
                push(s);
            }
        }
    }

    // Raw DB-style URL list (IGDB), when present alongside or instead of merged
    if let Some(arr) = raw.get("url_screenshots").and_then(|v| v.as_array()) {
        for item in arr {
            if let Some(s) = item.as_str() {
                push(s);
            }
        }
    }

    // Cached files on the RomM host (relative paths under resources), if API exposes them without merge
    if let Some(arr) = raw.get("path_screenshots").and_then(|v| v.as_array()) {
        for item in arr {
            if let Some(s) = item.as_str() {
                push(s);
            }
        }
    }

    // Legacy / alternate keys (objects or strings)
    for key in &["screenshots", "igdb_screenshots", "arts"] {
        if let Some(arr) = raw.get(*key).and_then(|v| v.as_array()) {
            for item in arr {
                if let Some(s) = item.as_str() {
                    push(s);
                } else if let Some(u) = item.get("url").and_then(|x| x.as_str()) {
                    push(u);
                } else if let Some(u) = item.get("url_cover").and_then(|x| x.as_str()) {
                    push(u);
                }
            }
        }
    }

    out
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RomMSave {
    pub id: i32,
    #[serde(default)]
    pub rom_id: i32,
    #[serde(default, alias = "filename", alias = "name")]
    pub file_name: String,
    #[serde(default, alias = "size")]
    pub file_size_bytes: i64,
    #[serde(default)]
    pub emulator: Option<String>,
    #[serde(default, alias = "createdAt")]
    pub created_at: String,
    #[serde(default, alias = "updatedAt")]
    pub updated_at: String,
    /// Named save channel on RomM (Argosy: slot / channel); e.g. `argosy-latest`, `slot-1`.
    #[serde(default)]
    pub slot: Option<String>,
}

fn parse_save_value(v: &serde_json::Value, rom_id: i32) -> Option<RomMSave> {
    Some(RomMSave {
        id: v["id"].as_i64()? as i32,
        rom_id: v["rom_id"].as_i64().unwrap_or(rom_id as i64) as i32,
        file_name: v["file_name"]
            .as_str()
            .or_else(|| v["filename"].as_str())
            .or_else(|| v["name"].as_str())
            .unwrap_or("unknown")
            .to_string(),
        file_size_bytes: v["file_size_bytes"]
            .as_i64()
            .or_else(|| v["size"].as_i64())
            .unwrap_or(0),
        emulator: v["emulator"].as_str().map(|s| s.to_string()),
        created_at: v["created_at"]
            .as_str()
            .or_else(|| v["createdAt"].as_str())
            .unwrap_or("")
            .to_string(),
        updated_at: v["updated_at"]
            .as_str()
            .or_else(|| v["updatedAt"].as_str())
            .unwrap_or("")
            .to_string(),
        slot: v["slot"].as_str().map(|s| s.to_string()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unavailable_negotiate_routes_use_legacy_sync() {
        assert!(sync_negotiate_is_unsupported(
            reqwest::StatusCode::NOT_FOUND
        ));
        assert!(sync_negotiate_is_unsupported(
            reqwest::StatusCode::METHOD_NOT_ALLOWED
        ));
        assert!(sync_negotiate_is_unsupported(
            reqwest::StatusCode::NOT_IMPLEMENTED
        ));
        assert!(!sync_negotiate_is_unsupported(
            reqwest::StatusCode::UNAUTHORIZED
        ));
        assert!(!sync_negotiate_is_unsupported(
            reqwest::StatusCode::INTERNAL_SERVER_ERROR
        ));
    }

    #[test]
    fn client_new_trims_trailing_slash() {
        let client = RomMClient::new("https://romm.example.com/");
        assert_eq!(client.base_url, "https://romm.example.com");
    }

    #[test]
    fn client_new_preserves_url_without_slash() {
        let client = RomMClient::new("https://romm.example.com");
        assert_eq!(client.base_url, "https://romm.example.com");
    }

    #[test]
    fn client_starts_unauthenticated() {
        let client = RomMClient::new("https://romm.example.com");
        assert!(!client.is_authenticated());
        assert!(client.token().is_none());
    }

    #[test]
    fn client_with_token_is_authenticated() {
        let client = RomMClient::new("https://romm.example.com").with_token("test_token".into());
        assert!(client.is_authenticated());
        assert_eq!(client.token(), Some("test_token"));
    }

    #[test]
    fn rom_download_url_format() {
        let client = RomMClient::new("https://romm.example.com");
        let url = client.rom_download_url(123, "Super Mario Bros.nes");
        assert_eq!(
            url,
            "https://romm.example.com/api/roms/123/content/Super Mario Bros.nes"
        );
    }

    #[test]
    fn rom_file_download_url_uses_authenticated_child_file_endpoint() {
        let client = RomMClient::new("https://romm.example.com/");
        let url = client.rom_file_download_url(456, "Update Pack.nsp");
        assert_eq!(
            url,
            "https://romm.example.com/api/roms/456/files/content/Update%20Pack.nsp"
        );
    }

    #[test]
    fn cover_url_format() {
        let client = RomMClient::new("https://romm.example.com");
        let url = client.cover_url(456);
        assert_eq!(url, "https://romm.example.com/api/roms/456/cover");
    }

    #[test]
    fn screenshot_urls_read_merged_screenshots_like_romm_openapi() {
        let raw = serde_json::json!({
            "merged_screenshots": [
                "/assets/romm/resources/1/2/a.png",
                "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/xy.jpg"
            ]
        });
        let urls = screenshot_urls_from_rom_json(&raw, "https://romm.example.com");
        assert_eq!(urls.len(), 2);
        assert_eq!(
            urls[0],
            "https://romm.example.com/assets/romm/resources/1/2/a.png"
        );
        assert_eq!(
            urls[1],
            "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/xy.jpg"
        );
    }

    #[test]
    fn detailed_rom_identity_uses_primary_and_game_files_only() {
        let raw = serde_json::json!({
            "fs_name": "Game [0100AAAA00000001].nsp",
            "files": [
                {"category": "game", "file_name": "Game [0100AAAA00000001].nsp"},
                {"category": "update", "file_name": "Update [0100BBBB00000002].nsp"},
                {"category": "dlc", "file_name": "DLC [0100CCCC00000003].nsp"},
                {"category": "future-artifact", "file_name": "Other [0100DDDD00000004].nsp"}
            ]
        });

        assert_eq!(
            title_id_candidates_from_rom_json(&raw),
            vec!["0100AAAA00000001".to_string()]
        );
    }

    #[test]
    fn detailed_rom_identity_retains_conflicting_trusted_candidates() {
        let raw = serde_json::json!({
            "fs_name": "Game [0100AAAA00000001].nsp",
            "files": {
                "game": [{"file_name": "Game [0100BBBB00000002].nsp"}]
            }
        });

        assert_eq!(
            title_id_candidates_from_rom_json(&raw),
            vec![
                "0100AAAA00000001".to_string(),
                "0100BBBB00000002".to_string()
            ]
        );
    }

    #[test]
    fn detailed_rom_identity_accepts_uncategorized_nested_base_file() {
        let raw = serde_json::json!({
            "fs_name": "Game.nsp",
            "files": [{
                "category": null,
                "children": [{
                    "file_name": "Game [0100AAAA00000001].nsp"
                }]
            }]
        });

        assert_eq!(
            title_id_candidates_from_rom_json(&raw),
            vec!["0100AAAA00000001".to_string()]
        );
    }

    #[test]
    fn rom_has_cover_when_url_present() {
        let rom = RomMRom {
            id: 1,
            platform_id: 1,
            platform_slug: "snes".into(),
            name: "Test".into(),
            fs_name: "test.sfc".into(),
            fs_size_bytes: 1024,
            igdb_id: None,
            summary: None,
            url_cover: Some("https://example.com/cover.jpg".into()),
            igdb_metadata: None,
            screenshots: vec![],
            title_id_candidates: None,
            files: None,
        };
        assert!(rom.has_cover());
    }

    #[test]
    fn rom_no_cover_when_url_none() {
        let rom = RomMRom {
            id: 1,
            platform_id: 1,
            platform_slug: "snes".into(),
            name: "Test".into(),
            fs_name: "test.sfc".into(),
            fs_size_bytes: 1024,
            igdb_id: None,
            summary: None,
            url_cover: None,
            igdb_metadata: None,
            screenshots: vec![],
            title_id_candidates: None,
            files: None,
        };
        assert!(!rom.has_cover());
    }

    #[test]
    fn rom_genres_empty_without_metadata() {
        let rom = RomMRom {
            id: 1,
            platform_id: 1,
            platform_slug: "snes".into(),
            name: "Test".into(),
            fs_name: "test.sfc".into(),
            fs_size_bytes: 1024,
            igdb_id: None,
            summary: None,
            url_cover: None,
            igdb_metadata: None,
            screenshots: vec![],
            title_id_candidates: None,
            files: None,
        };
        assert!(rom.genres().is_empty());
    }

    #[test]
    fn rom_genres_from_metadata() {
        let rom = RomMRom {
            id: 1,
            platform_id: 1,
            platform_slug: "snes".into(),
            name: "Test".into(),
            fs_name: "test.sfc".into(),
            fs_size_bytes: 1024,
            igdb_id: None,
            summary: None,
            url_cover: None,
            igdb_metadata: Some(IgdbMetadata {
                genres: Some(vec!["RPG".into(), "Action".into()]),
                first_release_date: None,
                aggregated_rating: None,
                total_rating: None,
                franchises: None,
                companies: None,
                game_modes: None,
            }),
            screenshots: vec![],
            title_id_candidates: None,
            files: None,
        };
        let genres = rom.genres();
        assert_eq!(genres.len(), 2);
        assert!(genres.contains(&"RPG".to_string()));
    }

    #[test]
    fn rom_rating_prefers_aggregated() {
        let rom = RomMRom {
            id: 1,
            platform_id: 1,
            platform_slug: "snes".into(),
            name: "Test".into(),
            fs_name: "test.sfc".into(),
            fs_size_bytes: 1024,
            igdb_id: None,
            summary: None,
            url_cover: None,
            igdb_metadata: Some(IgdbMetadata {
                genres: None,
                first_release_date: None,
                aggregated_rating: Some(85.5),
                total_rating: Some(90.0),
                franchises: None,
                companies: None,
                game_modes: None,
            }),
            screenshots: vec![],
            title_id_candidates: None,
            files: None,
        };
        assert_eq!(rom.aggregated_rating(), Some(85.5));
    }

    #[test]
    fn rom_rating_falls_back_to_total() {
        let rom = RomMRom {
            id: 1,
            platform_id: 1,
            platform_slug: "snes".into(),
            name: "Test".into(),
            fs_name: "test.sfc".into(),
            fs_size_bytes: 1024,
            igdb_id: None,
            summary: None,
            url_cover: None,
            igdb_metadata: Some(IgdbMetadata {
                genres: None,
                first_release_date: None,
                aggregated_rating: None,
                total_rating: Some(75.0),
                franchises: None,
                companies: None,
                game_modes: None,
            }),
            screenshots: vec![],
            title_id_candidates: None,
            files: None,
        };
        assert_eq!(rom.aggregated_rating(), Some(75.0));
    }

    #[test]
    fn rom_into_game_maps_platform_slug() {
        let rom = RomMRom {
            id: 42,
            platform_id: 1,
            platform_slug: "sega-genesis".into(),
            name: "Sonic".into(),
            fs_name: "sonic.md".into(),
            fs_size_bytes: 2048,
            igdb_id: None,
            summary: Some("Fast hedgehog".into()),
            url_cover: None,
            igdb_metadata: None,
            screenshots: vec![],
            title_id_candidates: None,
            files: None,
        };

        let game = rom.into_game("https://romm.example.com");

        assert_eq!(game.platform_id, "genesis"); // mapped from sega-genesis
        assert_eq!(game.name, "Sonic");
        assert_eq!(game.romm_id, Some(42));
        assert_eq!(game.summary, Some("Fast hedgehog".into()));
        assert_eq!(game.sync_state, crate::models::SyncState::RemoteOnly);
    }

    #[test]
    fn rom_into_game_uses_name_when_fs_name_empty() {
        let rom = RomMRom {
            id: 1,
            platform_id: 1,
            platform_slug: "snes".into(),
            name: "Game Name".into(),
            fs_name: "".into(),
            fs_size_bytes: 1024,
            igdb_id: None,
            summary: None,
            url_cover: None,
            igdb_metadata: None,
            screenshots: vec![],
            title_id_candidates: None,
            files: None,
        };

        let game = rom.into_game("https://romm.example.com");
        assert_eq!(game.file_path, "Game Name");
    }

    #[test]
    fn rom_into_game_prepends_server_url_to_relative_cover() {
        let rom = RomMRom {
            id: 1,
            platform_id: 1,
            platform_slug: "snes".into(),
            name: "Test".into(),
            fs_name: "test.sfc".into(),
            fs_size_bytes: 1024,
            igdb_id: None,
            summary: None,
            url_cover: Some("/media/covers/test.jpg".into()),
            igdb_metadata: None,
            screenshots: vec![],
            title_id_candidates: None,
            files: None,
        };

        let game = rom.into_game("https://romm.example.com/");
        assert_eq!(
            game.cover_path,
            Some("https://romm.example.com/media/covers/test.jpg".into())
        );
    }

    #[test]
    fn rom_into_game_preserves_absolute_cover_url() {
        let rom = RomMRom {
            id: 1,
            platform_id: 1,
            platform_slug: "snes".into(),
            name: "Test".into(),
            fs_name: "test.sfc".into(),
            fs_size_bytes: 1024,
            igdb_id: None,
            summary: None,
            url_cover: Some("https://cdn.example.com/cover.jpg".into()),
            igdb_metadata: None,
            screenshots: vec![],
            title_id_candidates: None,
            files: None,
        };

        let game = rom.into_game("https://romm.example.com");
        assert_eq!(
            game.cover_path,
            Some("https://cdn.example.com/cover.jpg".into())
        );
    }

    // RomMSave deserialization tests
    #[test]
    fn save_deserializes_with_standard_fields() {
        let json = r#"{
            "id": 1,
            "rom_id": 42,
            "file_name": "save.sav",
            "file_size_bytes": 8192,
            "emulator": "retroarch",
            "created_at": "2024-01-01",
            "updated_at": "2024-01-02"
        }"#;

        let save: RomMSave = serde_json::from_str(json).expect("Should parse");
        assert_eq!(save.id, 1);
        assert_eq!(save.rom_id, 42);
        assert_eq!(save.file_name, "save.sav");
        assert_eq!(save.file_size_bytes, 8192);
        assert_eq!(save.emulator, Some("retroarch".into()));
    }

    #[test]
    fn save_deserializes_with_alias_fields() {
        let json = r#"{
            "id": 1,
            "filename": "save.sav",
            "size": 4096,
            "createdAt": "2024-01-01",
            "updatedAt": "2024-01-02"
        }"#;

        let save: RomMSave = serde_json::from_str(json).expect("Should parse with aliases");
        assert_eq!(save.id, 1);
        assert_eq!(save.file_name, "save.sav");
        assert_eq!(save.file_size_bytes, 4096);
    }

    #[test]
    fn save_deserializes_with_minimal_fields() {
        let json = r#"{"id": 1}"#;

        let save: RomMSave = serde_json::from_str(json).expect("Should parse minimal");
        assert_eq!(save.id, 1);
        assert_eq!(save.rom_id, 0); // default
        assert_eq!(save.file_name, ""); // default
        assert_eq!(save.file_size_bytes, 0); // default
    }

    // ROM into Game sync state tests
    #[test]
    fn rom_into_game_sets_remote_only_sync_state() {
        let rom = RomMRom {
            id: 1,
            platform_id: 1,
            platform_slug: "snes".into(),
            name: "Test".into(),
            fs_name: "test.sfc".into(),
            fs_size_bytes: 1024,
            igdb_id: None,
            summary: None,
            url_cover: None,
            igdb_metadata: None,
            screenshots: vec![],
            title_id_candidates: None,
            files: None,
        };

        let game = rom.into_game("https://romm.example.com");
        assert_eq!(game.sync_state, crate::models::SyncState::RemoteOnly);
        assert!(game.local_file_path.is_none());
    }

    #[test]
    fn rom_into_game_maps_publisher_and_game_modes_from_igdb_metadata() {
        let rom = RomMRom {
            id: 9,
            platform_id: 1,
            platform_slug: "snes".into(),
            name: "RPG".into(),
            fs_name: "rpg.sfc".into(),
            fs_size_bytes: 1024,
            igdb_id: Some(1),
            summary: None,
            url_cover: None,
            igdb_metadata: Some(IgdbMetadata {
                genres: Some(vec!["Role-playing (RPG)".into()]),
                first_release_date: None,
                aggregated_rating: Some(88.0),
                total_rating: None,
                franchises: None,
                companies: Some(vec!["Dev Studio".into(), "Pub Co".into()]),
                game_modes: Some(vec!["Single player".into(), "Co-operative".into()]),
            }),
            screenshots: vec![],
            title_id_candidates: None,
            files: None,
        };
        let game = rom.into_game("https://romm.example.com");
        assert_eq!(game.developer.as_deref(), Some("Dev Studio"));
        assert_eq!(game.publisher.as_deref(), Some("Pub Co"));
        assert_eq!(
            game.player_count.as_deref(),
            Some("Single player, Co-operative")
        );
        assert_eq!(game.user_rating, Some(88.0));
        assert_eq!(game.genres, vec!["Role-playing (RPG)"]);
    }

    #[test]
    fn rom_into_game_sets_romm_source() {
        let rom = RomMRom {
            id: 123,
            platform_id: 1,
            platform_slug: "gba".into(),
            name: "Test".into(),
            fs_name: "test.gba".into(),
            fs_size_bytes: 1024,
            igdb_id: None,
            summary: None,
            url_cover: None,
            igdb_metadata: None,
            screenshots: vec![],
            title_id_candidates: None,
            files: None,
        };

        let game = rom.into_game("https://romm.example.com");
        assert_eq!(game.source, crate::models::GameSource::RomM);
        assert_eq!(game.romm_id, Some(123));
    }

    struct AchievementFixtureState {
        rom: serde_json::Value,
        user: serde_json::Value,
        refreshed_user: Option<serde_json::Value>,
        refresh_status: u16,
        user_requests: usize,
        refresh_requests: usize,
    }

    struct AchievementFixture {
        base_url: String,
        state: std::sync::Arc<std::sync::Mutex<AchievementFixtureState>>,
        task: tokio::task::JoinHandle<()>,
    }

    impl AchievementFixture {
        async fn start(
            rom: serde_json::Value,
            user: serde_json::Value,
            refreshed_user: Option<serde_json::Value>,
            refresh_status: u16,
        ) -> Self {
            use tokio::net::TcpListener;

            let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
            let address = listener.local_addr().unwrap();
            let state = std::sync::Arc::new(std::sync::Mutex::new(AchievementFixtureState {
                rom,
                user,
                refreshed_user,
                refresh_status,
                user_requests: 0,
                refresh_requests: 0,
            }));
            let server_state = std::sync::Arc::clone(&state);
            let task = tokio::spawn(async move {
                loop {
                    let Ok((mut stream, _)) = listener.accept().await else {
                        break;
                    };
                    if let Err(error) = serve_achievement_request(&mut stream, &server_state).await
                    {
                        panic!("achievement fixture request failed: {error}");
                    }
                }
            });

            Self {
                base_url: format!("http://{address}"),
                state,
                task,
            }
        }

        fn request_counts(&self) -> (usize, usize) {
            let state = self.state.lock().unwrap();
            (state.user_requests, state.refresh_requests)
        }
    }

    impl Drop for AchievementFixture {
        fn drop(&mut self) {
            self.task.abort();
        }
    }

    async fn serve_achievement_request(
        stream: &mut tokio::net::TcpStream,
        state: &std::sync::Arc<std::sync::Mutex<AchievementFixtureState>>,
    ) -> Result<(), String> {
        let (method, target, headers) = read_achievement_request(stream).await?;
        if headers.get("authorization").map(String::as_str) != Some("Bearer fixture-token") {
            write_achievement_response(stream, 401, b"missing fixture authorization").await?;
            return Ok(());
        }

        match (method.as_str(), target.as_str()) {
            ("GET", "/api/roms/42") => {
                let rom = state.lock().unwrap().rom.clone();
                write_achievement_json(stream, 200, &rom).await
            }
            ("GET", "/api/users/me") => {
                let user = {
                    let mut state = state.lock().unwrap();
                    state.user_requests += 1;
                    state.user.clone()
                };
                write_achievement_json(stream, 200, &user).await
            }
            ("POST", "/api/users/7/ra/refresh") => {
                let status = {
                    let mut state = state.lock().unwrap();
                    state.refresh_requests += 1;
                    if let Some(user) = state.refreshed_user.clone() {
                        state.user = user;
                    }
                    state.refresh_status
                };
                let body = if (200..=299).contains(&status) {
                    b"{}".as_slice()
                } else {
                    b"{\"detail\":\"refresh rejected\"}".as_slice()
                };
                write_achievement_response(stream, status, body).await
            }
            _ => write_achievement_response(stream, 404, b"unsupported fixture route").await,
        }
    }

    async fn read_achievement_request(
        stream: &mut tokio::net::TcpStream,
    ) -> Result<(String, String, std::collections::HashMap<String, String>), String> {
        use tokio::io::AsyncReadExt;

        let mut bytes = Vec::new();
        let header_end = loop {
            let mut chunk = [0_u8; 1024];
            let read = stream
                .read(&mut chunk)
                .await
                .map_err(|error| format!("read request: {error}"))?;
            if read == 0 {
                return Err("request ended before headers".to_string());
            }
            bytes.extend_from_slice(&chunk[..read]);
            if let Some(end) = bytes.windows(4).position(|window| window == b"\r\n\r\n") {
                break end + 4;
            }
        };
        let header_text = std::str::from_utf8(&bytes[..header_end - 4])
            .map_err(|error| format!("request headers were not UTF-8: {error}"))?;
        let mut lines = header_text.lines();
        let mut request_line = lines
            .next()
            .ok_or_else(|| "missing request line".to_string())?
            .split_whitespace();
        let method = request_line.next().unwrap_or_default().to_string();
        let target = request_line
            .next()
            .unwrap_or_default()
            .split('?')
            .next()
            .unwrap_or_default()
            .to_string();
        let mut headers = std::collections::HashMap::new();
        for line in lines {
            if let Some((name, value)) = line.split_once(':') {
                headers.insert(name.trim().to_ascii_lowercase(), value.trim().to_string());
            }
        }
        Ok((method, target, headers))
    }

    async fn write_achievement_json(
        stream: &mut tokio::net::TcpStream,
        status: u16,
        value: &serde_json::Value,
    ) -> Result<(), String> {
        let body = serde_json::to_vec(value).map_err(|error| error.to_string())?;
        write_achievement_response(stream, status, &body).await
    }

    async fn write_achievement_response(
        stream: &mut tokio::net::TcpStream,
        status: u16,
        body: &[u8],
    ) -> Result<(), String> {
        use tokio::io::AsyncWriteExt;

        let reason = match status {
            200 => "OK",
            401 => "Unauthorized",
            404 => "Not Found",
            503 => "Service Unavailable",
            _ => "Response",
        };
        let response = format!(
            "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            body.len()
        );
        stream
            .write_all(response.as_bytes())
            .await
            .map_err(|error| error.to_string())?;
        stream
            .write_all(body)
            .await
            .map_err(|error| error.to_string())
    }

    fn achievement_rom(ra_id: Option<i64>, achievements: serde_json::Value) -> serde_json::Value {
        let mut rom = serde_json::json!({
            "id": 42,
            "merged_ra_metadata": { "achievements": achievements },
        });
        if let Some(ra_id) = ra_id {
            rom["ra_id"] = serde_json::json!(ra_id);
        }
        rom
    }

    fn achievement_user(results: serde_json::Value, id: Option<i64>) -> serde_json::Value {
        let mut user = serde_json::json!({
            "ra_progression": { "results": results },
        });
        if let Some(id) = id {
            user["id"] = serde_json::json!(id);
        }
        user
    }

    #[tokio::test]
    async fn retroachievements_maps_earned_and_locked_progress_without_refreshing() {
        let fixture = AchievementFixture::start(
            achievement_rom(
                Some(9001),
                serde_json::json!([
                    {"ra_id": 101, "badge_id": "1001", "title": "Earned", "points": 10},
                    {"ra_id": 102, "badge_id": "1002", "title": "Locked", "points": 20}
                ]),
            ),
            achievement_user(
                serde_json::json!([{
                    "rom_ra_id": 9001,
                    "earned_achievements": [{
                        "id": "1001",
                        "date": "2026-01-01T00:00:00Z",
                        "date_hardcore": "2026-01-02T00:00:00Z"
                    }]
                }]),
                Some(7),
            ),
            None,
            200,
        )
        .await;

        let client = RomMClient::new(&fixture.base_url).with_token("fixture-token".into());
        let achievements = client.get_retroachievements(42, false).await.unwrap();

        assert_eq!(achievements.len(), 2);
        assert!(achievements[0].unlocked);
        assert!(achievements[0].unlocked_hardcore);
        assert_eq!(
            achievements[0].unlocked_at.as_deref(),
            Some("2026-01-02T00:00:00Z")
        );
        assert!(!achievements[1].unlocked);
        assert!(!achievements[1].unlocked_hardcore);
        assert_eq!(fixture.request_counts(), (1, 0));
    }

    #[tokio::test]
    async fn retroachievements_missing_ids_never_select_progress() {
        let fixture = AchievementFixture::start(
            achievement_rom(
                None,
                serde_json::json!([
                    {"ra_id": 101, "badge_id": "1001", "title": "No game id"},
                    {"ra_id": 102, "title": "No badge id"},
                    {"badge_id": "1003", "title": "No achievement id"}
                ]),
            ),
            achievement_user(
                serde_json::json!([{
                    "earned_achievements": [
                        {"id": "1001", "date": "2026-01-01T00:00:00Z"},
                        {"date": "2026-01-01T00:00:00Z"}
                    ]
                }]),
                Some(7),
            ),
            None,
            200,
        )
        .await;

        let client = RomMClient::new(&fixture.base_url).with_token("fixture-token".into());
        let achievements = client.get_retroachievements(42, false).await.unwrap();

        assert_eq!(achievements.len(), 2);
        assert!(achievements.iter().all(|achievement| !achievement.unlocked));
    }

    #[tokio::test]
    async fn retroachievements_refresh_reloads_progression() {
        let fixture = AchievementFixture::start(
            achievement_rom(
                Some(9001),
                serde_json::json!([
                    {"ra_id": 101, "badge_id": "1001", "title": "Earned"}
                ]),
            ),
            achievement_user(
                serde_json::json!([{"rom_ra_id": 9001, "earned_achievements": []}]),
                Some(7),
            ),
            Some(achievement_user(
                serde_json::json!([{
                    "rom_ra_id": 9001,
                    "earned_achievements": [{"id": "1001", "date": "2026-01-01"}]
                }]),
                Some(7),
            )),
            200,
        )
        .await;

        let client = RomMClient::new(&fixture.base_url).with_token("fixture-token".into());
        let achievements = client.get_retroachievements(42, true).await.unwrap();

        assert!(achievements[0].unlocked);
        assert_eq!(fixture.request_counts(), (2, 1));
    }

    #[tokio::test]
    async fn retroachievements_rejected_refresh_is_an_error() {
        let fixture = AchievementFixture::start(
            achievement_rom(
                Some(9001),
                serde_json::json!([{"ra_id": 101, "badge_id": "1001", "title": "Earned"}]),
            ),
            achievement_user(serde_json::json!([]), Some(7)),
            None,
            503,
        )
        .await;

        let client = RomMClient::new(&fixture.base_url).with_token("fixture-token".into());
        let error = client
            .get_retroachievements(42, true)
            .await
            .expect_err("refresh rejection should propagate");

        assert!(error.to_string().contains("refresh rejected"));
        assert_eq!(fixture.request_counts(), (1, 1));
    }
}
