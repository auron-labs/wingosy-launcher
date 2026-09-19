use crate::{
    api::{download::DownloadProgress, download::DownloadRateEstimator, RomMClient, RomMFirmware},
    config::{AppConfig, EmulatorPaths, RetroArchInstallKind},
    models::map_romm_slug,
    sync::switch_content::replace_file,
};
use aes::{
    cipher::{BlockCipherDecrypt, BlockCipherEncrypt, KeyInit},
    Aes128, Block,
};
use anyhow::{Context, Result};
use serde::Serialize;
use std::{
    collections::{HashMap, HashSet, VecDeque},
    fs::File,
    future::Future,
    io::{Read, Write},
    path::{Path, PathBuf},
    pin::Pin,
    sync::{Arc, Mutex, OnceLock},
    time::Instant,
};
use tauri::{AppHandle, Emitter};
use tokio::{io::AsyncWriteExt, sync::watch, task::JoinSet};
use zip::ZipArchive;

const BIOS_DOWNLOAD_CONCURRENCY: usize = 3;

type BiosDownloadResult = std::result::Result<PathBuf, String>;
type BiosDownloadWork = Pin<Box<dyn Future<Output = BiosDownloadResult> + Send>>;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct BiosDownloadKey {
    transfer_id: String,
    destination: PathBuf,
}

struct QueuedBiosDownload {
    key: BiosDownloadKey,
    result: watch::Sender<Option<BiosDownloadResult>>,
    work: Mutex<Option<BiosDownloadWork>>,
}

struct PendingBiosDownload {
    job: Arc<QueuedBiosDownload>,
    ready: bool,
}

struct BiosDownloadSubmission {
    is_new: bool,
    queued: bool,
    receiver: watch::Receiver<Option<BiosDownloadResult>>,
}

struct BiosDownloadQueueState {
    active_count: usize,
    active_destinations: HashSet<PathBuf>,
    jobs_by_key: HashMap<BiosDownloadKey, Arc<QueuedBiosDownload>>,
    pending: VecDeque<PendingBiosDownload>,
}

#[derive(Clone)]
struct BiosDownloadQueue {
    concurrency: usize,
    state: Arc<Mutex<BiosDownloadQueueState>>,
}

impl BiosDownloadQueue {
    fn new(concurrency: usize) -> Self {
        assert!(
            concurrency > 0,
            "BIOS download concurrency must be positive"
        );
        Self {
            concurrency,
            state: Arc::new(Mutex::new(BiosDownloadQueueState {
                active_count: 0,
                active_destinations: HashSet::new(),
                jobs_by_key: HashMap::new(),
                pending: VecDeque::new(),
            })),
        }
    }

    fn submit(&self, key: BiosDownloadKey, work: BiosDownloadWork) -> BiosDownloadSubmission {
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some(job) = state.jobs_by_key.get(&key) {
            return BiosDownloadSubmission {
                is_new: false,
                queued: false,
                receiver: job.result.subscribe(),
            };
        }
        let queued = state.active_count >= self.concurrency
            || !state.pending.is_empty()
            || state.active_destinations.contains(&key.destination)
            || state
                .pending
                .iter()
                .any(|job| job.job.key.destination == key.destination);
        let (result, receiver) = watch::channel(None);
        let job = Arc::new(QueuedBiosDownload {
            key: key.clone(),
            result,
            work: Mutex::new(Some(work)),
        });
        state.jobs_by_key.insert(key.clone(), Arc::clone(&job));
        state
            .pending
            .push_back(PendingBiosDownload { job, ready: false });
        BiosDownloadSubmission {
            is_new: true,
            queued,
            receiver,
        }
    }

    fn activate(&self, key: &BiosDownloadKey) {
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let Some(pending) = state
            .pending
            .iter_mut()
            .find(|pending| &pending.job.key == key)
        else {
            return;
        };
        pending.ready = true;
        drop(state);
        self.start_pending();
    }

    fn start_pending(&self) {
        loop {
            let job = {
                let mut state = self
                    .state
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
                if state.active_count >= self.concurrency {
                    return;
                }
                let Some(index) = state.pending.iter().position(|pending| {
                    pending.ready
                        && !state
                            .active_destinations
                            .contains(&pending.job.key.destination)
                }) else {
                    return;
                };
                let job = state
                    .pending
                    .remove(index)
                    .expect("queued BIOS download must remain pending");
                state.active_count += 1;
                state
                    .active_destinations
                    .insert(job.job.key.destination.clone());
                job.job
            };
            let queue = self.clone();
            tokio::spawn(async move {
                queue.run(job).await;
            });
        }
    }

    async fn run(&self, job: Arc<QueuedBiosDownload>) {
        let work = job
            .work
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .take()
            .expect("queued BIOS download must have work");
        let result = work.await;

        {
            let mut state = self
                .state
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            state.active_count -= 1;
            state.active_destinations.remove(&job.key.destination);
            state.jobs_by_key.remove(&job.key);
        }
        job.result.send_replace(Some(result));
        self.start_pending();
    }

    async fn wait_for_result(
        mut receiver: watch::Receiver<Option<BiosDownloadResult>>,
    ) -> Result<PathBuf> {
        loop {
            if let Some(result) = receiver.borrow().clone() {
                return result.map_err(anyhow::Error::msg);
            }
            receiver
                .changed()
                .await
                .map_err(|_| anyhow::anyhow!("BIOS download queue stopped unexpectedly"))?;
        }
    }
}

fn bios_download_queue() -> &'static BiosDownloadQueue {
    static QUEUE: OnceLock<BiosDownloadQueue> = OnceLock::new();
    QUEUE.get_or_init(|| BiosDownloadQueue::new(BIOS_DOWNLOAD_CONCURRENCY))
}

#[derive(Debug, Clone)]
struct FirmwareRecord {
    platform_slug: String,
    platform_name: String,
    firmware: RomMFirmware,
}

#[derive(Debug, Clone, Serialize)]
struct BiosDownloadEvent {
    transfer_id: String,
    firmware_id: i64,
    platform_slug: String,
    platform_name: String,
    file_name: String,
    downloaded: Option<u64>,
    total: Option<u64>,
    percent: Option<u8>,
    speed: Option<String>,
    path: Option<String>,
    message: Option<String>,
}

impl BiosDownloadEvent {
    fn for_record(record: &FirmwareRecord) -> Self {
        Self {
            transfer_id: bios_transfer_id(record),
            firmware_id: record.firmware.id,
            platform_slug: record.platform_slug.clone(),
            platform_name: record.platform_name.clone(),
            file_name: record.firmware.file_name.clone(),
            downloaded: Some(0),
            total: None,
            percent: None,
            speed: None,
            path: None,
            message: None,
        }
    }

    fn with_progress(mut self, progress: DownloadProgress, include_speed: bool) -> Self {
        self.downloaded = Some(progress.downloaded);
        self.total = progress.total;
        self.percent = progress.percent;
        self.speed = include_speed
            .then(|| progress.speed.map(DownloadProgress::format_speed))
            .flatten();
        self
    }
}

fn bios_transfer_id(record: &FirmwareRecord) -> String {
    format!("bios:{}:{}", record.platform_slug, record.firmware.id)
}

fn emit_bios_download_event(app: Option<&AppHandle>, event_name: &str, event: BiosDownloadEvent) {
    let Some(app) = app else {
        return;
    };
    if let Err(error) = app.emit(event_name, event) {
        tracing::warn!("[BIOS] Failed to emit {event_name}: {error}");
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct BiosFirmwareStatus {
    pub id: i64,
    pub platform_slug: String,
    pub platform_name: String,
    pub file_name: String,
    pub file_size_bytes: u64,
    pub md5_hash: Option<String>,
    pub missing_from_fs: bool,
    pub is_downloaded: bool,
    pub local_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BiosDownloadSummary {
    pub downloaded: usize,
    pub skipped: usize,
    pub paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BiosDistributionResult {
    pub emulator_id: String,
    pub target_path: String,
    pub files_copied: usize,
}

#[derive(Debug)]
struct BiosTarget {
    emulator_id: &'static str,
    path: PathBuf,
    platform_slugs: &'static [&'static str],
    rename_for_retroarch: bool,
}

fn configured_client(config: &AppConfig) -> Result<RomMClient> {
    let server_url = config
        .romm
        .server_url
        .clone()
        .context("RomM server is not configured")?;
    let token = crate::romm_credentials::load_device_token(&server_url)?
        .or_else(|| config.romm.auth_token.clone())
        .context("RomM access token is not configured; reconnect in Settings")?;
    Ok(RomMClient::new(server_url).with_token(token))
}

fn safe_component(value: &str, label: &str) -> Result<String> {
    let path = Path::new(value);
    if path.components().count() != 1 {
        anyhow::bail!("Invalid {label}");
    }
    let component = path
        .file_name()
        .and_then(|value| value.to_str())
        .context(format!("Invalid {label}"))?;
    if component.is_empty() || component == "." || component == ".." {
        anyhow::bail!("Invalid {label}");
    }
    Ok(component.to_string())
}

fn target_path(root: &Path, record: &FirmwareRecord) -> Result<PathBuf> {
    let platform = safe_component(&record.platform_slug, "platform slug")?;
    let file_name = safe_component(&record.firmware.file_name, "firmware filename")?;
    Ok(root.join(platform).join(file_name))
}

fn switch_target_path(root: &Path, record: &FirmwareRecord) -> Result<PathBuf> {
    if map_romm_slug(&record.platform_slug) != "switch" {
        anyhow::bail!("Firmware record is not a Switch artifact");
    }
    safe_component(&record.platform_slug, "platform slug")?;
    let file_name = safe_component(&record.firmware.file_name, "firmware filename")?;
    Ok(root.join("switch").join(file_name))
}

async fn fetch_firmware(config: &AppConfig) -> Result<(RomMClient, Vec<FirmwareRecord>)> {
    let client = configured_client(config)?;
    let platforms = client.get_platforms().await?;
    let mut records = Vec::new();

    for platform in platforms {
        let platform_name = platform
            .display_name
            .clone()
            .unwrap_or_else(|| platform.name.clone());
        for firmware in platform.firmware {
            records.push(FirmwareRecord {
                platform_slug: platform.slug.clone(),
                platform_name: platform_name.clone(),
                firmware,
            });
        }
    }

    records.sort_by(|a, b| {
        a.platform_name
            .cmp(&b.platform_name)
            .then_with(|| a.firmware.file_name.cmp(&b.firmware.file_name))
    });
    Ok((client, records))
}

fn status_for(root: &Path, record: &FirmwareRecord) -> Result<BiosFirmwareStatus> {
    let path = target_path(root, record)?;
    let is_downloaded = path.is_file();
    Ok(BiosFirmwareStatus {
        id: record.firmware.id,
        platform_slug: record.platform_slug.clone(),
        platform_name: record.platform_name.clone(),
        file_name: record.firmware.file_name.clone(),
        file_size_bytes: record.firmware.file_size_bytes,
        md5_hash: record.firmware.md5_hash.clone(),
        missing_from_fs: record.firmware.missing_from_fs,
        is_downloaded,
        local_path: is_downloaded.then(|| path.to_string_lossy().into_owned()),
    })
}

fn md5_file(path: &Path) -> Result<String> {
    let mut file = File::open(path)?;
    let mut context = md5::Context::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        context.consume(&buffer[..read]);
    }
    Ok(format!("{:x}", context.finalize()))
}

fn file_is_current(path: &Path, expected_md5: Option<&str>) -> bool {
    if !path.is_file() {
        return false;
    }
    match expected_md5 {
        Some(expected) => md5_file(path)
            .map(|actual| actual.eq_ignore_ascii_case(expected))
            .unwrap_or(false),
        None => false,
    }
}

fn file_has_expected_size(path: &Path, expected_size: u64) -> bool {
    expected_size == 0
        || std::fs::metadata(path)
            .map(|metadata| metadata.len() == expected_size)
            .unwrap_or(false)
}

fn is_partial_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("part"))
}

