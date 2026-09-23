use crate::api::RomMClient;
use crate::config::AppConfig;
use crate::database::Database;
use crate::models::{Game, GameSource, Platform, SyncState};
use crate::sync::switch_romm::{
    post_launch_sync_result, pre_launch_sync_result, restore_switch_save_to_eden_with_title_id,
    resume_switch_save_normal_sync, upload_switch_save_from_eden,
};
use crate::sync::switch_save::{
    fingerprint_title_folder, zip_title_folder, ARGOSY_LATEST_SAVE_NAME, DEFAULT_SAVE_SLOT,
};
use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tempfile::TempDir;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::{oneshot, Notify};

const ROM_ID: i32 = 42;
const SAVE_ID: i32 = 7;
const DEVICE_ID: &str = "fixture-device";
const TOKEN: &str = "fixture-token";
const TITLE_ID: &str = "0100ABCD00000001";
const SAVE_FILE_NAME: &str = "Fixture Game.zip";
const MANUAL_SAVE_FILE_NAME: &str = "Manual Fixture.sav";
const MANUAL_SAVE_CONTENT: &[u8] = b"manual save bytes";

#[derive(Default)]
struct FixtureState {
    uploaded: Option<Vec<u8>>,
    device_uploads: usize,
    device_upload_failure: Option<(u16, Vec<u8>)>,
    manual_upload: Option<Vec<u8>>,
    manual_upload_failure: Option<(u16, Vec<u8>)>,
    download_confirmation_failure: Option<(u16, Vec<u8>)>,
    invalid_download: bool,
    confirmed_downloads: usize,
    library_platforms: Vec<serde_json::Value>,
    library_roms: HashMap<i32, Vec<serde_json::Value>>,
    fail_roms_from_offset: Option<i32>,
    library_rom_request_count: usize,
    first_library_rom_request_gate: Option<LibraryRequestGate>,
    expected_device_slot: Option<String>,
}

#[derive(Clone)]
struct LibraryRequestGate {
    started: Arc<Notify>,
    release: Arc<Notify>,
}

struct RomMFixture {
    base_url: String,
    state: Arc<Mutex<FixtureState>>,
    shutdown: Option<oneshot::Sender<()>>,
    task: Option<tokio::task::JoinHandle<()>>,
}

impl RomMFixture {
    async fn start() -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let state = Arc::new(Mutex::new(FixtureState::default()));
        let server_state = Arc::clone(&state);
        let (shutdown, mut stopped) = oneshot::channel();
        let task = tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = &mut stopped => break,
                    accepted = listener.accept() => {
                        let Ok((stream, _)) = accepted else { break };
                        if let Err(error) = serve_request(stream, &server_state).await {
                            tracing::error!("RomM fixture request failed: {error}");
                        }
                    }
                }
            }
        });

        Self {
            base_url: format!("http://{address}"),
            state,
            shutdown: Some(shutdown),
            task: Some(task),
        }
    }

    fn invalidate_next_download(&self) {
        self.state.lock().unwrap().invalid_download = true;
    }

    fn fail_manual_upload(&self, status: u16, body: &[u8]) {
        self.state.lock().unwrap().manual_upload_failure = Some((status, body.to_vec()));
    }

    fn fail_device_upload(&self, status: u16, body: &[u8]) {
        self.state.lock().unwrap().device_upload_failure = Some((status, body.to_vec()));
    }

    fn fail_download_confirmation(&self, status: u16, body: &[u8]) {
        self.state.lock().unwrap().download_confirmation_failure = Some((status, body.to_vec()));
    }

    fn expect_device_upload_slot(&self, slot: &str) {
        self.state.lock().unwrap().expected_device_slot = Some(slot.to_string());
    }

    fn configure_library(
        &self,
        platforms: Vec<serde_json::Value>,
        platform_id: i32,
        roms: Vec<serde_json::Value>,
    ) {
        let mut state = self.state.lock().unwrap();
        state.library_platforms = platforms;
        state.library_roms.insert(platform_id, roms);
        state.fail_roms_from_offset = None;
    }

    fn fail_library_page_from_offset(&self, offset: i32) {
        self.state.lock().unwrap().fail_roms_from_offset = Some(offset);
    }

    fn hold_first_library_rom_request(&self, started: Arc<Notify>, release: Arc<Notify>) {
        self.state.lock().unwrap().first_library_rom_request_gate =
            Some(LibraryRequestGate { started, release });
    }

    fn library_rom_request_count(&self) -> usize {
        self.state.lock().unwrap().library_rom_request_count
    }

    async fn stop(mut self) {
        self.shutdown.take().unwrap().send(()).ok();
        if let Some(task) = self.task.take() {
            task.await.unwrap();
        }
    }
}

impl Drop for RomMFixture {
    fn drop(&mut self) {
        if let Some(task) = self.task.take() {
            task.abort();
        }
    }
}

