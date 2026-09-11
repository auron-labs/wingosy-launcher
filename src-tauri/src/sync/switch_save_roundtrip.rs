use crate::api::RomMClient;
use crate::sync::switch_save::{unzip_into_title_folder, zip_title_folder};
use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tempfile::TempDir;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::oneshot;

const ROM_ID: i32 = 42;
const SAVE_ID: i32 = 7;
const DEVICE_ID: &str = "fixture-device";
const TOKEN: &str = "fixture-token";
const TITLE_ID: &str = "0100ABCD00000001";
const SAVE_FILE_NAME: &str = "Fixture Game.zip";

#[derive(Default)]
struct FixtureState {
    uploaded: Option<Vec<u8>>,
    invalid_download: bool,
    confirmed_downloads: usize,
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
        ("POST", "/api/saves") => {
            require_query(&query, "rom_id", "42")?;
            require_query(&query, "emulator", "eden")?;
            require_query(&query, "device_id", DEVICE_ID)?;
            require_query(&query, "slot", "autosave")?;
            require_query(&query, "overwrite", "false")?;
            require_query(&query, "autocleanup", "true")?;
            require_query(&query, "autocleanup_limit", "10")?;
            let uploaded = multipart_save_file(&headers, &body)?;
            let size = uploaded.len();
            state.lock().unwrap().uploaded = Some(uploaded);
            let response = serde_json::json!({
                "id": SAVE_ID,
                "rom_id": ROM_ID,
                "file_name": SAVE_FILE_NAME,
                "file_size_bytes": size,
                "emulator": "eden",
                "created_at": "2026-01-01T00:00:00Z",
                "updated_at": "2026-01-01T00:00:00Z",
                "slot": "autosave"
            });
            write_json(stream, 200, &response).await?;
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
            state.lock().unwrap().confirmed_downloads += 1;
            write_response(stream, 204, &[], "text/plain").await?;
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

fn multipart_save_file(headers: &HashMap<String, String>, body: &[u8]) -> Result<Vec<u8>, String> {
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
        || !part_headers.contains("filename=\"Fixture Game.zip\"")
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

    std::fs::write(local_save_dir.join("main.dat"), b"stale local bytes").unwrap();
    std::fs::write(local_save_dir.join("stale.dat"), b"must be replaced").unwrap();
    let downloaded = client
        .download_save_content_device(&saves[0], DEVICE_ID)
        .await
        .unwrap();
    let download_path = temp.path().join("download.zip");
    std::fs::write(&download_path, downloaded).unwrap();
    unzip_into_title_folder(&download_path, &local_save_dir).unwrap();
    client
        .confirm_save_downloaded(SAVE_ID, DEVICE_ID)
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

    std::fs::write(
        local_save_dir.join("main.dat"),
        b"preserve on invalid archive",
    )
    .unwrap();
    std::fs::write(local_save_dir.join("keep.dat"), b"keep this too").unwrap();
    fixture.invalidate_next_download();
    let invalid = client
        .download_save_content_device(&saves[0], DEVICE_ID)
        .await
        .unwrap();
    std::fs::write(&download_path, invalid).unwrap();
    assert!(unzip_into_title_folder(&download_path, &local_save_dir).is_err());
    assert_eq!(
        std::fs::read(local_save_dir.join("main.dat")).unwrap(),
        b"preserve on invalid archive"
    );
    assert_eq!(
        std::fs::read(local_save_dir.join("keep.dat")).unwrap(),
        b"keep this too"
    );
    assert_eq!(fixture.state.lock().unwrap().confirmed_downloads, 1);

    fixture.stop().await;
}