fn file_matches_record(path: &Path, record: &FirmwareRecord) -> bool {
    if record.firmware.missing_from_fs || is_partial_file(path) {
        return false;
    }

    let Some(expected_md5) = record.firmware.md5_hash.as_deref() else {
        return false;
    };
    file_has_expected_size(path, record.firmware.file_size_bytes)
        && file_is_current(path, Some(expected_md5))
}

fn copy_staged_file(
    source: &Path,
    target: &Path,
    expected_md5: Option<&str>,
    expected_size: u64,
) -> Result<bool> {
    if (expected_md5.is_none() && expected_size == 0)
        || !source.is_file()
        || is_partial_file(source)
    {
        return Ok(false);
    }
    if expected_md5.is_some_and(|expected| !file_is_current(source, Some(expected)))
        || !file_has_expected_size(source, expected_size)
    {
        return Ok(false);
    }

    let parent = target.parent().context("BIOS destination has no parent")?;
    std::fs::create_dir_all(parent)?;
    let file_name = target
        .file_name()
        .and_then(|value| value.to_str())
        .context("Invalid BIOS destination")?;
    let partial = target.with_file_name(format!("{file_name}.part"));

    if let Err(error) = std::fs::copy(source, &partial) {
        let _ = std::fs::remove_file(&partial);
        return Err(error.into());
    }
    if expected_md5.is_some_and(|expected| !file_is_current(&partial, Some(expected)))
        || !file_has_expected_size(&partial, expected_size)
    {
        let _ = std::fs::remove_file(&partial);
        return Ok(false);
    }

    if let Err(error) = replace_file(&partial, target) {
        let _ = std::fs::remove_file(&partial);
        return Err(error);
    }
    Ok(true)
}

/// Copy a verified BIOS/firmware source through a staged path before replacing
/// the emulator's file. An unknown or invalid source is never installed.
fn distribute_file(
    source: &Path,
    target: &Path,
    expected_md5: Option<&str>,
    expected_size: u64,
) -> Result<bool> {
    let Some(expected_md5) = expected_md5 else {
        return Ok(false);
    };
    copy_staged_file(source, target, Some(expected_md5), expected_size)
}

async fn download_record(
    client: &RomMClient,
    root: &Path,
    record: &FirmwareRecord,
    app: Option<&AppHandle>,
) -> Result<PathBuf> {
    let target = target_path(root, record)?;
    download_record_at_with_queue(client, &target, record, app, bios_download_queue()).await
}

async fn download_record_at(
    client: &RomMClient,
    target: &Path,
    record: &FirmwareRecord,
    app: Option<&AppHandle>,
) -> Result<PathBuf> {
    download_record_at_with_queue(client, target, record, app, bios_download_queue()).await
}

async fn download_record_at_with_queue(
    client: &RomMClient,
    target: &Path,
    record: &FirmwareRecord,
    app: Option<&AppHandle>,
    queue: &BiosDownloadQueue,
) -> Result<PathBuf> {
    let target = resolved_destination(target)?;
    let event = BiosDownloadEvent::for_record(record);
    let key = BiosDownloadKey {
        transfer_id: event.transfer_id.clone(),
        destination: destination_lock_key(&target),
    };
    let client = client.clone();
    let record = record.clone();
    let app = app.cloned();
    let work_app = app.clone();
    let work = Box::pin(async move {
        run_download_record(client, target, record, work_app)
            .await
            .map_err(|error| error.to_string())
    });
    let submission = queue.submit(key.clone(), work);
    if submission.is_new {
        if submission.queued {
            emit_bios_download_event(app.as_ref(), "bios-download-queued", event);
        }
        queue.activate(&key);
    }
    BiosDownloadQueue::wait_for_result(submission.receiver).await
}

fn resolved_destination(target: &Path) -> Result<PathBuf> {
    let target = if target.is_absolute() {
        target.to_path_buf()
    } else {
        std::env::current_dir()?.join(target)
    };
    if let Ok(resolved) = target.canonicalize() {
        return Ok(resolved);
    }

    let mut existing_ancestor = target.as_path();
    while !existing_ancestor.exists() {
        existing_ancestor = existing_ancestor
            .parent()
            .context("Firmware destination has no existing parent")?;
    }
    let suffix = target
        .strip_prefix(existing_ancestor)
        .context("Firmware destination is outside its existing parent")?;
    Ok(existing_ancestor.canonicalize()?.join(suffix))
}

fn destination_lock_key(destination: &Path) -> PathBuf {
    if cfg!(windows) {
        return PathBuf::from(destination.to_string_lossy().to_lowercase());
    }
    destination.to_path_buf()
}

async fn run_download_record(
    client: RomMClient,
    target: PathBuf,
    record: FirmwareRecord,
    app: Option<AppHandle>,
) -> Result<PathBuf> {
    let event = BiosDownloadEvent::for_record(&record);
    emit_bios_download_event(app.as_ref(), "bios-download-started", event.clone());
    let latest_progress = Arc::new(Mutex::new(DownloadProgress::terminal(0, None)));
    let progress_event = event.clone();
    let progress_app = app.clone();
    let progress_state = Arc::clone(&latest_progress);
    let download_result = download_record_to_target(&client, &target, &record, move |progress| {
        *progress_state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = progress;
        emit_bios_download_event(
            progress_app.as_ref(),
            "bios-download-progress",
            progress_event.clone().with_progress(progress, true),
        );
    })
    .await;

    match download_result {
        Ok((path, progress)) => {
            emit_bios_download_event(
                app.as_ref(),
                "bios-download-complete",
                event
                    .with_progress(progress, false)
                    .with_path(path.to_string_lossy().into_owned()),
            );
            Ok(path)
        }
        Err(error) => {
            let progress = *latest_progress
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            emit_bios_download_event(
                app.as_ref(),
                "bios-download-error",
                event
                    .with_progress(progress, false)
                    .with_message(error.to_string()),
            );
            Err(error)
        }
    }
}

async fn download_records_at(
    client: &RomMClient,
    records: Vec<(FirmwareRecord, PathBuf)>,
    app: Option<&AppHandle>,
    queue: &BiosDownloadQueue,
) -> Result<BiosDownloadSummary> {
    let mut downloads = JoinSet::new();
    for (index, (record, path)) in records.into_iter().enumerate() {
        let client = client.clone();
        let app = app.cloned();
        let queue = queue.clone();
        downloads.spawn(async move {
            let existed = file_is_current(&path, record.firmware.md5_hash.as_deref());
            let result =
                download_record_at_with_queue(&client, &path, &record, app.as_ref(), &queue).await;
            (index, existed, result)
        });
    }

    let mut completed = Vec::new();
    let mut failure = None;
    while let Some(result) = downloads.join_next().await {
        match result {
            Ok(result) => completed.push(result),
            Err(error) if failure.is_none() => {
                failure = Some(anyhow::Error::msg(error.to_string()))
            }
            Err(_) => {}
        }
    }
    completed.sort_by_key(|(index, _, _)| *index);

    let mut summary = BiosDownloadSummary {
        downloaded: 0,
        skipped: 0,
        paths: Vec::new(),
    };
    for (_, existed, result) in completed {
        match result {
            Ok(path) => {
                if existed {
                    summary.skipped += 1;
                } else {
                    summary.downloaded += 1;
                }
                summary.paths.push(path.to_string_lossy().into_owned());
            }
            Err(error) if failure.is_none() => failure = Some(error),
            Err(_) => {}
        }
    }

    match failure {
        Some(error) => Err(error),
        None => Ok(summary),
    }
}

impl BiosDownloadEvent {
    fn with_path(mut self, path: String) -> Self {
        self.path = Some(path);
        self
    }

    fn with_message(mut self, message: String) -> Self {
        self.message = Some(message);
        self
    }
}

async fn download_record_to_target(
    client: &RomMClient,
    target: &Path,
    record: &FirmwareRecord,
    progress_callback: impl Fn(DownloadProgress),
) -> Result<(PathBuf, DownloadProgress)> {
    if record.firmware.missing_from_fs {
        anyhow::bail!(
            "{} is missing from the RomM server filesystem",
            record.firmware.file_name
        );
    }

    if file_is_current(target, record.firmware.md5_hash.as_deref())
        && file_has_expected_size(target, record.firmware.file_size_bytes)
    {
        let downloaded = std::fs::metadata(target)?.len();
        return Ok((
            target.to_path_buf(),
            DownloadProgress::terminal(downloaded, None),
        ));
    }

    let parent = target
        .parent()
        .context("Firmware destination has no parent")?;
    tokio::fs::create_dir_all(parent).await?;
    let file_name = target
        .file_name()
        .and_then(|value| value.to_str())
        .context("Invalid firmware destination")?;
    let partial = target.with_file_name(format!("{file_name}.part"));

    let stream_result: Result<DownloadProgress> = async {
        let mut response = client
            .download_firmware(record.firmware.id, &record.firmware.file_name)
            .await?;
        let total = response.content_length();
        let mut output = tokio::fs::File::create(&partial).await?;
        let mut downloaded = 0;
        let mut rate_estimator = DownloadRateEstimator::new();
        progress_callback(DownloadProgress::from_transfer(
            downloaded,
            total,
            &mut rate_estimator,
            Instant::now(),
        ));
        while let Some(chunk) = response.chunk().await? {
            output.write_all(&chunk).await?;
            downloaded += chunk.len() as u64;
            progress_callback(DownloadProgress::from_transfer(
                downloaded,
                total,
                &mut rate_estimator,
                Instant::now(),
            ));
        }
        output.flush().await?;
        Ok(DownloadProgress::terminal(downloaded, total))
    }
    .await;
    let progress = match stream_result {
        Ok(progress) => progress,
        Err(error) => {
            let _ = tokio::fs::remove_file(&partial).await;
            return Err(error);
        }
    };

    if !file_has_expected_size(&partial, record.firmware.file_size_bytes) {
        let actual_size = std::fs::metadata(&partial)
            .map(|metadata| metadata.len())
            .unwrap_or(0);
        let _ = tokio::fs::remove_file(&partial).await;
        anyhow::bail!(
            "Size mismatch for {}: expected {} bytes, got {}",
            record.firmware.file_name,
            record.firmware.file_size_bytes,
            actual_size
        );
    }

    if let Some(expected) = record.firmware.md5_hash.as_deref() {
        let actual = match md5_file(&partial) {
            Ok(actual) => actual,
            Err(error) => {
                let _ = tokio::fs::remove_file(&partial).await;
                return Err(error);
            }
        };
        if !actual.eq_ignore_ascii_case(expected) {
            let _ = tokio::fs::remove_file(&partial).await;
            anyhow::bail!(
                "MD5 mismatch for {}: expected {}, got {}",
                record.firmware.file_name,
                expected,
                actual
            );
        }
    }

    replace_file(&partial, target)?;
    Ok((target.to_path_buf(), progress))
}

#[tauri::command]
pub fn get_bios_directory() -> Result<String, String> {
    let config = AppConfig::load().unwrap_or_default();
    Ok(config.bios_dir().to_string_lossy().into_owned())
}