async fn serve_request(
    mut stream: tokio::net::TcpStream,
    state: &Arc<Mutex<FixtureState>>,
) -> Result<(), String> {
    match serve_request_inner(&mut stream, state).await {
        Ok(()) => Ok(()),
        Err(error) => {
            let _ = write_response(&mut stream, 400, error.as_bytes(), "text/plain").await;
            Err(error)
        }
    }
}

async fn serve_request_inner(
    stream: &mut tokio::net::TcpStream,
    state: &Arc<Mutex<FixtureState>>,
) -> Result<(), String> {
    let (method, target, headers, body) = read_request(stream).await?;
    if headers.get("authorization").map(String::as_str) != Some("Bearer fixture-token") {
        write_response(stream, 401, b"missing fixture authorization", "text/plain").await?;
        return Ok(());
    }

    let (path, query) = target.split_once('?').unwrap_or((&target, ""));
    let query: HashMap<_, _> = url::form_urlencoded::parse(query.as_bytes())
        .into_owned()
        .collect();

    match (method.as_str(), path) {
        ("GET", "/api/platforms") => {
            let platforms = state.lock().unwrap().library_platforms.clone();
            write_json(stream, 200, &serde_json::Value::Array(platforms)).await?;
        }
        ("GET", "/api/roms") => {
            let platform_id = query
                .get("platform_id")
                .map(|value| {
                    value
                        .parse::<i32>()
                        .map_err(|error| format!("invalid platform_id: {error}"))
                })
                .transpose()?;
            let offset = query
                .get("offset")
                .ok_or_else(|| "library request did not include offset".to_string())?
                .parse::<usize>()
                .map_err(|error| format!("invalid offset: {error}"))?;
            let limit = query
                .get("limit")
                .ok_or_else(|| "library request did not include limit".to_string())?
                .parse::<usize>()
                .map_err(|error| format!("invalid limit: {error}"))?;
            let (roms, fail_from_offset, request_gate) = {
                let mut state = state.lock().unwrap();
                state.library_rom_request_count += 1;
                let roms = match platform_id {
                    Some(platform_id) => state
                        .library_roms
                        .get(&platform_id)
                        .cloned()
                        .unwrap_or_default(),
                    None => state
                        .library_roms
                        .values()
                        .flat_map(|roms| roms.iter().cloned())
                        .collect(),
                };
                let request_gate = if state.library_rom_request_count == 1 {
                    state.first_library_rom_request_gate.take()
                } else {
                    None
                };
                (roms, state.fail_roms_from_offset, request_gate)
            };
            if let Some(request_gate) = request_gate {
                request_gate.started.notify_one();
                request_gate.release.notified().await;
            }
            if fail_from_offset.is_some_and(|failure_offset| offset >= failure_offset as usize) {
                write_response(stream, 500, b"fixture page failure", "text/plain").await?;
            } else {
                let items = roms
                    .iter()
                    .skip(offset)
                    .take(limit)
                    .cloned()
                    .collect::<Vec<_>>();
                let response = serde_json::json!({
                    "items": items,
                    "total": roms.len(),
                });
                write_json(stream, 200, &response).await?;
            }
        }
        ("POST", "/api/saves") => {
            require_query(&query, "rom_id", "42")?;
            if query.contains_key("device_id") {
                require_query(&query, "emulator", "eden")?;
                require_query(&query, "device_id", DEVICE_ID)?;
                let expected_slot = state
                    .lock()
                    .unwrap()
                    .expected_device_slot
                    .as_deref()
                    .unwrap_or(DEFAULT_SAVE_SLOT)
                    .to_string();
                require_query(&query, "slot", &expected_slot)?;
                require_query(&query, "overwrite", "false")?;
                require_query(&query, "autocleanup", "true")?;
                require_query(&query, "autocleanup_limit", "10")?;
                let expected_filename = if expected_slot.eq_ignore_ascii_case(DEFAULT_SAVE_SLOT)
                    || expected_slot.eq_ignore_ascii_case(ARGOSY_LATEST_SAVE_NAME)
                {
                    SAVE_FILE_NAME.to_string()
                } else {
                    format!("{expected_slot}.zip")
                };
                let uploaded = multipart_save_file(&headers, &body, &expected_filename)?;
                let (save_id, size, failure) = {
                    let mut state = state.lock().unwrap();
                    let failure = state.device_upload_failure.take();
                    let size = uploaded.len();
                    if failure.is_none() {
                        state.device_uploads += 1;
                        state.uploaded = Some(uploaded);
                    }
                    (SAVE_ID + state.device_uploads as i32 - 1, size, failure)
                };
                if let Some((status, body)) = failure {
                    write_response(stream, status, &body, "text/plain").await?;
                    return Ok(());
                }
                let response = serde_json::json!({
                    "id": save_id,
                    "rom_id": ROM_ID,
                    "file_name": SAVE_FILE_NAME,
                    "file_size_bytes": size,
                    "emulator": "eden",
                    "created_at": "2026-01-01T00:00:00Z",
                    "updated_at": "2026-01-01T00:00:00Z",
                    "slot": "autosave"
                });
                write_json(stream, 200, &response).await?;
            } else {
                let uploaded = multipart_save_file(&headers, &body, MANUAL_SAVE_FILE_NAME)?;
                let failure = {
                    let mut state = state.lock().unwrap();
                    state.manual_upload = Some(uploaded);
                    state.manual_upload_failure.take()
                };
                if let Some((status, body)) = failure {
                    write_response(stream, status, &body, "text/plain").await?;
                } else {
                    write_response(stream, 204, &[], "text/plain").await?;
                }
            }
        }
        ("GET", "/api/saves") => {
            require_query(&query, "rom_id", "42")?;
            if query.contains_key("device_id") {
                require_query(&query, "device_id", DEVICE_ID)?;
            }
            let size = state.lock().unwrap().uploaded.as_ref().map_or(0, Vec::len);
            let response = serde_json::json!([{
                "id": SAVE_ID,
                "rom_id": ROM_ID,
                "file_name": SAVE_FILE_NAME,
                "file_size_bytes": size,
                "emulator": "eden",
                "created_at": "2026-01-01T00:00:00Z",
                "updated_at": "2026-01-01T00:00:00Z",
                "slot": "autosave"
            }]);
            write_json(stream, 200, &response).await?;
        }
        ("GET", "/api/saves/7/content") => {
            require_query(&query, "device_id", DEVICE_ID)?;
            require_query(&query, "optimistic", "false")?;
            let body = {
                let state = state.lock().unwrap();
                if state.invalid_download {
                    b"not a save archive".to_vec()
                } else {
                    state
                        .uploaded
                        .clone()
                        .ok_or_else(|| "content requested before upload".to_string())?
                }
            };
            write_response(stream, 200, &body, "application/zip").await?;
        }
        ("POST", "/api/saves/7/downloaded") => {
            let confirmation: serde_json::Value = serde_json::from_slice(&body)
                .map_err(|error| format!("download confirmation was not JSON: {error}"))?;
            if confirmation
                .get("device_id")
                .and_then(|value| value.as_str())
                != Some(DEVICE_ID)
            {
                return Err("download confirmation used the wrong device".to_string());
            }
            let failure = state.lock().unwrap().download_confirmation_failure.take();
            if let Some((status, body)) = failure {
                write_response(stream, status, &body, "text/plain").await?;
            } else {
                state.lock().unwrap().confirmed_downloads += 1;
                write_response(stream, 204, &[], "text/plain").await?;
            }
        }
        _ => write_response(stream, 404, b"unsupported RomM route", "text/plain").await?,
    }
    Ok(())
}