#[tauri::command]
pub fn set_bios_directory(path: Option<String>) -> Result<String, String> {
    let mut config = AppConfig::load().unwrap_or_default();
    config.library.bios_directory = path
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from);
    let root = config.bios_dir();
    std::fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    config.save().map_err(|error| error.to_string())?;
    Ok(root.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn list_bios_firmware() -> Result<Vec<BiosFirmwareStatus>, String> {
    let config = AppConfig::load().unwrap_or_default();
    let root = config.bios_dir();
    let (_, records) = fetch_firmware(&config)
        .await
        .map_err(|error| error.to_string())?;
    records
        .iter()
        .map(|record| status_for(&root, record).map_err(|error| error.to_string()))
        .collect()
}

#[tauri::command]
pub async fn download_bios_firmware(app: AppHandle, firmware_id: i64) -> Result<String, String> {
    let config = AppConfig::load().unwrap_or_default();
    let root = config.bios_dir();
    let (client, records) = fetch_firmware(&config)
        .await
        .map_err(|error| error.to_string())?;
    let record = records
        .iter()
        .find(|record| record.firmware.id == firmware_id)
        .context("Firmware is no longer available from RomM")
        .map_err(|error| error.to_string())?;
    download_record(&client, &root, record, Some(&app))
        .await
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn download_all_bios_firmware(app: AppHandle) -> Result<BiosDownloadSummary, String> {
    let config = AppConfig::load().unwrap_or_default();
    let root = config.bios_dir();
    let (client, records) = fetch_firmware(&config)
        .await
        .map_err(|error| error.to_string())?;
    let downloads = records
        .into_iter()
        .filter(|record| !record.firmware.missing_from_fs)
        .map(|record| {
            let path = target_path(&root, &record)?;
            Ok((record, path))
        })
        .collect::<Result<Vec<_>>>()
        .map_err(|error| error.to_string())?;
    download_records_at(&client, downloads, Some(&app), bios_download_queue())
        .await
        .map_err(|error| error.to_string())
}

fn executable_parent(path: &Option<PathBuf>) -> Option<PathBuf> {
    let executable = path.as_deref()?;
    let parent = executable.parent()?;
    executable.is_file().then_some(parent.to_path_buf())
}

fn configured_targets(paths: &EmulatorPaths) -> Vec<BiosTarget> {
    [
        ("retroarch", &paths.retroarch),
        ("duckstation", &paths.duckstation),
        ("pcsx2", &paths.pcsx2),
        ("melonds", &paths.melonds),
        ("flycast", &paths.flycast),
        ("mgba", &paths.mgba),
    ]
    .into_iter()
    .filter_map(|(emulator_id, executable)| {
        let parent = executable_parent(executable)?;
        target_from_parent(emulator_id, &parent)
    })
    .collect()
}

fn configured_executable<'a>(paths: &'a EmulatorPaths, emulator_id: &str) -> Option<&'a Path> {
    match emulator_id {
        "retroarch" => paths.retroarch.as_deref(),
        "duckstation" => paths.duckstation.as_deref(),
        "pcsx2" => paths.pcsx2.as_deref(),
        "melonds" => paths.melonds.as_deref(),
        "flycast" => paths.flycast.as_deref(),
        "mgba" => paths.mgba.as_deref(),
        _ => None,
    }
}

fn managed_emulators_root() -> Option<PathBuf> {
    AppConfig::emulators_dir().ok()?.canonicalize().ok()
}

fn is_managed_emulator_path(path: &Path, managed_root: &Path) -> bool {
    path.canonicalize()
        .map(|executable| executable.starts_with(managed_root))
        .unwrap_or(false)
}

fn configured_managed_targets(config: &AppConfig) -> Vec<BiosTarget> {
    let Some(managed_root) = managed_emulators_root() else {
        return Vec::new();
    };
    configured_targets(&config.emulators)
        .into_iter()
        .filter(|target| {
            configured_executable(&config.emulators, target.emulator_id)
                .is_some_and(|executable| is_managed_emulator_path(executable, &managed_root))
                && (target.emulator_id != "retroarch"
                    || config.emulators.retroarch_install_kind == RetroArchInstallKind::Managed)
        })
        .collect()
}

fn target_from_parent(emulator_id: &str, parent: &Path) -> Option<BiosTarget> {
    match emulator_id {
        "retroarch" => Some(BiosTarget {
            emulator_id: "retroarch",
            path: parent.join("system"),
            platform_slugs: &[],
            rename_for_retroarch: true,
        }),
        "duckstation" => Some(BiosTarget {
            emulator_id: "duckstation",
            path: parent.join("bios"),
            platform_slugs: &["psx"],
            rename_for_retroarch: false,
        }),
        "pcsx2" => Some(BiosTarget {
            emulator_id: "pcsx2",
            path: parent.join("bios"),
            platform_slugs: &["ps2"],
            rename_for_retroarch: false,
        }),
        "melonds" => Some(BiosTarget {
            emulator_id: "melonds",
            path: parent.to_path_buf(),
            platform_slugs: &["nds"],
            rename_for_retroarch: false,
        }),
        "flycast" => Some(BiosTarget {
            emulator_id: "flycast",
            path: parent.join("data"),
            platform_slugs: &["dreamcast", "dc"],
            rename_for_retroarch: false,
        }),
        "mgba" => Some(BiosTarget {
            emulator_id: "mgba",
            path: parent.to_path_buf(),
            platform_slugs: &["gba"],
            rename_for_retroarch: false,
        }),
        _ => None,
    }
}

fn launch_target(emulator_id: &str, executable: &Path) -> Option<BiosTarget> {
    if !executable.is_file() {
        return None;
    }
    let parent = executable.parent()?.to_path_buf();
    target_from_parent(emulator_id, &parent)
}

fn relevant_records<'a>(
    records: &'a [FirmwareRecord],
    target: &BiosTarget,
    game_platform_id: &str,
) -> Vec<&'a FirmwareRecord> {
    let game_platform_id = map_romm_slug(game_platform_id);
    records
        .iter()
        .filter(|record| {
            if target.emulator_id == "retroarch" {
                map_romm_slug(&record.platform_slug) == game_platform_id
            } else {
                let platform_slug = map_romm_slug(&record.platform_slug);
                target.platform_slugs.contains(&platform_slug.as_str())
            }
        })
        .collect()
}

fn target_matches_record(target: &BiosTarget, record: &FirmwareRecord) -> bool {
    target.platform_slugs.is_empty()
        || target
            .platform_slugs
            .iter()
            .any(|slug| map_romm_slug(slug) == map_romm_slug(&record.platform_slug))
}

fn cached_source_paths(root: &Path, record: &FirmwareRecord) -> Result<Vec<PathBuf>> {
    let regular = target_path(root, record)?;
    if map_romm_slug(&record.platform_slug) != "switch" {
        return Ok(vec![regular]);
    }

    let switch = switch_target_path(root, record)?;
    if switch == regular {
        Ok(vec![switch])
    } else {
        Ok(vec![switch, regular])
    }
}

fn cached_source_for_record(root: &Path, record: &FirmwareRecord) -> Result<Option<PathBuf>> {
    for path in cached_source_paths(root, record)? {
        if file_matches_record(&path, record) {
            return Ok(Some(path));
        }
    }
    Ok(None)
}

fn distribution_target_name(target: &BiosTarget, source: &Path) -> Result<String> {
    if target.rename_for_retroarch {
        return Ok(retroarch_filename(source));
    }
    source
        .file_name()
        .and_then(|value| value.to_str())
        .context("Invalid firmware destination")
        .map(str::to_string)
}

fn distribute_record(root: &Path, target: &BiosTarget, record: &FirmwareRecord) -> Result<bool> {
    if !target_matches_record(target, record) {
        return Ok(false);
    }
    let Some(source) = cached_source_for_record(root, record)? else {
        return Ok(false);
    };
    let target_name = distribution_target_name(target, &source)?;
    distribute_file(
        &source,
        &target.path.join(target_name),
        record.firmware.md5_hash.as_deref(),
        record.firmware.file_size_bytes,
    )
}

fn select_switch_record<'a>(
    records: &[&'a FirmwareRecord],
    canonical_name: &str,
    is_fallback: fn(&str) -> bool,
    label: &str,
) -> Result<Option<&'a FirmwareRecord>> {
    let mut canonical = records.iter().copied().filter(|record| {
        record
            .firmware
            .file_name
            .eq_ignore_ascii_case(canonical_name)
    });
    let selected = canonical.next();
    if canonical.next().is_some() {
        anyhow::bail!("Multiple Switch {label} records match the canonical {canonical_name}");
    }
    if selected.is_some() {
        return Ok(selected);
    }

    let mut fallbacks = records
        .iter()
        .copied()
        .filter(|record| is_fallback(&record.firmware.file_name));
    match (fallbacks.next(), fallbacks.next()) {
        (None, _) => Ok(None),
        (Some(record), None) => Ok(Some(record)),
        (Some(_), Some(_)) => {
            anyhow::bail!("Multiple Switch {label} fallback records were found")
        }
    }
}

fn switch_records(
    records: &[FirmwareRecord],
) -> Result<Option<(&FirmwareRecord, &FirmwareRecord)>> {
    let switch_records: Vec<_> = records
        .iter()
        .filter(|record| {
            map_romm_slug(&record.platform_slug) == "switch" && !record.firmware.missing_from_fs
        })
        .collect();
    let prod_keys =
        select_switch_record(&switch_records, "prod.keys", is_prod_keys_name, "prod.keys")?;
    let firmware_zip = select_switch_record(
        &switch_records,
        "firmware.zip",
        is_firmware_archive_name,
        "firmware archive",
    )?;

    match (prod_keys, firmware_zip) {
        (Some(prod_keys), Some(firmware_zip)) => Ok(Some((prod_keys, firmware_zip))),
        (None, None) => Ok(None),
        (None, Some(_)) => anyhow::bail!("No Switch prod.keys was found in the configured RomM"),
        (Some(_), None) => {
            anyhow::bail!("No Switch firmware archive was found in the configured RomM")
        }
    }
}

fn prepare_switch_firmware_for_launch(
    root: &Path,
    eden_executable: &Path,
    appdata: Option<&Path>,
) -> Result<BiosDistributionResult> {
    if !eden_executable.is_file() {
        anyhow::bail!(
            "Configured Eden executable is unavailable at {}",
            eden_executable.display()
        );
    }
    let installed = install_switch_firmware(root, eden_executable, appdata)?;
    installed.context(format!(
        "Eden Switch preparation requires prod.keys and firmware.zip in {}",
        root.join("switch").display()
    ))
}