fn require_query(query: &HashMap<String, String>, key: &str, expected: &str) -> Result<(), String> {
    if query.get(key).map(String::as_str) == Some(expected) {
        Ok(())
    } else {
        Err(format!(
            "query parameter {key:?} did not equal {expected:?}"
        ))
    }
}

async fn read_request(
    stream: &mut tokio::net::TcpStream,
) -> Result<(String, String, HashMap<String, String>, Vec<u8>), String> {
    let mut bytes = Vec::new();
    let header_end = loop {
        let mut chunk = [0u8; 4096];
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
        if bytes.len() > 1024 * 1024 {
            return Err("request headers exceeded fixture limit".to_string());
        }
    };

    let header_text = std::str::from_utf8(&bytes[..header_end - 4])
        .map_err(|error| format!("request headers were not UTF-8: {error}"))?;
    let mut lines = header_text.lines();
    let request_line = lines
        .next()
        .ok_or_else(|| "missing request line".to_string())?;
    let mut request_parts = request_line.split_whitespace();
    let method = request_parts.next().unwrap_or_default().to_string();
    let target = request_parts.next().unwrap_or_default().to_string();
    if method.is_empty() || target.is_empty() {
        return Err("malformed request line".to_string());
    }

    let mut headers = HashMap::new();
    for line in lines {
        if let Some((name, value)) = line.split_once(':') {
            headers.insert(name.trim().to_ascii_lowercase(), value.trim().to_string());
        }
    }
    let content_length = headers
        .get("content-length")
        .map(|value| value.parse::<usize>())
        .transpose()
        .map_err(|error| format!("invalid content length: {error}"))?
        .unwrap_or(0);
    let expected = header_end + content_length;
    while bytes.len() < expected {
        let mut chunk = [0u8; 4096];
        let read = stream
            .read(&mut chunk)
            .await
            .map_err(|error| format!("read request body: {error}"))?;
        if read == 0 {
            return Err("request ended before body".to_string());
        }
        bytes.extend_from_slice(&chunk[..read]);
    }
    Ok((
        method,
        target,
        headers,
        bytes[header_end..expected].to_vec(),
    ))
}

fn multipart_save_file(
    headers: &HashMap<String, String>,
    body: &[u8],
    filename: &str,
) -> Result<Vec<u8>, String> {
    let content_type = headers
        .get("content-type")
        .ok_or_else(|| "save upload did not include Content-Type".to_string())?;
    let boundary = content_type
        .split(';')
        .find_map(|part| part.trim().strip_prefix("boundary="))
        .map(|value| value.trim_matches('"'))
        .ok_or_else(|| "save upload did not include a multipart boundary".to_string())?;
    let marker = format!("--{boundary}").into_bytes();
    let start = body
        .windows(marker.len())
        .position(|window| window == marker)
        .ok_or_else(|| "save upload did not contain its multipart boundary".to_string())?
        + marker.len();
    let headers_start = start + 2;
    let closing_marker = [b"\r\n".as_slice(), marker.as_slice()].concat();
    let section_end = body[headers_start..]
        .windows(closing_marker.len())
        .position(|window| window == closing_marker.as_slice())
        .ok_or_else(|| "save upload multipart section was incomplete".to_string())?
        + headers_start;
    let header_end = body[headers_start..section_end]
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .ok_or_else(|| "save upload multipart headers were incomplete".to_string())?
        + headers_start;
    let part_headers = std::str::from_utf8(&body[headers_start..header_end])
        .map_err(|error| format!("save upload multipart headers were not UTF-8: {error}"))?;
    if !part_headers.contains("name=\"saveFile\"")
        || !part_headers.contains(&format!("filename=\"{filename}\""))
    {
        return Err("save upload used the wrong multipart field or filename".to_string());
    }
    Ok(body[header_end + 4..section_end].to_vec())
}

async fn write_json(
    stream: &mut tokio::net::TcpStream,
    status: u16,
    value: &serde_json::Value,
) -> Result<(), String> {
    let body =
        serde_json::to_vec(value).map_err(|error| format!("serialize fixture JSON: {error}"))?;
    write_response(stream, status, &body, "application/json").await
}

async fn write_response(
    stream: &mut tokio::net::TcpStream,
    status: u16,
    body: &[u8],
    content_type: &str,
) -> Result<(), String> {
    let reason = match status {
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        401 => "Unauthorized",
        404 => "Not Found",
        _ => "Error",
    };
    let response = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream
        .write_all(response.as_bytes())
        .await
        .map_err(|error| format!("write fixture headers: {error}"))?;
    stream
        .write_all(body)
        .await
        .map_err(|error| format!("write fixture body: {error}"))
}

fn local_save_dir(root: &Path) -> PathBuf {
    root.join("eden/nand/user/save/0000000000000001/00000000000000000000000000000001")
        .join(TITLE_ID)
}

fn restored_game(db: &Database) -> Game {
    db.insert_platform(&Platform::new("switch", "Switch", vec![".nsp"]))
        .unwrap();
    let mut game = Game::new(
        "Fixture Game".to_string(),
        format!("Fixture Game [{TITLE_ID}].nsp"),
        "switch".to_string(),
    );
    game.romm_id = Some(ROM_ID);
    game.id = db.insert_game(&game).unwrap();
    game
}