async fn prepare_eden_firmware_for_launch(
    config: &AppConfig,
    game_platform_id: &str,
    eden_executable: &Path,
    app: Option<&AppHandle>,
) -> Result<BiosDownloadSummary> {
    if map_romm_slug(game_platform_id) != "switch" {
        return Ok(BiosDownloadSummary {
            downloaded: 0,
            skipped: 0,
            paths: Vec::new(),
        });
    }
    if !eden_executable.is_file() {
        anyhow::bail!(
            "Configured Eden executable is unavailable at {}",
            eden_executable.display()
        );
    }

    let root = config.bios_dir();
    let appdata = std::env::var_os("APPDATA").map(PathBuf::from);
    if let Ok(Some((prod_keys_path, firmware_zip_path))) = switch_firmware_files(&root) {
        match install_switch_firmware_from_files(
            &prod_keys_path,
            &firmware_zip_path,
            eden_executable,
            appdata.as_deref(),
        ) {
            Ok(Some(_)) => {
                return Ok(BiosDownloadSummary {
                    downloaded: 0,
                    skipped: 2,
                    paths: vec![
                        prod_keys_path.to_string_lossy().into_owned(),
                        firmware_zip_path.to_string_lossy().into_owned(),
                    ],
                });
            }
            Ok(None) => {}
            Err(error) => tracing::warn!(
                "[BIOS] Cached Switch firmware is unusable; refreshing from RomM: {error}"
            ),
        }
    }

    let (client, records) = fetch_firmware(config).await?;
    let Some((prod_keys_record, firmware_zip_record)) = switch_records(&records)? else {
        anyhow::bail!("No Switch prod.keys or firmware archive was found in the configured RomM");
    };

    let downloads = [prod_keys_record, firmware_zip_record]
        .into_iter()
        .map(|record| Ok((record.clone(), switch_target_path(&root, record)?)))
        .collect::<Result<Vec<_>>>()?;
    let summary = download_records_at(&client, downloads, app, bios_download_queue()).await?;

    let prod_keys_path = switch_target_path(&root, prod_keys_record)?;
    let firmware_zip_path = switch_target_path(&root, firmware_zip_record)?;
    install_switch_firmware_from_files(
        &prod_keys_path,
        &firmware_zip_path,
        eden_executable,
        appdata.as_deref(),
    )?
    .context(format!(
        "Eden Switch preparation requires prod.keys and firmware.zip in {}",
        root.join("switch").display()
    ))?;
    Ok(summary)
}

pub(crate) async fn prepare_bios_for_launch(
    config: &AppConfig,
    emulator_id: &str,
    game_platform_id: &str,
    executable: &Path,
) -> Result<BiosDownloadSummary> {
    prepare_bios_for_launch_with_events(config, emulator_id, game_platform_id, executable, None)
        .await
}

pub(crate) async fn prepare_bios_for_launch_with_events(
    config: &AppConfig,
    emulator_id: &str,
    game_platform_id: &str,
    executable: &Path,
    app: Option<&AppHandle>,
) -> Result<BiosDownloadSummary> {
    if emulator_id == "eden" {
        return prepare_eden_firmware_for_launch(config, game_platform_id, executable, app).await;
    }

    let Some(target) = launch_target(emulator_id, executable) else {
        return Ok(BiosDownloadSummary {
            downloaded: 0,
            skipped: 0,
            paths: Vec::new(),
        });
    };

    let root = config.bios_dir();
    let (client, records) = fetch_firmware(config).await?;
    let relevant = relevant_records(&records, &target, game_platform_id);
    let downloads = relevant
        .iter()
        .map(|record| Ok(((*record).clone(), target_path(&root, record)?)))
        .collect::<Result<Vec<_>>>()?;
    let summary = download_records_at(&client, downloads, app, bios_download_queue()).await?;

    if relevant.is_empty() {
        return Ok(summary);
    }

    std::fs::create_dir_all(&target.path)?;
    for record in relevant {
        let source = target_path(&root, record)?;
        let target_name = if target.rename_for_retroarch {
            retroarch_filename(&source)
        } else {
            source
                .file_name()
                .and_then(|value| value.to_str())
                .context("Invalid firmware destination")?
                .to_string()
        };
        std::fs::copy(source, target.path.join(target_name))?;
    }

    Ok(summary)
}

fn retroarch_filename(path: &Path) -> String {
    let original = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("firmware.bin")
        .to_string();
    let Ok(hash) = md5_file(path) else {
        return original;
    };
    match hash.as_str() {
        "924e392ed05558ffdb115408c263dccf" => "scph1001.bin",
        "8dd7d5296a650fac7319bce665a6a53c" => "scph5500.bin",
        "490f666e1afb15b7362b406ed1cea246" => "scph5501.bin",
        "32736f17079d0b2b7024407c39bd3050" => "scph5502.bin",
        "a860e8c0b6d573d191e4ec7db1b1e4f6" => "gba_bios.bin",
        "24f67bdea115a2c847c8813a628571b3" | "df692a80a5b1bc90728bc3dfc76cd948" => "bios7.bin",
        "a392174eb3e572fed6447e956bde4b25" => "bios9.bin",
        "145eaef5bd3037cbc247c213bb3da1b3" | "94bc5094607c5e6598d50472c52f27f2" => "firmware.bin",
        "2efd74e3232ff260e371b99f84024f7f" | "854b9150240a198070150e4566ae1290" => "bios_CD_U.bin",
        "e66fa1dc5820d254611fdcdba0662372" => "bios_CD_E.bin",
        "278a9397d192149e84e820ac621a8edd" => "bios_CD_J.bin",
        _ => return original,
    }
    .to_string()
}

fn find_case_insensitive_file(
    directory: &Path,
    predicate: impl Fn(&str) -> bool,
) -> Option<PathBuf> {
    std::fs::read_dir(directory)
        .ok()?
        .filter_map(Result::ok)
        .find_map(|entry| {
            let path = entry.path();
            let name = entry.file_name();
            let name = name.to_string_lossy();
            (path.is_file() && predicate(&name)).then_some(path)
        })
}

fn is_prod_keys_name(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    name.starts_with("prod") && name.ends_with(".keys")
}

fn is_firmware_archive_name(name: &str) -> bool {
    name.to_ascii_lowercase().ends_with(".zip")
}

fn switch_firmware_files(root: &Path) -> Result<Option<(PathBuf, PathBuf)>> {
    let directory = root.join("switch");
    if !directory.is_dir() {
        return Ok(None);
    }

    let prod_keys = find_case_insensitive_file(&directory, is_prod_keys_name);
    let firmware_zip =
        find_case_insensitive_file(&directory, |name| name.eq_ignore_ascii_case("firmware.zip"))
            .or_else(|| find_case_insensitive_file(&directory, is_firmware_archive_name));

    match (prod_keys, firmware_zip) {
        (None, None) => Ok(None),
        (Some(prod_keys), Some(firmware_zip)) => Ok(Some((prod_keys, firmware_zip))),
        (None, Some(_)) => anyhow::bail!(
            "Switch firmware is downloaded, but prod.keys is missing from {}",
            directory.display()
        ),
        (Some(_), None) => anyhow::bail!(
            "Switch prod.keys is downloaded, but firmware.zip is missing from {}",
            directory.display()
        ),
    }
}

fn read_header_key(path: &Path) -> Result<[u8; 32]> {
    let contents = std::fs::read_to_string(path)
        .with_context(|| format!("Failed to read {}", path.display()))?;
    let header_key = contents
        .lines()
        .find_map(|line| {
            let (name, value) = line.split_once('=')?;
            name.trim()
                .eq_ignore_ascii_case("header_key")
                .then(|| value.trim())
        })
        .context("prod.keys does not contain header_key")?;
    if header_key.len() != 64 || !header_key.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        anyhow::bail!("prod.keys contains an invalid header_key");
    }
    let mut key = [0_u8; 32];
    for (index, byte) in key.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&header_key[index * 2..index * 2 + 2], 16)
            .context("prod.keys contains an invalid header_key")?;
    }
    Ok(key)
}

fn multiply_xts_tweak_by_x(tweak: &mut [u8; 16]) {
    let carry = tweak[15] >> 7;
    for index in (1..16).rev() {
        tweak[index] = (tweak[index] << 1) | (tweak[index - 1] >> 7);
    }
    tweak[0] <<= 1;
    if carry != 0 {
        tweak[0] ^= 0x87;
    }
}

fn transform_nca_header_xts(data: &mut [u8], key: &[u8; 32], decrypt: bool) -> Result<()> {
    const SECTOR_SIZE: usize = 0x200;
    const BLOCK_SIZE: usize = 16;

    if !data.len().is_multiple_of(BLOCK_SIZE) {
        anyhow::bail!("NCA header length is not AES block aligned");
    }
    let data_cipher = Aes128::new_from_slice(&key[..16]).context("Invalid NCA data-key length")?;
    let tweak_cipher =
        Aes128::new_from_slice(&key[16..]).context("Invalid NCA tweak-key length")?;

    for (sector_index, sector) in data.chunks_mut(SECTOR_SIZE).enumerate() {
        let mut tweak = [0_u8; 16];
        tweak[8..].copy_from_slice(&(sector_index as u64).to_be_bytes());
        let tweak_block =
            Block::slice_as_mut_array(&mut tweak).context("Invalid AES tweak block length")?;
        tweak_cipher.encrypt_block(tweak_block);

        for block in sector.chunks_mut(BLOCK_SIZE) {
            for index in 0..BLOCK_SIZE {
                block[index] ^= tweak[index];
            }
            let block =
                Block::slice_as_mut_array(block).context("Invalid AES data block length")?;
            if decrypt {
                data_cipher.decrypt_block(block);
            } else {
                data_cipher.encrypt_block(block);
            }
            for index in 0..BLOCK_SIZE {
                block[index] ^= tweak[index];
            }
            multiply_xts_tweak_by_x(&mut tweak);
        }
    }
    Ok(())
}

fn validate_switch_firmware(path: &Path, header_key: &[u8; 32]) -> Result<usize> {
    const NCA_HEADER_SIZE: usize = 0xC00;
    const NCA_MAGIC_OFFSET: usize = 0x200;

    let file = File::open(path)
        .with_context(|| format!("Failed to open Switch firmware archive {}", path.display()))?;
    let mut archive =
        ZipArchive::new(file).context("Switch firmware is not a valid ZIP archive")?;
    let mut count = 0;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index)?;
        let Some(enclosed) = entry.enclosed_name() else {
            continue;
        };
        if !entry.is_dir()
            && enclosed
                .extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| extension.eq_ignore_ascii_case("nca"))
        {
            count += 1;
            let file_name = enclosed
                .file_name()
                .context("Switch firmware archive contains an invalid NCA filename")?;
            let mut encrypted_header = vec![0_u8; NCA_HEADER_SIZE];
            let mut read = 0;
            while read < encrypted_header.len() {
                let amount = entry.read(&mut encrypted_header[read..])?;
                if amount == 0 {
                    break;
                }
                read += amount;
            }
            if read != NCA_HEADER_SIZE {
                anyhow::bail!(
                    "Switch firmware NCA {} has an incomplete header",
                    file_name.to_string_lossy()
                );
            }
            transform_nca_header_xts(&mut encrypted_header, header_key, true)?;
            if &encrypted_header[NCA_MAGIC_OFFSET..NCA_MAGIC_OFFSET + 4] != b"NCA3" {
                anyhow::bail!(
                    "prod.keys is not compatible with Switch firmware NCA {}",
                    file_name.to_string_lossy()
                );
            }
        }
    }
    if count == 0 {
        anyhow::bail!("Switch firmware ZIP does not contain any .nca files");
    }
    Ok(count)
}

pub(crate) fn eden_data_root(eden_executable: &Path, appdata: Option<&Path>) -> Result<PathBuf> {
    let parent = eden_executable
        .parent()
        .context("Configured Eden executable has no parent directory")?;
    let portable_user = parent.join("user");

    if parent.join("portable.txt").is_file()
        || portable_user.is_dir()
        || portable_user.join("nand").is_dir()
        || portable_user.join("keys").is_dir()
    {
        return Ok(portable_user);
    }
    if parent.join("nand").is_dir() || parent.join("keys").is_dir() {
        return Ok(parent.to_path_buf());
    }
    if let Some(appdata) = appdata {
        return Ok(appdata.join("Eden"));
    }
    Ok(portable_user)
}