#[tokio::test]
async fn eden_save_sync_round_trips_upload_discovery_archive_and_safe_restore() {
    let temp = TempDir::new().unwrap();
    let local_save_dir = local_save_dir(temp.path());
    std::fs::create_dir_all(local_save_dir.join("nested")).unwrap();
    std::fs::write(local_save_dir.join("main.dat"), b"uploaded save bytes").unwrap();
    std::fs::write(local_save_dir.join("nested/slot.dat"), b"nested save bytes").unwrap();
    let upload_path = temp.path().join("upload.zip");
    zip_title_folder(&local_save_dir, TITLE_ID, &upload_path).unwrap();

    let fixture = RomMFixture::start().await;
    let client = RomMClient::new(fixture.base_url.clone()).with_token(TOKEN.to_string());
    let uploaded = client
        .upload_save_device(
            ROM_ID,
            "eden",
            DEVICE_ID,
            Some("autosave"),
            std::fs::read(&upload_path).unwrap(),
            SAVE_FILE_NAME,
            false,
        )
        .await
        .unwrap();
    assert_eq!(uploaded.id, SAVE_ID);
    let uploaded_archive = fixture.state.lock().unwrap().uploaded.clone().unwrap();
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(uploaded_archive)).unwrap();
    let mut main = Vec::new();
    archive
        .by_name(&format!("{TITLE_ID}/main.dat"))
        .unwrap()
        .read_to_end(&mut main)
        .unwrap();
    assert_eq!(main, b"uploaded save bytes");
    let mut nested = Vec::new();
    archive
        .by_name(&format!("{TITLE_ID}/nested/slot.dat"))
        .unwrap()
        .read_to_end(&mut nested)
        .unwrap();
    assert_eq!(nested, b"nested save bytes");

    let saves = client.get_saves(ROM_ID).await.unwrap();
    assert_eq!(saves.len(), 1);
    assert_eq!(saves[0].id, SAVE_ID);
    assert_eq!(saves[0].file_name, SAVE_FILE_NAME);

    let db_path = temp.path().join("wingosy.db");
    let db = Database::open_at(&db_path).unwrap();
    let game = restored_game(&db);
    let mut config = AppConfig::default();
    config.emulators.eden_save_root = Some(temp.path().join("eden/nand/user/save"));
    config.romm.sync_saves = true;
    config.romm.server_url = Some(fixture.base_url.clone());
    config.romm.auth_token = Some(TOKEN.to_string());
    config.romm.device_id = Some(DEVICE_ID.to_string());

    std::fs::write(local_save_dir.join("main.dat"), b"stale local bytes").unwrap();
    std::fs::write(local_save_dir.join("stale.dat"), b"must be replaced").unwrap();
    restore_switch_save_to_eden_with_title_id(
        &game,
        &mut config,
        Some(DEFAULT_SAVE_SLOT.to_string()),
        Some(SAVE_ID),
        TITLE_ID,
        &client,
        DEVICE_ID,
        &db,
    )
    .await
    .unwrap();
    assert_eq!(
        std::fs::read(local_save_dir.join("main.dat")).unwrap(),
        b"uploaded save bytes"
    );
    assert_eq!(
        std::fs::read(local_save_dir.join("nested/slot.dat")).unwrap(),
        b"nested save bytes"
    );
    assert!(!local_save_dir.join("stale.dat").exists());
    assert_eq!(fixture.state.lock().unwrap().confirmed_downloads, 1);

    let initial_protection = db
        .get_eden_restore_protection(game.id, DEFAULT_SAVE_SLOT)
        .unwrap()
        .unwrap();
    assert_eq!(initial_protection.selected_revision.id, SAVE_ID);
    assert_eq!(
        initial_protection.baseline_fingerprint,
        fingerprint_title_folder(&local_save_dir).unwrap()
    );

    // Rewriting identical contents changes filesystem metadata but not the
    // stable baseline, so restoring the current protected revision is a no-op.
    std::fs::write(local_save_dir.join("main.dat"), b"uploaded save bytes").unwrap();
    assert_eq!(
        fingerprint_title_folder(&local_save_dir).unwrap(),
        initial_protection.baseline_fingerprint
    );
    restore_switch_save_to_eden_with_title_id(
        &game,
        &mut config,
        Some(DEFAULT_SAVE_SLOT.to_string()),
        Some(SAVE_ID),
        TITLE_ID,
        &client,
        DEVICE_ID,
        &db,
    )
    .await
    .unwrap();
    assert_eq!(fixture.state.lock().unwrap().confirmed_downloads, 2);

    // Protection survives reopening the database and a no-change Eden session.
    // It avoids both a newer-server download and an unchanged autosave upload.
    drop(db);
    let db = Database::open_at(&db_path).unwrap();
    let successful_uploads = fixture.state.lock().unwrap().device_uploads;
    let confirmed_downloads = fixture.state.lock().unwrap().confirmed_downloads;
    assert!(pre_launch_sync_result(&game, &mut config, &db)
        .await
        .unwrap()
        .unwrap()
        .message
        .contains("explicitly restored revision"));
    assert!(post_launch_sync_result(&game, &mut config, &db)
        .await
        .unwrap()
        .unwrap()
        .message
        .contains("explicitly restored revision"));
    assert_eq!(
        fixture.state.lock().unwrap().device_uploads,
        successful_uploads
    );
    assert_eq!(
        fixture.state.lock().unwrap().confirmed_downloads,
        confirmed_downloads
    );
    assert_eq!(
        db.get_eden_restore_protection(game.id, DEFAULT_SAVE_SLOT)
            .unwrap()
            .unwrap()
            .baseline_fingerprint,
        initial_protection.baseline_fingerprint
    );

    std::fs::write(local_save_dir.join("main.dat"), b"changed after restore").unwrap();
    fixture.fail_device_upload(503, b"fixture offline upload");
    assert!(post_launch_sync_result(&game, &mut config, &db)
        .await
        .is_err());
    assert_eq!(
        db.get_eden_restore_protection(game.id, DEFAULT_SAVE_SLOT)
            .unwrap()
            .unwrap()
            .baseline_fingerprint,
        initial_protection.baseline_fingerprint
    );

    // A successful manual upload supersedes the protected local save set.
    fixture.expect_device_upload_slot("before-boss");
    let explicit_upload =
        upload_switch_save_from_eden(&game, &mut config, Some("before-boss".to_string()), &db)
            .await
            .unwrap();
    assert!(explicit_upload.romm_save_id.unwrap() > SAVE_ID);
    assert!(db
        .get_eden_restore_protection(game.id, DEFAULT_SAVE_SLOT)
        .unwrap()
        .is_none());

    // Changed restored contents use the automatic autosave channel and release
    // protection only after that upload succeeds.
    fixture.expect_device_upload_slot(DEFAULT_SAVE_SLOT);
    db.set_eden_restore_protection(&initial_protection).unwrap();
    let automatic_upload = post_launch_sync_result(&game, &mut config, &db)
        .await
        .unwrap()
        .unwrap();
    assert!(automatic_upload.romm_save_id.unwrap() > SAVE_ID);
    assert!(db
        .get_eden_restore_protection(game.id, DEFAULT_SAVE_SLOT)
        .unwrap()
        .is_none());

    db.set_eden_restore_protection(&initial_protection).unwrap();
    db.conn
        .lock()
        .unwrap()
        .execute_batch(
            "CREATE TRIGGER reject_restore_protection_delete BEFORE DELETE ON eden_restore_protections BEGIN SELECT RAISE(ABORT, 'fixture resume failure'); END;",
        )
        .unwrap();
    assert!(resume_switch_save_normal_sync(&game, &db).is_err());
    assert!(db
        .get_eden_restore_protection(game.id, DEFAULT_SAVE_SLOT)
        .unwrap()
        .is_some());
    db.conn
        .lock()
        .unwrap()
        .execute_batch("DROP TRIGGER reject_restore_protection_delete")
        .unwrap();
    resume_switch_save_normal_sync(&game, &db).unwrap();
    assert!(db
        .get_eden_restore_protection(game.id, DEFAULT_SAVE_SLOT)
        .unwrap()
        .is_none());

    let mut replaced_protection = initial_protection.clone();
    replaced_protection.selected_revision.id = 99;
    replaced_protection.baseline_fingerprint = "sha256:previous".to_string();
    db.set_eden_restore_protection(&replaced_protection)
        .unwrap();
    std::fs::write(
        local_save_dir.join("main.dat"),
        b"stale before acknowledgement",
    )
    .unwrap();
    fixture.fail_download_confirmation(500, b"fixture acknowledgement failure");
    assert!(restore_switch_save_to_eden_with_title_id(
        &game,
        &mut config,
        Some(DEFAULT_SAVE_SLOT.to_string()),
        Some(SAVE_ID),
        TITLE_ID,
        &client,
        DEVICE_ID,
        &db,
    )
    .await
    .is_err());
    let acknowledged_later = db
        .get_eden_restore_protection(game.id, DEFAULT_SAVE_SLOT)
        .unwrap()
        .unwrap();
    assert_eq!(acknowledged_later.selected_revision.id, SAVE_ID);
    assert_eq!(
        acknowledged_later.baseline_fingerprint,
        fingerprint_title_folder(&local_save_dir).unwrap()
    );

    std::fs::write(
        local_save_dir.join("main.dat"),
        b"preserve on database failure",
    )
    .unwrap();
    std::fs::write(local_save_dir.join("keep.dat"), b"keep this too").unwrap();
    db.conn
        .lock()
        .unwrap()
        .execute_batch(
            "CREATE TRIGGER reject_restore_protection_update BEFORE UPDATE ON eden_restore_protections BEGIN SELECT RAISE(ABORT, 'fixture protection failure'); END;",
        )
        .unwrap();
    assert!(restore_switch_save_to_eden_with_title_id(
        &game,
        &mut config,
        Some(DEFAULT_SAVE_SLOT.to_string()),
        Some(SAVE_ID),
        TITLE_ID,
        &client,
        DEVICE_ID,
        &db,
    )
    .await
    .is_err());
    assert_eq!(
        std::fs::read(local_save_dir.join("main.dat")).unwrap(),
        b"preserve on database failure"
    );
    assert_eq!(
        std::fs::read(local_save_dir.join("keep.dat")).unwrap(),
        b"keep this too"
    );
    assert_eq!(
        db.get_eden_restore_protection(game.id, DEFAULT_SAVE_SLOT)
            .unwrap()
            .unwrap()
            .baseline_fingerprint,
        acknowledged_later.baseline_fingerprint
    );
    db.conn
        .lock()
        .unwrap()
        .execute_batch("DROP TRIGGER reject_restore_protection_update")
        .unwrap();

    std::fs::write(
        local_save_dir.join("main.dat"),
        b"preserve on invalid archive",
    )
    .unwrap();
    std::fs::write(local_save_dir.join("keep.dat"), b"keep this too").unwrap();
    fixture.invalidate_next_download();
    assert!(restore_switch_save_to_eden_with_title_id(
        &game,
        &mut config,
        Some(DEFAULT_SAVE_SLOT.to_string()),
        Some(SAVE_ID),
        TITLE_ID,
        &client,
        DEVICE_ID,
        &db,
    )
    .await
    .is_err());
    assert_eq!(
        std::fs::read(local_save_dir.join("main.dat")).unwrap(),
        b"preserve on invalid archive"
    );
    assert_eq!(
        std::fs::read(local_save_dir.join("keep.dat")).unwrap(),
        b"keep this too"
    );
    assert_eq!(
        db.get_eden_restore_protection(game.id, DEFAULT_SAVE_SLOT)
            .unwrap()
            .unwrap()
            .baseline_fingerprint,
        acknowledged_later.baseline_fingerprint
    );
    assert_eq!(fixture.state.lock().unwrap().confirmed_downloads, 2);

    fixture.stop().await;
}

#[tokio::test]
async fn generic_save_upload_uses_canonical_romm_contract() {
    let fixture = RomMFixture::start().await;
    let client = RomMClient::new(fixture.base_url.clone()).with_token(TOKEN.to_string());

    client
        .upload_save(ROM_ID, MANUAL_SAVE_CONTENT.to_vec(), MANUAL_SAVE_FILE_NAME)
        .await
        .unwrap();

    assert_eq!(
        fixture.state.lock().unwrap().manual_upload.as_deref(),
        Some(MANUAL_SAVE_CONTENT)
    );
    fixture.stop().await;
}

#[tokio::test]
async fn generic_save_upload_reports_http_failure_details() {
    let fixture = RomMFixture::start().await;
    let rejection = format!(
        "fixture rejected generic upload: {}{}",
        "a".repeat(266),
        "é".repeat(20)
    );
    fixture.fail_manual_upload(422, rejection.as_bytes());
    let client = RomMClient::new(fixture.base_url.clone()).with_token(TOKEN.to_string());

    let error = client
        .upload_save(ROM_ID, MANUAL_SAVE_CONTENT.to_vec(), MANUAL_SAVE_FILE_NAME)
        .await
        .unwrap_err();

    let error = error.to_string();
    assert!(error.contains("Upload returned 422"));
    assert!(error.contains("fixture rejected generic upload"));
    assert!(error.contains('é'));
    fixture.stop().await;
}