fn install_switch_firmware(
    root: &Path,
    eden_executable: &Path,
    appdata: Option<&Path>,
) -> Result<Option<BiosDistributionResult>> {
    if !eden_executable.is_file() {
        return Ok(None);
    }
    let Some((prod_keys, firmware_zip)) = switch_firmware_files(root)? else {
        return Ok(None);
    };
    install_switch_firmware_from_files(&prod_keys, &firmware_zip, eden_executable, appdata)
}

fn validated_switch_firmware_files(
    root: &Path,
    records: &[FirmwareRecord],
) -> Result<Option<(PathBuf, PathBuf)>> {
    let Some((prod_keys, firmware_zip)) = switch_records(records)? else {
        return Ok(None);
    };
    let Some(prod_keys_path) = cached_source_for_record(root, prod_keys)? else {
        return Ok(None);
    };
    let Some(firmware_zip_path) = cached_source_for_record(root, firmware_zip)? else {
        return Ok(None);
    };
    Ok(Some((prod_keys_path, firmware_zip_path)))
}

fn install_switch_firmware_from_files(
    prod_keys: &Path,
    firmware_zip: &Path,
    eden_executable: &Path,
    appdata: Option<&Path>,
) -> Result<Option<BiosDistributionResult>> {
    let header_key = read_header_key(prod_keys)?;
    let nca_count = validate_switch_firmware(firmware_zip, &header_key)?;
    let eden_root = eden_data_root(eden_executable, appdata)?;
    let keys_directory = eden_root.join("keys");
    let registered_directory = eden_root
        .join("nand")
        .join("system")
        .join("Contents")
        .join("registered");
    std::fs::create_dir_all(&keys_directory)?;
    std::fs::create_dir_all(&registered_directory)?;

    let prod_keys_partial = keys_directory.join("prod.keys.part");
    std::fs::copy(prod_keys, &prod_keys_partial).context("Failed to stage prod.keys for Eden")?;
    replace_file(&prod_keys_partial, &keys_directory.join("prod.keys"))
        .context("Failed to install prod.keys for Eden")?;

    let file = File::open(firmware_zip)?;
    let mut archive = ZipArchive::new(file)?;
    let mut installed = 0;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index)?;
        let Some(enclosed) = entry.enclosed_name() else {
            continue;
        };
        if entry.is_dir()
            || !enclosed
                .extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| extension.eq_ignore_ascii_case("nca"))
        {
            continue;
        }
        let file_name = enclosed
            .file_name()
            .context("Switch firmware archive contains an invalid NCA filename")?;
        let target = registered_directory.join(file_name);
        let partial = target.with_extension("nca.part");
        let extraction_result: Result<()> = (|| {
            let mut output = File::create(&partial)?;
            std::io::copy(&mut entry, &mut output)?;
            output.flush()?;
            replace_file(&partial, &target)
        })();
        if let Err(error) = extraction_result {
            let _ = std::fs::remove_file(&partial);
            return Err(error).context(format!(
                "Failed to install Switch firmware file {}",
                file_name.to_string_lossy()
            ));
        }
        installed += 1;
    }

    if installed != nca_count {
        anyhow::bail!(
            "Installed {installed} of {nca_count} Switch firmware files; Eden firmware was not fully installed"
        );
    }

    tracing::info!(
        "[BIOS] Installed Switch prod.keys and {} NCA files into Eden at {}",
        installed,
        eden_root.display()
    );
    Ok(Some(BiosDistributionResult {
        emulator_id: "eden".to_string(),
        target_path: eden_root.to_string_lossy().into_owned(),
        files_copied: installed + 1,
    }))
}