fn library_rom(id: i32, name: &str, platform_slug: &str) -> serde_json::Value {
    serde_json::json!({
        "id": id,
        "platform_id": 11,
        "platform_slug": platform_slug,
        "name": name,
        "fs_name": format!("{name}.gba"),
        "fs_size_bytes": 1024,
    })
}

fn romm_game(id: i32, name: &str, platform_id: &str) -> Game {
    let mut game = Game::new(
        name.to_string(),
        format!("{name}.gba"),
        platform_id.to_string(),
    );
    game.source = GameSource::RomM;
    game.romm_id = Some(id);
    game.sync_state = SyncState::RemoteOnly;
    game
}

fn library_fixture_platform(id: i32, slug: &str, rom_count: usize) -> serde_json::Value {
    serde_json::json!({
        "id": id,
        "slug": slug,
        "name": slug,
        "display_name": slug.to_uppercase(),
        "rom_count": rom_count,
    })
}

#[tokio::test]
async fn scoped_library_sync_applies_all_pages_and_preserves_personal_and_unrelated_state() {
    let fixture = RomMFixture::start().await;
    let mut roms = vec![library_rom(1000, "Updated game", "gba")];
    roms.extend((1001..1501).map(|id| library_rom(id, &format!("Game {id}"), "gba")));
    fixture.configure_library(
        vec![library_fixture_platform(11, "gba", roms.len())],
        11,
        roms,
    );

    let db = Database::open_in_memory().unwrap();
    db.insert_platform(&Platform::new("gba", "GBA", vec![".gba"]))
        .unwrap();
    db.insert_platform(&Platform::new("snes", "SNES", vec![".sfc"]))
        .unwrap();

    let mut preserved = romm_game(1000, "Original name", "gba");
    preserved.local_file_path = Some("/known/gba/updated.gba".to_string());
    preserved.is_favorite = true;
    preserved.is_hidden = true;
    preserved.play_count = 7;
    preserved.play_time_minutes = 123;
    preserved.personal_rating = 4;
    preserved.personal_difficulty = 3;
    db.insert_game(&preserved).unwrap();

    let stale_id = db
        .insert_game(&romm_game(9999, "Stale game", "gba"))
        .unwrap();
    let unrelated_id = db
        .insert_game(&romm_game(8888, "Other platform", "snes"))
        .unwrap();
    db.insert_game(&Game::new(
        "Local source".to_string(),
        "local.gba".to_string(),
        "gba".to_string(),
    ))
    .unwrap();

    let client = RomMClient::new(fixture.base_url.clone()).with_token(TOKEN.to_string());
    let result =
        crate::commands::sync_romm_platform_with_client(None, &client, &fixture.base_url, &db, 11)
            .await
            .unwrap();

    assert_eq!(result.games_added, 500);
    assert_eq!(result.games_updated, 1);
    assert_eq!(result.games_deleted, 1);
    assert_eq!(result.total_games, 501);
    assert!(db.get_game(stale_id).unwrap().is_none());
    assert!(db.get_game(unrelated_id).unwrap().is_some());
    assert!(db
        .get_all_games_including_hidden()
        .unwrap()
        .iter()
        .any(|game| game.name == "Local source" && game.source == GameSource::Local));

    let preserved = db.get_game_by_romm_id(1000).unwrap().unwrap();
    assert_eq!(preserved.name, "Updated game");
    assert_eq!(
        preserved.local_file_path.as_deref(),
        Some("/known/gba/updated.gba")
    );
    assert!(preserved.is_favorite);
    assert!(preserved.is_hidden);
    assert_eq!(preserved.play_count, 7);
    assert_eq!(preserved.play_time_minutes, 123);
    assert_eq!(preserved.personal_rating, 4);
    assert_eq!(preserved.personal_difficulty, 3);
    assert!(db.get_dirty_games().unwrap().is_empty());

    fixture.stop().await;
}