#[tauri::command]
pub async fn distribute_bios_firmware() -> Result<Vec<BiosDistributionResult>, String> {
    let config = AppConfig::load().unwrap_or_default();
    let root = config.bios_dir();
    if !root.is_dir() {
        return Ok(Vec::new());
    }

    let targets = configured_managed_targets(&config);
    let managed_root = managed_emulators_root();
    let eden_executable = config.emulators.eden.as_deref().filter(|path| {
        path.is_file()
            && managed_root
                .as_deref()
                .is_some_and(|root| is_managed_emulator_path(path, root))
    });
    if targets.is_empty() && eden_executable.is_none() {
        return Ok(Vec::new());
    }
    let (_, records) = fetch_firmware(&config)
        .await
        .map_err(|error| error.to_string())?;

    let mut results = Vec::new();
    for target in targets {
        if !records
            .iter()
            .any(|record| target_matches_record(&target, record))
        {
            results.push(BiosDistributionResult {
                emulator_id: target.emulator_id.to_string(),
                target_path: target.path.to_string_lossy().into_owned(),
                files_copied: 0,
            });
            continue;
        }
        std::fs::create_dir_all(&target.path).map_err(|error| error.to_string())?;
        let mut copied = 0;
        for record in &records {
            if distribute_record(&root, &target, record).map_err(|error| error.to_string())? {
                copied += 1;
            }
        }
        results.push(BiosDistributionResult {
            emulator_id: target.emulator_id.to_string(),
            target_path: target.path.to_string_lossy().into_owned(),
            files_copied: copied,
        });
    }
    if let Some(eden_executable) = eden_executable {
        let appdata = std::env::var_os("APPDATA").map(PathBuf::from);
        if let Some((prod_keys, firmware_zip)) =
            validated_switch_firmware_files(&root, &records).map_err(|error| error.to_string())?
        {
            if let Some(result) = install_switch_firmware_from_files(
                &prod_keys,
                &firmware_zip,
                eden_executable,
                appdata.as_deref(),
            )
            .map_err(|error| error.to_string())?
            {
                results.push(result);
            }
        }
    }
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        sync::{
            atomic::{AtomicBool, AtomicUsize, Ordering},
            Arc,
        },
        time::Duration,
    };
    use tokio::{io::AsyncReadExt, net::TcpListener, sync::Semaphore, time::timeout};

    async fn serve_firmware_once(body: &[u8]) -> (String, tokio::task::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let body = body.to_vec();
        let task = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut request = [0_u8; 1024];
            let _ = stream.read(&mut request).await;
            stream
                .write_all(
                    format!(
                        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                        body.len()
                    )
                    .as_bytes(),
                )
                .await
                .unwrap();
            stream.write_all(&body).await.unwrap();
        });
        (format!("http://{address}"), task)
    }

    async fn serve_blocking_firmware_downloads(
        count: usize,
        started: Arc<Semaphore>,
        release: Arc<Semaphore>,
    ) -> (String, tokio::task::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let task = tokio::spawn(async move {
            let mut handlers = JoinSet::new();
            let fail_first = Arc::new(AtomicBool::new(true));
            for _ in 0..count {
                let (mut stream, _) = listener.accept().await.unwrap();
                let started = Arc::clone(&started);
                let release = Arc::clone(&release);
                let fail_first = Arc::clone(&fail_first);
                handlers.spawn(async move {
                    let mut request = [0_u8; 1024];
                    let _ = stream.read(&mut request).await.unwrap();
                    started.add_permits(1);
                    release.acquire_owned().await.unwrap().forget();
                    let response = if fail_first.swap(false, Ordering::SeqCst) {
                        "HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                            .to_string()
                    } else {
                        "HTTP/1.1 200 OK\r\nContent-Length: 8\r\nConnection: close\r\n\r\nfirmware"
                            .to_string()
                    };
                    stream.write_all(response.as_bytes()).await.unwrap();
                });
            }
            while let Some(result) = handlers.join_next().await {
                result.unwrap();
            }
        });
        (format!("http://{address}"), task)
    }

    #[test]
    fn safe_component_rejects_parent_traversal() {
        assert!(safe_component("../firmware.bin", "filename").is_err());
        assert!(safe_component("..", "filename").is_err());
    }

    #[test]
    fn target_path_is_scoped_to_platform() {
        let record = FirmwareRecord {
            platform_slug: "psx".to_string(),
            platform_name: "PlayStation".to_string(),
            firmware: RomMFirmware {
                id: 1,
                file_name: "scph1001.bin".to_string(),
                file_path: String::new(),
                full_path: String::new(),
                file_size_bytes: 0,
                md5_hash: None,
                sha1_hash: None,
                missing_from_fs: false,
            },
        };
        assert_eq!(
            target_path(Path::new("C:/bios"), &record).unwrap(),
            PathBuf::from("C:/bios/psx/scph1001.bin")
        );
    }

    #[test]
    fn bios_transfer_identity_is_namespaced_by_platform_and_firmware() {
        let psx_firmware = firmware_record("psx", 42);
        let ps2_firmware = firmware_record("ps2", 42);
        let other_psx_firmware = firmware_record("psx", 43);

        assert_eq!(bios_transfer_id(&psx_firmware), "bios:psx:42");
        assert_ne!(
            bios_transfer_id(&psx_firmware),
            bios_transfer_id(&ps2_firmware)
        );
        assert_ne!(
            bios_transfer_id(&psx_firmware),
            bios_transfer_id(&other_psx_firmware)
        );
    }

    #[test]
    fn bios_terminal_events_keep_metrics_but_clear_active_speed() {
        let record = firmware_record("psx", 42);
        let active = BiosDownloadEvent::for_record(&record).with_progress(
            DownloadProgress {
                downloaded: 512,
                total: Some(1024),
                percent: Some(50),
                speed: Some(1024),
            },
            true,
        );
        let completed = BiosDownloadEvent::for_record(&record)
            .with_progress(DownloadProgress::terminal(1024, Some(1024)), false);
        let unknown_total = BiosDownloadEvent::for_record(&record)
            .with_progress(DownloadProgress::terminal(512, None), false);

        assert_eq!(active.transfer_id, "bios:psx:42");
        assert_eq!(active.platform_name, "psx");
        assert_eq!(active.file_name, "firmware-42.bin");
        assert_eq!(active.speed.as_deref(), Some("1.00 KB/s"));
        assert_eq!(completed.downloaded, Some(1024));
        assert_eq!(completed.total, Some(1024));
        assert_eq!(completed.percent, Some(100));
        assert_eq!(completed.speed, None);
        assert_eq!(unknown_total.total, None);
        assert_eq!(unknown_total.percent, None);
    }

    #[tokio::test]
    async fn bios_queue_runs_multiple_downloads_but_caps_and_queues_excess_work() {
        let queue = BiosDownloadQueue::new(3);
        let active = Arc::new(AtomicUsize::new(0));
        let maximum = Arc::new(AtomicUsize::new(0));
        let started = Arc::new(Semaphore::new(0));
        let release = Arc::new(Semaphore::new(0));
        let temp = tempfile::tempdir().unwrap();
        let mut receivers = Vec::new();
        let mut queued = Vec::new();

        for id in 0..4 {
            let destination = temp.path().join(format!("firmware-{id}.bin"));
            let key = BiosDownloadKey {
                transfer_id: format!("bios:psx:{id}"),
                destination: destination.clone(),
            };
            let submission = queue.submit(
                key.clone(),
                controlled_download(
                    destination,
                    Arc::clone(&active),
                    Arc::clone(&maximum),
                    Arc::clone(&started),
                    Arc::clone(&release),
                ),
            );
            receivers.push(submission.receiver);
            queued.push(submission.queued);
            queue.activate(&key);
        }

        let permits = timeout(Duration::from_secs(2), started.acquire_many(3))
            .await
            .expect("three downloads should start")
            .unwrap();
        permits.forget();
        assert_eq!(active.load(Ordering::SeqCst), 3);
        assert_eq!(maximum.load(Ordering::SeqCst), 3);
        assert_eq!(queued, vec![false, false, false, true]);

        release.add_permits(3);
        let permit = timeout(Duration::from_secs(2), started.acquire())
            .await
            .expect("queued download should start after a slot opens")
            .unwrap();
        permit.forget();
        release.add_permits(1);
        for receiver in receivers {
            BiosDownloadQueue::wait_for_result(receiver).await.unwrap();
        }
    }

    #[tokio::test]
    async fn bios_queue_deduplicates_identical_requests_and_serializes_destination_collisions() {
        let queue = BiosDownloadQueue::new(2);
        let active = Arc::new(AtomicUsize::new(0));
        let maximum = Arc::new(AtomicUsize::new(0));
        let started = Arc::new(Semaphore::new(0));
        let release = Arc::new(Semaphore::new(0));
        let temp = tempfile::tempdir().unwrap();
        let destination = temp.path().join("shared.bin");
        let key = BiosDownloadKey {
            transfer_id: "bios:psx:42".to_string(),
            destination: destination.clone(),
        };
        let first_submission = queue.submit(
            key.clone(),
            controlled_download(
                destination.clone(),
                Arc::clone(&active),
                Arc::clone(&maximum),
                Arc::clone(&started),
                Arc::clone(&release),
            ),
        );
        assert!(first_submission.is_new);
        assert!(!first_submission.queued);
        assert!(timeout(Duration::from_millis(50), started.acquire())
            .await
            .is_err());
        queue.activate(&key);
        let permit = timeout(Duration::from_secs(2), started.acquire())
            .await
            .expect("first download should start")
            .unwrap();
        permit.forget();

        let same_identity_submission = queue.submit(
            key.clone(),
            controlled_download(
                destination.clone(),
                Arc::clone(&active),
                Arc::clone(&maximum),
                Arc::clone(&started),
                Arc::clone(&release),
            ),
        );
        assert!(!same_identity_submission.is_new);
        let same_destination_key = BiosDownloadKey {
            transfer_id: "bios:psx:43".to_string(),
            destination: destination.clone(),
        };
        let same_destination_submission = queue.submit(
            same_destination_key.clone(),
            controlled_download(
                destination.clone(),
                Arc::clone(&active),
                Arc::clone(&maximum),
                Arc::clone(&started),
                Arc::clone(&release),
            ),
        );
        assert!(same_destination_submission.is_new);
        assert!(same_destination_submission.queued);
        queue.activate(&same_destination_key);
        assert!(timeout(Duration::from_millis(50), started.acquire())
            .await
            .is_err());

        release.add_permits(1);
        assert_eq!(
            BiosDownloadQueue::wait_for_result(first_submission.receiver)
                .await
                .unwrap(),
            destination
        );
        assert_eq!(
            BiosDownloadQueue::wait_for_result(same_identity_submission.receiver)
                .await
                .unwrap(),
            destination
        );
        let permit = timeout(Duration::from_secs(2), started.acquire())
            .await
            .expect("distinct destination collision should start after its owner")
            .unwrap();
        permit.forget();
        release.add_permits(1);
        assert_eq!(
            BiosDownloadQueue::wait_for_result(same_destination_submission.receiver)
                .await
                .unwrap(),
            destination
        );
        assert_eq!(maximum.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn record_downloads_use_the_queue_limit_and_continue_after_a_failure() {
        let queue = BiosDownloadQueue::new(3);
        let started = Arc::new(Semaphore::new(0));
        let release = Arc::new(Semaphore::new(0));
        let (server_url, server) =
            serve_blocking_firmware_downloads(4, Arc::clone(&started), Arc::clone(&release)).await;
        let temp = tempfile::tempdir().unwrap();
        let records = (1..=4)
            .map(|id| {
                let record = firmware_record("psx", id);
                let target = temp.path().join(format!("firmware-{id}.bin"));
                (record, target)
            })
            .collect();
        let client = RomMClient::new(server_url);
        let queue_for_downloads = queue.clone();
        let downloads = tokio::spawn(async move {
            download_records_at(&client, records, None, &queue_for_downloads).await
        });

        let permits = timeout(Duration::from_secs(2), started.acquire_many(3))
            .await
            .expect("only the queue limit should reach the download server")
            .unwrap();
        permits.forget();
        assert!(timeout(Duration::from_millis(50), started.acquire())
            .await
            .is_err());

        release.add_permits(3);
        let permit = timeout(Duration::from_secs(2), started.acquire())
            .await
            .expect("a queued download should proceed after an earlier failure")
            .unwrap();
        permit.forget();
        release.add_permits(1);

        let error = downloads.await.unwrap().unwrap_err();
        assert!(error
            .to_string()
            .contains("Firmware download returned HTTP 500"));
        server.await.unwrap();
        assert_eq!(
            (1..=4)
                .filter(|id| temp.path().join(format!("firmware-{id}.bin")).is_file())
                .count(),
            3
        );
    }

    #[tokio::test]
    async fn bios_queue_isolates_failures_and_allows_retry() {
        let queue = BiosDownloadQueue::new(2);
        let temp = tempfile::tempdir().unwrap();
        let failed_destination = temp.path().join("failed.bin");
        let successful_destination = temp.path().join("successful.bin");
        let successful_started = Arc::new(Semaphore::new(0));
        let successful_release = Arc::new(Semaphore::new(0));
        let active = Arc::new(AtomicUsize::new(0));
        let maximum = Arc::new(AtomicUsize::new(0));

        let failed_key = BiosDownloadKey {
            transfer_id: "bios:psx:1".to_string(),
            destination: failed_destination.clone(),
        };
        let failed_submission = queue.submit(
            failed_key.clone(),
            Box::pin(async { Err("RomM refused this firmware".to_string()) }),
        );
        let successful_key = BiosDownloadKey {
            transfer_id: "bios:psx:2".to_string(),
            destination: successful_destination.clone(),
        };
        let successful_submission = queue.submit(
            successful_key.clone(),
            controlled_download(
                successful_destination.clone(),
                active,
                maximum,
                Arc::clone(&successful_started),
                Arc::clone(&successful_release),
            ),
        );
        queue.activate(&failed_key);
        queue.activate(&successful_key);

        assert!(
            BiosDownloadQueue::wait_for_result(failed_submission.receiver)
                .await
                .is_err()
        );
        let permit = timeout(Duration::from_secs(2), successful_started.acquire())
            .await
            .expect("unrelated download should still start")
            .unwrap();
        permit.forget();
        successful_release.add_permits(1);
        assert_eq!(
            BiosDownloadQueue::wait_for_result(successful_submission.receiver)
                .await
                .unwrap(),
            successful_destination
        );

        let retry_submission = queue.submit(
            failed_key,
            Box::pin({
                let failed_destination = failed_destination.clone();
                async move { Ok(failed_destination) }
            }),
        );
        assert!(retry_submission.is_new);
        assert!(!retry_submission.queued);
        queue.activate(&BiosDownloadKey {
            transfer_id: "bios:psx:1".to_string(),
            destination: failed_destination.clone(),
        });
        assert_eq!(
            BiosDownloadQueue::wait_for_result(retry_submission.receiver)
                .await
                .unwrap(),
            failed_destination
        );
    }

    #[cfg(unix)]
    #[test]
    fn resolved_destination_coalesces_existing_file_and_parent_aliases() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().unwrap();
        let actual = temp.path().join("actual");
        std::fs::create_dir(&actual).unwrap();
        let alias = temp.path().join("alias");
        symlink(&actual, &alias).unwrap();

        let existing_file = actual.join("firmware.bin");
        std::fs::write(&existing_file, b"old firmware").unwrap();
        let file_alias = temp.path().join("firmware-alias.bin");
        symlink(&existing_file, &file_alias).unwrap();

        assert_eq!(resolved_destination(&file_alias).unwrap(), existing_file);
        assert_eq!(
            resolved_destination(&alias.join("new-directory/firmware.bin")).unwrap(),
            actual.join("new-directory/firmware.bin")
        );
    }

    #[cfg(windows)]
    #[test]
    fn destination_lock_key_coalesces_case_insensitive_leaf_aliases() {
        let destination = PathBuf::from(r"C:\Wingosy\bios\psx\firmware.bin");
        let alias = PathBuf::from(r"c:\wingosy\BIOS\PSX\FIRMWARE.BIN");

        assert_eq!(
            destination_lock_key(&destination),
            destination_lock_key(&alias)
        );
    }

    #[tokio::test]
    async fn failed_bios_retry_preserves_the_existing_destination_and_cleans_the_part() {
        let temp = tempfile::tempdir().unwrap();
        let target = temp.path().join("psx/firmware-42.bin");
        std::fs::create_dir_all(target.parent().unwrap()).unwrap();
        std::fs::write(&target, b"known-good cached firmware").unwrap();
        let expected_body = b"replacement firmware";
        let (server_url, server) = serve_firmware_once(b"truncated firmware").await;
        let mut record = firmware_record("psx", 42);
        record.firmware.md5_hash = Some(format!("{:x}", md5::compute(expected_body)));

        let error = download_record_at(&RomMClient::new(server_url), &target, &record, None)
            .await
            .unwrap_err();

        server.await.unwrap();
        assert!(error.to_string().contains("MD5 mismatch"));
        assert_eq!(
            std::fs::read(&target).unwrap(),
            b"known-good cached firmware"
        );
        assert!(!target.with_file_name("firmware-42.bin.part").exists());
    }

    #[tokio::test]
    async fn checksumless_short_download_preserves_existing_destination() {
        let temp = tempfile::tempdir().unwrap();
        let target = temp.path().join("psx/firmware-42.bin");
        std::fs::create_dir_all(target.parent().unwrap()).unwrap();
        std::fs::write(&target, b"known-good cached firmware").unwrap();
        let (server_url, server) = serve_firmware_once(b"short").await;
        let mut record = firmware_record("psx", 42);
        record.firmware.file_size_bytes = 64;

        let error = download_record_at(&RomMClient::new(server_url), &target, &record, None)
            .await
            .unwrap_err();

        server.await.unwrap();
        assert!(error.to_string().contains("Size mismatch"));
        assert_eq!(
            std::fs::read(&target).unwrap(),
            b"known-good cached firmware"
        );
        assert!(!target.with_file_name("firmware-42.bin.part").exists());
    }

    #[test]
    fn file_without_expected_md5_is_not_current() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("firmware.bin");
        std::fs::write(&path, b"cached artifact").unwrap();

        assert!(!file_is_current(&path, None));
        let expected_md5 = md5_file(&path).unwrap();
        assert!(file_is_current(&path, Some(expected_md5.as_str())));
    }

    fn firmware_record(platform_slug: &str, id: i64) -> FirmwareRecord {
        FirmwareRecord {
            platform_slug: platform_slug.to_string(),
            platform_name: platform_slug.to_string(),
            firmware: RomMFirmware {
                id,
                file_name: format!("firmware-{id}.bin"),
                file_path: String::new(),
                full_path: String::new(),
                file_size_bytes: 0,
                md5_hash: None,
                sha1_hash: None,
                missing_from_fs: false,
            },
        }
    }

    fn controlled_download(
        destination: PathBuf,
        active: Arc<AtomicUsize>,
        maximum: Arc<AtomicUsize>,
        started: Arc<Semaphore>,
        release: Arc<Semaphore>,
    ) -> BiosDownloadWork {
        Box::pin(async move {
            let current = active.fetch_add(1, Ordering::SeqCst) + 1;
            maximum.fetch_max(current, Ordering::SeqCst);
            started.add_permits(1);
            let permit = release.acquire_owned().await.unwrap();
            permit.forget();
            active.fetch_sub(1, Ordering::SeqCst);
            Ok(destination)
        })
    }

    fn switch_firmware_record(file_name: &str, id: i64) -> FirmwareRecord {
        let mut record = firmware_record("switch", id);
        record.firmware.file_name = file_name.to_string();
        record
    }

    #[test]
    fn switch_records_prefer_canonical_artifacts() {
        let records = vec![
            switch_firmware_record("prod-backup.keys", 1),
            switch_firmware_record("prod-older.keys", 5),
            switch_firmware_record("firmware-old.zip", 2),
            switch_firmware_record("firmware-older.zip", 6),
            switch_firmware_record("prod.keys", 3),
            switch_firmware_record("firmware.zip", 4),
        ];

        let selected = switch_records(&records).unwrap().unwrap();

        assert_eq!(selected.0.firmware.id, 3);
        assert_eq!(selected.1.firmware.id, 4);
    }

    #[test]
    fn switch_records_allow_one_unambiguous_fallback() {
        let records = vec![
            switch_firmware_record("prod-user.keys", 1),
            switch_firmware_record("firmware-user.zip", 2),
        ];

        let selected = switch_records(&records).unwrap().unwrap();

        assert_eq!(selected.0.firmware.id, 1);
        assert_eq!(selected.1.firmware.id, 2);
    }

    #[test]
    fn switch_records_reject_ambiguous_key_fallbacks() {
        let records = vec![
            switch_firmware_record("prod-one.keys", 1),
            switch_firmware_record("prod-two.keys", 2),
            switch_firmware_record("firmware.zip", 3),
        ];

        let error = switch_records(&records).unwrap_err().to_string();

        assert!(error.contains("Multiple Switch prod.keys fallback records"));
    }

    #[test]
    fn switch_records_reject_ambiguous_fallbacks() {
        let records = vec![
            switch_firmware_record("prod.keys", 1),
            switch_firmware_record("firmware-one.zip", 2),
            switch_firmware_record("firmware-two.zip", 3),
        ];

        let error = switch_records(&records).unwrap_err().to_string();

        assert!(error.contains("Multiple Switch firmware archive fallback records"));
    }

    #[test]
    fn switch_records_ignore_firmware_missing_from_romm_filesystem() {
        let prod_keys = switch_firmware_record("prod.keys", 1);
        let mut missing_firmware = switch_firmware_record("Firmware.18.0.1.zip", 2);
        missing_firmware.firmware.missing_from_fs = true;
        let current_firmware = switch_firmware_record("Firmware.22.5.0.zip", 3);
        let records = vec![prod_keys, missing_firmware, current_firmware];

        let selected = switch_records(&records).unwrap().unwrap();

        assert_eq!(selected.0.firmware.id, 1);
        assert_eq!(selected.1.firmware.id, 3);
    }

    #[test]
    fn relevant_records_filters_retroarch_to_selected_platform_and_maps_romm_aliases() {
        let temp = tempfile::tempdir().unwrap();
        let executable = temp.path().join("retroarch.exe");
        std::fs::write(&executable, b"retroarch").unwrap();
        let target = launch_target("retroarch", &executable).unwrap();
        let records = vec![
            firmware_record("snes", 1),
            firmware_record("nintendo-game-boy-advance", 2),
            firmware_record("gba", 3),
            firmware_record("psx", 4),
            firmware_record("dreamcast", 5),
            firmware_record("dc", 6),
            firmware_record("sony-playstation", 7),
        ];

        let relevant = relevant_records(&records, &target, "gba");

        assert_eq!(
            relevant
                .iter()
                .map(|record| record.firmware.id)
                .collect::<Vec<_>>(),
            vec![2, 3]
        );

        assert_eq!(
            relevant_records(&records, &target, "game-boy-advance")
                .iter()
                .map(|record| record.firmware.id)
                .collect::<Vec<_>>(),
            vec![2, 3]
        );

        let flycast = launch_target("flycast", &executable).unwrap();
        assert_eq!(
            relevant_records(&records, &flycast, "gba")
                .iter()
                .map(|record| record.firmware.id)
                .collect::<Vec<_>>(),
            vec![5, 6]
        );

        let duckstation = launch_target("duckstation", &executable).unwrap();
        assert_eq!(
            relevant_records(&records, &duckstation, "gba")
                .iter()
                .map(|record| record.firmware.id)
                .collect::<Vec<_>>(),
            vec![4, 7]
        );
    }

    #[test]
    fn distribution_rejects_invalid_source_without_replacing_existing_target() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("bios");
        let source_directory = root.join("psx");
        let emulator_directory = temp.path().join("duckstation");
        std::fs::create_dir_all(&source_directory).unwrap();
        std::fs::create_dir_all(&emulator_directory).unwrap();

        let mut record = firmware_record("psx", 1);
        record.firmware.file_name = "bios.bin".to_string();
        record.firmware.file_size_bytes = b"complete artifact".len() as u64;
        record.firmware.md5_hash = Some(format!("{:x}", md5::compute(b"complete artifact")));
        std::fs::write(source_directory.join("bios.bin"), b"incomplete artifact").unwrap();
        let target = emulator_directory.join("bios").join("bios.bin");
        std::fs::create_dir_all(target.parent().unwrap()).unwrap();
        std::fs::write(&target, b"existing emulator file").unwrap();
        let target_config = target_from_parent("duckstation", &emulator_directory).unwrap();

        assert!(!distribute_record(&root, &target_config, &record).unwrap());
        assert_eq!(std::fs::read(&target).unwrap(), b"existing emulator file");

        record.firmware.md5_hash = None;
        std::fs::write(source_directory.join("bios.bin"), b"complete artifact").unwrap();
        assert!(!distribute_record(&root, &target_config, &record).unwrap());
        assert_eq!(std::fs::read(&target).unwrap(), b"existing emulator file");

        record.firmware.md5_hash = Some(format!("{:x}", md5::compute(b"complete artifact")));
        std::fs::remove_file(source_directory.join("bios.bin")).unwrap();
        std::fs::write(source_directory.join("bios.bin.part"), b"complete artifact").unwrap();
        assert!(!distribute_record(&root, &target_config, &record).unwrap());
        assert_eq!(std::fs::read(&target).unwrap(), b"existing emulator file");
    }

    #[test]
    fn distribution_copies_valid_relevant_record_using_platform_alias() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("bios");
        let source_directory = root.join("sony-playstation");
        let emulator_directory = temp.path().join("duckstation");
        std::fs::create_dir_all(&source_directory).unwrap();

        let contents = b"complete artifact";
        let mut record = firmware_record("sony-playstation", 1);
        record.firmware.file_name = "bios.bin".to_string();
        record.firmware.file_size_bytes = contents.len() as u64;
        record.firmware.md5_hash = Some(format!("{:x}", md5::compute(contents)));
        std::fs::write(source_directory.join("bios.bin"), contents).unwrap();
        let target_config = target_from_parent("duckstation", &emulator_directory).unwrap();

        assert!(distribute_record(&root, &target_config, &record).unwrap());
        assert_eq!(
            std::fs::read(emulator_directory.join("bios/bios.bin")).unwrap(),
            contents
        );
        assert!(!emulator_directory.join("bios/bios.bin.part").exists());
    }

    #[test]
    fn configured_targets_skip_stale_emulator_paths() {
        let temp = tempfile::tempdir().unwrap();
        let installed_directory = temp.path().join("mgba");
        let installed_executable = installed_directory.join("mGBA.exe");
        std::fs::create_dir_all(&installed_directory).unwrap();
        std::fs::write(&installed_executable, b"installed emulator").unwrap();

        let paths = EmulatorPaths {
            mgba: Some(installed_executable),
            duckstation: Some(temp.path().join("removed/duckstation.exe")),
            ..EmulatorPaths::default()
        };

        let targets = configured_targets(&paths);
        assert_eq!(
            targets
                .iter()
                .map(|target| target.emulator_id)
                .collect::<Vec<_>>(),
            vec!["mgba"]
        );
    }

    #[test]
    fn configured_managed_targets_skip_external_emulator_paths() {
        let temp = tempfile::tempdir().unwrap();
        let executable = temp.path().join("mGBA.exe");
        std::fs::write(&executable, b"external emulator").unwrap();
        let config = AppConfig {
            emulators: EmulatorPaths {
                mgba: Some(executable),
                ..EmulatorPaths::default()
            },
            ..AppConfig::default()
        };

        assert!(configured_managed_targets(&config).is_empty());
    }

    #[test]
    fn managed_path_check_rejects_parent_directory_escape() {
        let temp = tempfile::tempdir().unwrap();
        let managed_root = temp.path().join("managed");
        let outside = temp.path().join("outside");
        std::fs::create_dir_all(&managed_root).unwrap();
        std::fs::create_dir_all(&outside).unwrap();
        let executable = outside.join("mgba.exe");
        std::fs::write(&executable, b"external emulator").unwrap();
        let escaped = managed_root.join("..").join("outside/mgba.exe");

        assert!(!is_managed_emulator_path(
            &escaped,
            &managed_root.canonicalize().unwrap()
        ));
    }

    #[test]
    fn validated_switch_files_propagate_metadata_errors() {
        let temp = tempfile::tempdir().unwrap();
        let records = vec![
            switch_firmware_record("prod-one.keys", 1),
            switch_firmware_record("prod-two.keys", 2),
            switch_firmware_record("firmware.zip", 3),
        ];

        let error = validated_switch_firmware_files(temp.path(), &records)
            .unwrap_err()
            .to_string();

        assert!(error.contains("Multiple Switch prod.keys fallback records"));
    }

    #[test]
    fn launch_target_requires_supported_real_executable_and_maps_one_destination() {
        let temp = tempfile::tempdir().unwrap();
        let executable = temp.path().join("emulator.exe");
        std::fs::write(&executable, b"emulator").unwrap();

        let cases = [
            ("retroarch", "system", &[][..], true),
            ("duckstation", "bios", &["psx"][..], false),
            ("pcsx2", "bios", &["ps2"][..], false),
            ("melonds", "", &["nds"][..], false),
            ("flycast", "data", &["dreamcast", "dc"][..], false),
            ("mgba", "", &["gba"][..], false),
        ];
        for (emulator_id, child, platform_slugs, rename_for_retroarch) in cases {
            let target = launch_target(emulator_id, &executable).unwrap();
            assert_eq!(target.emulator_id, emulator_id);
            assert_eq!(target.path, temp.path().join(child));
            assert_eq!(target.platform_slugs, platform_slugs);
            assert_eq!(target.rename_for_retroarch, rename_for_retroarch);
        }

        let stale = temp.path().join("missing.exe");
        assert!(launch_target("mgba", &stale).is_none());
        assert!(launch_target("eden", &executable).is_none());
        assert!(!temp.path().join("data").exists());
    }

    #[tokio::test]
    async fn launch_preparation_noops_without_writing_for_unsupported_or_stale_targets() {
        let temp = tempfile::tempdir().unwrap();
        let bios_root = temp.path().join("bios");
        let executable = temp.path().join("emulator.exe");
        std::fs::write(&executable, b"emulator").unwrap();
        let mut config = AppConfig::default();
        config.library.bios_directory = Some(bios_root.clone());

        for (emulator_id, path) in [
            ("eden", executable),
            ("mgba", temp.path().join("missing.exe")),
        ] {
            let result = prepare_bios_for_launch(&config, emulator_id, "gba", &path)
                .await
                .unwrap();
            assert_eq!(result.downloaded, 0);
            assert_eq!(result.skipped, 0);
            assert!(result.paths.is_empty());
        }

        assert!(!bios_root.exists());
    }

    #[tokio::test]
    async fn launch_preparation_rejects_stale_eden_executable_for_switch() {
        let temp = tempfile::tempdir().unwrap();
        let bios_root = temp.path().join("bios");
        let executable = temp.path().join("missing-eden.exe");
        let mut config = AppConfig::default();
        config.library.bios_directory = Some(bios_root);

        let error = prepare_bios_for_launch(&config, "eden", "switch", &executable)
            .await
            .unwrap_err()
            .to_string();
        let executable_display = executable.display().to_string();

        assert!(error.contains("Configured Eden executable is unavailable"));
        assert!(error.contains(executable_display.as_str()));
    }

    #[tokio::test]
    async fn eden_launch_preparation_uses_cached_firmware_without_romm() {
        let temp = tempfile::tempdir().unwrap();
        let bios = temp.path().join("bios");
        let (eden_executable, eden_user) = eden_test_executable(&temp);
        write_switch_test_artifacts(&bios, VALID_HEADER_KEY, VALID_PROD_KEYS);
        let mut config = AppConfig::default();
        config.library.bios_directory = Some(bios);

        let result = prepare_bios_for_launch(&config, "eden", "switch", &eden_executable)
            .await
            .unwrap();

        assert_eq!(result.skipped, 2);
        assert!(eden_user.join("keys/prod.keys").is_file());
        assert!(eden_user
            .join("nand/system/Contents/registered/0100000000000001.nca")
            .is_file());
    }

    #[test]
    fn validates_prod_keys_header_key() {
        let temp = tempfile::tempdir().unwrap();
        let valid = temp.path().join("prod.keys");
        std::fs::write(
            &valid,
            "header_key = 00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFF\n",
        )
        .unwrap();
        assert!(read_header_key(&valid).is_ok());

        let invalid = temp.path().join("invalid.keys");
        std::fs::write(&invalid, "header_key = not-a-valid-key\n").unwrap();
        assert!(read_header_key(&invalid).is_err());
    }

    #[test]
    fn eden_data_root_uses_adjacent_user_directory_as_portable_instance() {
        let temp = tempfile::tempdir().unwrap();
        let eden = temp.path().join("Eden");
        let user = eden.join("user");
        let executable = eden.join("eden.exe");
        let appdata = temp.path().join("appdata");
        std::fs::create_dir_all(&user).unwrap();
        std::fs::write(&executable, b"").unwrap();

        assert_eq!(eden_data_root(&executable, Some(&appdata)).unwrap(), user);
    }

    #[test]
    fn installs_switch_firmware_into_existing_portable_eden_layout() {
        use zip::write::SimpleFileOptions;

        let temp = tempfile::tempdir().unwrap();
        let bios = temp.path().join("bios");
        let switch = bios.join("switch");
        std::fs::create_dir_all(&switch).unwrap();
        std::fs::write(
            switch.join("prod.keys"),
            "header_key = 00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFF\n",
        )
        .unwrap();
        let header_key = read_header_key(&switch.join("prod.keys")).unwrap();
        let mut encrypted_nca = vec![0_u8; 0xC00];
        encrypted_nca[0x200..0x204].copy_from_slice(b"NCA3");
        transform_nca_header_xts(&mut encrypted_nca, &header_key, false).unwrap();

        let archive_file = File::create(switch.join("firmware.zip")).unwrap();
        let mut archive = zip::ZipWriter::new(archive_file);
        archive
            .start_file("nested/0100000000000001.nca", SimpleFileOptions::default())
            .unwrap();
        archive.write_all(&encrypted_nca).unwrap();
        archive
            .start_file("../ignored.nca", SimpleFileOptions::default())
            .unwrap();
        archive.write_all(b"ignored").unwrap();
        archive.finish().unwrap();
        assert!(validate_switch_firmware(&switch.join("firmware.zip"), &[0xAA; 32]).is_err());

        let eden = temp.path().join("Eden");
        let eden_user = eden.join("user");
        std::fs::create_dir_all(eden_user.join("nand")).unwrap();
        let eden_executable = eden.join("eden.exe");
        std::fs::write(&eden_executable, b"").unwrap();

        let result = install_switch_firmware(&bios, &eden_executable, None)
            .unwrap()
            .unwrap();
        assert_eq!(result.emulator_id, "eden");
        assert_eq!(result.files_copied, 2);
        assert!(eden_user.join("keys").join("prod.keys").is_file());
        assert!(eden_user
            .join("nand/system/Contents/registered/0100000000000001.nca")
            .is_file());
        assert!(!temp.path().join("ignored.nca").exists());
    }

    fn eden_test_executable(temp: &tempfile::TempDir) -> (PathBuf, PathBuf) {
        let eden = temp.path().join("Eden");
        let user = eden.join("user");
        std::fs::create_dir_all(user.join("nand")).unwrap();
        let executable = eden.join("eden.exe");
        std::fs::write(&executable, b"").unwrap();
        (executable, user)
    }

    fn write_switch_test_artifacts(root: &Path, archive_key: [u8; 32], prod_keys: &str) {
        use zip::write::SimpleFileOptions;

        let switch = root.join("switch");
        std::fs::create_dir_all(&switch).unwrap();
        std::fs::write(switch.join("prod.keys"), prod_keys).unwrap();

        let mut encrypted_nca = vec![0_u8; 0xC00];
        encrypted_nca[0x200..0x204].copy_from_slice(b"NCA3");
        transform_nca_header_xts(&mut encrypted_nca, &archive_key, false).unwrap();

        let archive_file = File::create(switch.join("firmware.zip")).unwrap();
        let mut archive = zip::ZipWriter::new(archive_file);
        archive
            .start_file("0100000000000001.nca", SimpleFileOptions::default())
            .unwrap();
        archive.write_all(&encrypted_nca).unwrap();
        archive.finish().unwrap();
    }

    const VALID_PROD_KEYS: &str =
        "header_key = 00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFF\n";
    const VALID_HEADER_KEY: [u8; 32] = [
        0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee,
        0xff, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd,
        0xee, 0xff,
    ];

    #[test]
    fn eden_launch_preparation_installs_valid_artifacts_into_selected_instance() {
        let temp = tempfile::tempdir().unwrap();
        let bios = temp.path().join("bios");
        let (eden_executable, eden_user) = eden_test_executable(&temp);
        let other_eden_user = temp.path().join("other-eden/user");
        std::fs::create_dir_all(other_eden_user.join("nand")).unwrap();
        let other_eden_executable = temp.path().join("other-eden/eden.exe");
        std::fs::write(&other_eden_executable, b"").unwrap();
        write_switch_test_artifacts(&bios, VALID_HEADER_KEY, VALID_PROD_KEYS);

        let result = prepare_switch_firmware_for_launch(&bios, &eden_executable, None).unwrap();

        assert_eq!(result.emulator_id, "eden");
        assert_eq!(result.files_copied, 2);
        assert!(eden_user.join("keys/prod.keys").is_file());
        assert!(eden_user
            .join("nand/system/Contents/registered/0100000000000001.nca")
            .is_file());
        assert!(!other_eden_user.join("keys/prod.keys").exists());
        assert!(other_eden_executable.is_file());
    }

    #[test]
    fn eden_launch_preparation_rejects_missing_artifacts_before_install() {
        let temp = tempfile::tempdir().unwrap();
        let bios = temp.path().join("bios");
        let (eden_executable, eden_user) = eden_test_executable(&temp);

        let error = prepare_switch_firmware_for_launch(&bios, &eden_executable, None)
            .unwrap_err()
            .to_string();

        assert!(error.contains("prod.keys"));
        assert!(error.contains("firmware.zip"));
        assert!(!eden_user.join("keys").exists());
        assert!(!eden_user.join("nand/system/Contents/registered").exists());
    }

    #[test]
    fn eden_launch_preparation_rejects_invalid_keys_before_install() {
        let temp = tempfile::tempdir().unwrap();
        let bios = temp.path().join("bios");
        let (eden_executable, eden_user) = eden_test_executable(&temp);
        write_switch_test_artifacts(&bios, VALID_HEADER_KEY, "not prod keys\n");

        let error = prepare_switch_firmware_for_launch(&bios, &eden_executable, None)
            .unwrap_err()
            .to_string();

        assert!(error.contains("header_key"));
        assert!(!eden_user.join("keys").exists());
        assert!(!eden_user.join("nand/system/Contents/registered").exists());
    }

    #[test]
    fn eden_launch_preparation_rejects_incompatible_archive_before_install() {
        let temp = tempfile::tempdir().unwrap();
        let bios = temp.path().join("bios");
        let (eden_executable, eden_user) = eden_test_executable(&temp);
        write_switch_test_artifacts(&bios, [0xaa; 32], VALID_PROD_KEYS);

        let error = prepare_switch_firmware_for_launch(&bios, &eden_executable, None)
            .unwrap_err()
            .to_string();

        assert!(error.contains("not compatible"));
        assert!(!eden_user.join("keys").exists());
        assert!(!eden_user.join("nand/system/Contents/registered").exists());
    }

    #[test]
    fn eden_launch_preparation_rejects_later_incompatible_nca_before_install() {
        use zip::write::SimpleFileOptions;

        let temp = tempfile::tempdir().unwrap();
        let bios = temp.path().join("bios");
        let (eden_executable, eden_user) = eden_test_executable(&temp);
        let switch = bios.join("switch");
        std::fs::create_dir_all(&switch).unwrap();
        std::fs::write(switch.join("prod.keys"), VALID_PROD_KEYS).unwrap();

        let mut compatible_nca = vec![0_u8; 0xC00];
        compatible_nca[0x200..0x204].copy_from_slice(b"NCA3");
        transform_nca_header_xts(&mut compatible_nca, &VALID_HEADER_KEY, false).unwrap();

        let archive_file = File::create(switch.join("firmware.zip")).unwrap();
        let mut archive = zip::ZipWriter::new(archive_file);
        archive
            .start_file("0100000000000001.nca", SimpleFileOptions::default())
            .unwrap();
        archive.write_all(&compatible_nca).unwrap();
        archive
            .start_file("0100000000000002.nca", SimpleFileOptions::default())
            .unwrap();
        archive.write_all(&[0_u8; 0xC00]).unwrap();
        archive.finish().unwrap();

        let error = prepare_switch_firmware_for_launch(&bios, &eden_executable, None)
            .unwrap_err()
            .to_string();

        assert!(error.contains("not compatible"));
        assert!(!eden_user.join("keys/prod.keys").exists());
        assert!(!eden_user
            .join("nand/system/Contents/registered/0100000000000001.nca")
            .exists());
        assert!(!eden_user
            .join("nand/system/Contents/registered/0100000000000002.nca")
            .exists());
    }

    #[test]
    fn eden_launch_preparation_retries_idempotently() {
        let temp = tempfile::tempdir().unwrap();
        let bios = temp.path().join("bios");
        let (eden_executable, eden_user) = eden_test_executable(&temp);
        write_switch_test_artifacts(&bios, VALID_HEADER_KEY, VALID_PROD_KEYS);

        prepare_switch_firmware_for_launch(&bios, &eden_executable, None).unwrap();
        let result = prepare_switch_firmware_for_launch(&bios, &eden_executable, None).unwrap();

        assert_eq!(result.files_copied, 2);
        assert!(!eden_user.join("keys/prod.keys.part").exists());
        assert!(!eden_user
            .join("nand/system/Contents/registered/0100000000000001.nca.part")
            .exists());
    }
}