#[tokio::test]
async fn interrupted_later_page_does_not_prune_partial_scoped_results() {
    let fixture = RomMFixture::start().await;
    let roms = (2000..2501)
        .map(|id| library_rom(id, &format!("Game {id}"), "gba"))
        .collect::<Vec<_>>();
    fixture.configure_library(
        vec![library_fixture_platform(11, "gba", roms.len())],
        11,
        roms,
    );
    fixture.fail_library_page_from_offset(500);

    let db = Database::open_in_memory().unwrap();
    db.insert_platform(&Platform::new("gba", "GBA", vec![".gba"]))
        .unwrap();
    let stale_id = db
        .insert_game(&romm_game(9998, "Must survive failure", "gba"))
        .unwrap();

    let client = RomMClient::new(fixture.base_url.clone()).with_token(TOKEN.to_string());
    let error =
        crate::commands::sync_romm_platform_with_client(None, &client, &fixture.base_url, &db, 11)
            .await
            .unwrap_err();

    assert!(error.contains("ROMs API returned 500"));
    assert!(db.get_game(stale_id).unwrap().is_some());
    assert!(db.get_game_by_romm_id(2000).unwrap().is_some());
    assert!(db.get_dirty_games().unwrap().is_empty());

    fixture.stop().await;
}

#[tokio::test]
async fn scoped_sync_rejects_ambiguous_remote_platform_mapping() {
    let fixture = RomMFixture::start().await;
    fixture.configure_library(
        vec![
            library_fixture_platform(11, "gba", 1),
            library_fixture_platform(12, "game-boy-advance", 1),
        ],
        11,
        vec![library_rom(3000, "Ambiguous", "gba")],
    );

    let db = Database::open_in_memory().unwrap();
    db.insert_platform(&Platform::new("gba", "GBA", vec![".gba"]))
        .unwrap();
    let stale_id = db
        .insert_game(&romm_game(9997, "Ambiguous stale", "gba"))
        .unwrap();

    let client = RomMClient::new(fixture.base_url.clone()).with_token(TOKEN.to_string());
    let error =
        crate::commands::sync_romm_platform_with_client(None, &client, &fixture.base_url, &db, 11)
            .await
            .unwrap_err();

    assert!(error.contains("use Sync all instead"));
    assert!(db.get_game(stale_id).unwrap().is_some());
    assert!(db.get_dirty_games().unwrap().is_empty());

    fixture.stop().await;
}

#[tokio::test]
async fn overlapping_full_sync_returns_busy_without_a_second_pruning_pass() {
    let fixture = RomMFixture::start().await;
    fixture.configure_library(
        vec![library_fixture_platform(11, "gba", 1)],
        11,
        vec![library_rom(4000, "Current game", "gba")],
    );
    let started = Arc::new(Notify::new());
    let release = Arc::new(Notify::new());
    fixture.hold_first_library_rom_request(Arc::clone(&started), Arc::clone(&release));

    let db = Database::open_in_memory().unwrap();
    db.insert_platform(&Platform::new("gba", "GBA", vec![".gba"]))
        .unwrap();
    let stale_id = db
        .insert_game(&romm_game(4999, "Removed game", "gba"))
        .unwrap();

    let fixture_url = fixture.base_url.clone();
    let client = RomMClient::new(fixture_url.clone()).with_token(TOKEN.to_string());
    let first_sync =
        crate::commands::sync_romm_library_with_client_guarded(&client, &fixture_url, &db);
    tokio::pin!(first_sync);
    tokio::select! {
        _ = &mut first_sync => panic!("first full sync completed before the overlap check"),
        _ = started.notified() => {}
    }

    let busy = crate::commands::sync_romm_library_with_client_guarded(&client, &fixture_url, &db)
        .await
        .unwrap_err();
    assert_eq!(busy, crate::commands::ROMM_SYNC_BUSY_ERROR);
    assert_eq!(fixture.library_rom_request_count(), 1);
    assert!(db.get_game(stale_id).unwrap().is_some());

    release.notify_one();
    first_sync.await.unwrap();
    assert_eq!(fixture.library_rom_request_count(), 1);
    assert!(db.get_game(stale_id).unwrap().is_none());

    fixture.stop().await;
}

#[tokio::test]
async fn full_library_sync_prunes_orphans_and_keeps_array_response() {
    let fixture = RomMFixture::start().await;
    fixture.configure_library(
        vec![library_fixture_platform(11, "gba", 1)],
        11,
        vec![library_rom(4000, "Current game", "gba")],
    );

    let db = Database::open_in_memory().unwrap();
    db.insert_platform(&Platform::new("gba", "GBA", vec![".gba"]))
        .unwrap();
    let stale_id = db
        .insert_game(&romm_game(4999, "Removed game", "gba"))
        .unwrap();

    let client = RomMClient::new(fixture.base_url.clone()).with_token(TOKEN.to_string());
    let games = crate::commands::sync_romm_library_with_client(&client, &fixture.base_url, &db)
        .await
        .unwrap();

    assert_eq!(games.len(), 1);
    assert_eq!(games[0].romm_id, Some(4000));
    assert!(db.get_game(stale_id).unwrap().is_none());
    assert!(db.get_dirty_games().unwrap().is_empty());

    fixture.stop().await;
}
