//! Explicit RomM Switch update/DLC sync and Eden external-content registration.
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::api::download::{DownloadManager, DownloadProgress};
use crate::api::{RomMClient, RomMFile, RomMFileLastModified, RomMRom};
use crate::config::AppConfig;
use crate::models::{Game, GameSource};

const CONTENT_ROOT_NAME: &str = "switch-content";
const MANIFEST_NAME: &str = "manifest.json";
const MANIFEST_VERSION: u8 = 1;
const EDEN_PATHS_SECTION: &str = "[UI]";
const EDEN_ARRAY_PREFIX: &str = "Paths\\external_content_dirs\\";

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SwitchContentStage {
    FetchingMetadata,
    Downloading,
    Reusing,
    Registering,
}

#[derive(Debug, Clone, Serialize)]
pub struct SwitchContentProgress {
    pub stage: SwitchContentStage,
    pub file_name: Option<String>,
    pub category: Option<String>,
    pub file_index: usize,
    pub total_files: usize,
    pub downloaded: Option<u64>,
    pub total: Option<u64>,
    pub percent: Option<u8>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SwitchContentSyncResult {
    pub success: bool,
    pub message: String,
    pub title_id: String,
    pub content_directory: String,
    pub downloaded: usize,
    pub reused: usize,
    pub total_files: usize,
}

#[derive(Debug, Clone)]
struct SelectedContentFile {
    id: i32,
    category: String,
    file_name: String,
    expected_size: u64,
    server_change_marker: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ContentManifest {
    version: u8,
    files: Vec<ContentManifestEntry>,
}

impl Default for ContentManifest {
    fn default() -> Self {
        Self {
            version: MANIFEST_VERSION,
            files: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ContentManifestEntry {
    file_id: i32,
    category: String,
    file_name: String,
    relative_path: String,
    expected_size: u64,
    server_change_marker: String,
}

pub async fn sync_switch_content<F>(
    game: &Game,
    client: &RomMClient,
    progress_callback: F,
) -> Result<SwitchContentSyncResult>
where
    F: Fn(SwitchContentProgress) + Send + Sync + 'static,
{
    let data_root = AppConfig::data_dir()?;
    let eden_executable = configured_eden_executable()?;
    let appdata = std::env::var_os("APPDATA").map(PathBuf::from);
    sync_switch_content_at_root(
        game,
        client,
        &data_root,
        &eden_executable,
        appdata.as_deref(),
        progress_callback,
        || eden_process_is_running(&eden_executable),
    )
    .await
}

async fn sync_switch_content_at_root<F, P>(
    game: &Game,
    client: &RomMClient,
    data_root: &Path,
    eden_executable: &Path,
    appdata: Option<&Path>,
    progress_callback: F,
    process_check: P,
) -> Result<SwitchContentSyncResult>
where
    F: Fn(SwitchContentProgress) + Send + Sync + 'static,
    P: Fn() -> Result<bool>,
{
    validate_game(game)?;
    let callback: Arc<dyn Fn(SwitchContentProgress) + Send + Sync> = Arc::new(progress_callback);
    callback(SwitchContentProgress {
        stage: SwitchContentStage::FetchingMetadata,
        file_name: None,
        category: None,
        file_index: 0,
        total_files: 0,
        downloaded: None,
        total: None,
        percent: None,
    });

    let rom = client
        .get_rom(game.romm_id.context("Game has no RomM ID")?)
        .await?;
    let title_id = resolve_base_title_id(&rom)?;
    let files = select_eligible_files(&rom)?;
    if files.is_empty() {
        anyhow::bail!(
            "RomM detailed metadata contains no Switch files categorized as update or dlc; verify the child-file categories, then retry"
        );
    }

    let content_directory = content_directory(data_root, &title_id);
    fs::create_dir_all(&content_directory).with_context(|| {
        format!(
            "Failed to create Switch content directory {}",
            content_directory.display()
        )
    })?;
    let mut manifest = read_manifest(&content_directory)?;
    let mut downloaded = 0;
    let mut reused = 0;

    for (index, file) in files.iter().cloned().enumerate() {
        let total_files = files.len();
        let relative_path = content_relative_path(&file);
        let destination = content_directory.join(&relative_path);
        if manifest_has_current_file(&manifest, &file, &relative_path, &destination) {
            reused += 1;
            callback(content_progress(
                SwitchContentStage::Reusing,
                &file,
                index + 1,
                total_files,
                None,
            ));
            continue;
        }

        let category_directory = destination
            .parent()
            .context("Switch content destination has no category directory")?;
        fs::create_dir_all(category_directory).with_context(|| {
            format!(
                "Failed to create Switch {} directory {}",
                file.category,
                category_directory.display()
            )
        })?;
        let temporary = temporary_download_path(category_directory, &file);
        remove_if_present(&temporary)?;
        remove_if_present(&partial_path(&temporary))?;

        let callback_for_file = Arc::clone(&callback);
        let file_for_callback = file.clone();
        let url = client.rom_file_download_url(file.id, &file.file_name);
        let download_result = DownloadManager::new()
            .download_file_atomic(
                &url,
                &temporary,
                client.token(),
                Some(file.expected_size),
                move |progress| {
                    callback_for_file(content_progress(
                        SwitchContentStage::Downloading,
                        &file_for_callback,
                        index + 1,
                        total_files,
                        Some(progress),
                    ));
                },
            )
            .await;
        if let Err(error) = download_result {
            return Err(actionable_download_error(error));
        }
        if let Err(error) = replace_file(&temporary, &destination) {
            return Err(cleanup_staged_file(
                error.context(format!(
                    "Failed to install Switch {} file {}",
                    file.category, file.file_name
                )),
                &temporary,
            ));
        }

        let previous_paths = manifest
            .files
            .iter()
            .filter(|entry| entry.file_id == file.id)
            .map(|entry| entry.relative_path.clone())
            .collect::<Vec<_>>();
        manifest.files.retain(|entry| entry.file_id != file.id);
        manifest.files.push(ContentManifestEntry {
            file_id: file.id,
            category: file.category.clone(),
            file_name: file.file_name.clone(),
            relative_path: relative_path.clone(),
            expected_size: file.expected_size,
            server_change_marker: file.server_change_marker.clone(),
        });
        remove_old_paths(&content_directory, previous_paths, &relative_path)?;
        write_manifest(&content_directory, &manifest)?;
        downloaded += 1;
    }

    callback(SwitchContentProgress {
        stage: SwitchContentStage::Registering,
        file_name: None,
        category: None,
        file_index: files.len(),
        total_files: files.len(),
        downloaded: None,
        total: None,
        percent: None,
    });
    let root = crate::bios::eden_data_root(eden_executable, appdata)?;
    let ini_path = root.join("config").join("qt-config.ini");
    register_external_content_dir_with_check(&ini_path, &content_directory, process_check)?;

    Ok(SwitchContentSyncResult {
        success: true,
        message: format!(
            "Synced Switch content for {title_id}: {downloaded} downloaded, {reused} reused. Eden will scan it on its next launch."
        ),
        title_id,
        content_directory: content_directory.to_string_lossy().into_owned(),
        downloaded,
        reused,
        total_files: files.len(),
    })
}

fn validate_game(game: &Game) -> Result<()> {
    if game.source != GameSource::RomM || game.romm_id.is_none() {
        anyhow::bail!("Switch content sync requires a game linked to RomM");
    }
    if game.platform_id != "switch" {
        anyhow::bail!("Switch content sync is only available for Switch games");
    }
    Ok(())
}

fn configured_eden_executable() -> Result<PathBuf> {
    let config = AppConfig::load()?;
    let executable = config
        .emulators
        .eden
        .context("Eden is not configured; choose the installed Eden executable in Settings")?;
    if !executable.is_file() {
        anyhow::bail!(
            "Configured Eden executable was not found at {}; choose the installed Eden executable in Settings",
            executable.display()
        );
    }
    Ok(executable)
}

fn resolve_base_title_id(rom: &RomMRom) -> Result<String> {
    match rom.title_id_candidates.as_deref() {
        Some([title_id]) if crate::sync::switch_save::is_valid_title_id(title_id) => {
            Ok(title_id.to_ascii_uppercase())
        }
        Some([]) | None => anyhow::bail!(
            "RomM detailed metadata did not identify a base Switch title ID; refresh the game metadata and retry"
        ),
        Some(candidates) => anyhow::bail!(
            "RomM detailed metadata has ambiguous base Switch title IDs ({}); refusing to write content",
            candidates.join(", ")
        ),
    }
}

fn select_eligible_files(rom: &RomMRom) -> Result<Vec<SelectedContentFile>> {
    let files = rom.files.as_deref().context(
        "RomM detailed metadata is missing the required 'files' array; verify RomM 4.8.1 and retry",
    )?;
    let mut selected = Vec::new();
    let mut ids = HashSet::new();
    for file in files {
        let Some(category) = file.category.as_deref() else {
            continue;
        };
        if !category.eq_ignore_ascii_case("update") && !category.eq_ignore_ascii_case("dlc") {
            continue;
        }
        let id = file
            .id
            .filter(|id| *id > 0)
            .with_context(|| format!("RomM {category} child file has an invalid id"))?;
        if !ids.insert(id) {
            anyhow::bail!("RomM returned duplicate {category} child file id {id}");
        }
        let rom_id = file
            .rom_id
            .context(format!("RomM {category} child file {id} is missing rom_id"))?;
        if rom_id != rom.id {
            anyhow::bail!(
                "RomM {category} child file {id} belongs to ROM {rom_id}, not ROM {}",
                rom.id
            );
        }
        let file_name = file.file_name.as_deref().context(format!(
            "RomM {category} child file {id} is missing file_name"
        ))?;
        validate_file_name(file_name)?;
        if file
            .file_path
            .as_deref()
            .is_none_or(|path| path.trim().is_empty())
        {
            anyhow::bail!("RomM {category} child file {id} is missing file_path");
        }
        let expected_size = file.file_size_bytes.context(format!(
            "RomM {category} child file {id} is missing file_size_bytes"
        ))?;
        if expected_size == 0 {
            anyhow::bail!("RomM {category} child file {id} has an invalid zero file_size_bytes");
        }
        let server_change_marker = server_change_marker(file, id, category)?;
        selected.push(SelectedContentFile {
            id,
            category: category.to_ascii_lowercase(),
            file_name: file_name.to_string(),
            expected_size,
            server_change_marker,
        });
    }
    Ok(selected)
}

fn server_change_marker(file: &RomMFile, id: i32, category: &str) -> Result<String> {
    let updated_at = file
        .updated_at
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("");
    let last_modified = file.last_modified.as_ref().and_then(|value| match value {
        RomMFileLastModified::Number(value) if value.is_finite() => Some(format_number(*value)),
        RomMFileLastModified::Text(value) if !value.trim().is_empty() => Some(value.clone()),
        _ => None,
    });
    if updated_at.is_empty() && last_modified.is_none() {
        anyhow::bail!(
            "RomM {category} child file {id} is missing updated_at/last_modified change metadata"
        );
    }
    Ok(format!(
        "updated_at={updated_at};last_modified={}",
        last_modified.unwrap_or_default()
    ))
}

fn format_number(value: f64) -> String {
    value.to_string()
}

fn validate_file_name(file_name: &str) -> Result<()> {
    let name = file_name.trim();
    if name.is_empty() || name == "." || name == ".." {
        anyhow::bail!("RomM child file has an empty or invalid file_name");
    }
    if name != file_name
        || file_name.chars().any(|character| {
            character.is_control()
                || matches!(
                    character,
                    '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
                )
        })
        || Path::new(file_name).components().count() != 1
    {
        anyhow::bail!("RomM child file has an unsafe file_name: {file_name}");
    }
    if file_name.ends_with(' ') || file_name.ends_with('.') {
        anyhow::bail!("RomM child file has an unsafe file_name: {file_name}");
    }
    let windows_stem = file_name
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_uppercase();
    if matches!(
        windows_stem.as_str(),
        "CON"
            | "PRN"
            | "AUX"
            | "NUL"
            | "COM1"
            | "COM2"
            | "COM3"
            | "COM4"
            | "COM5"
            | "COM6"
            | "COM7"
            | "COM8"
            | "COM9"
            | "LPT1"
            | "LPT2"
            | "LPT3"
            | "LPT4"
            | "LPT5"
            | "LPT6"
            | "LPT7"
            | "LPT8"
            | "LPT9"
    ) {
        anyhow::bail!("RomM child file has an unsafe file_name: {file_name}");
    }
    Ok(())
}

fn content_directory(data_root: &Path, title_id: &str) -> PathBuf {
    data_root.join(CONTENT_ROOT_NAME).join(title_id)
}

fn content_relative_path(file: &SelectedContentFile) -> String {
    format!("{}/{}-{}", file.category, file.id, file.file_name)
}

fn temporary_download_path(category_directory: &Path, file: &SelectedContentFile) -> PathBuf {
    category_directory.join(format!(".wingosy-{}-{}.download", file.category, file.id))
}

fn partial_path(path: &Path) -> PathBuf {
    let mut name = path
        .file_name()
        .map(|name| name.to_os_string())
        .unwrap_or_default();
    name.push(".partial");
    path.with_file_name(name)
}

fn read_manifest(content_directory: &Path) -> Result<ContentManifest> {
    let path = content_directory.join(MANIFEST_NAME);
    match fs::read_to_string(&path) {
        Ok(contents) => {
            let manifest: ContentManifest = serde_json::from_str(&contents).with_context(|| {
                format!("Failed to parse Switch content manifest {}", path.display())
            })?;
            if manifest.version != MANIFEST_VERSION {
                anyhow::bail!(
                    "Unsupported Switch content manifest version {}",
                    manifest.version
                );
            }
            Ok(manifest)
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            Ok(ContentManifest::default())
        }
        Err(error) => Err(error)
            .with_context(|| format!("Failed to read Switch content manifest {}", path.display())),
    }
}

fn write_manifest(content_directory: &Path, manifest: &ContentManifest) -> Result<()> {
    let path = content_directory.join(MANIFEST_NAME);
    let temporary = path.with_file_name(format!(".{MANIFEST_NAME}.partial"));
    let contents = serde_json::to_vec_pretty(manifest)
        .context("Failed to serialize Switch content manifest")?;
    if let Err(error) = fs::write(&temporary, contents) {
        return Err(cleanup_staged_file(
            anyhow::Error::from(error).context(format!(
                "Failed to write Switch content manifest {}",
                temporary.display()
            )),
            &temporary,
        ));
    }
    if let Err(error) = replace_file(&temporary, &path) {
        return Err(cleanup_staged_file(
            error.context(format!(
                "Failed to finalize Switch content manifest {}",
                path.display()
            )),
            &temporary,
        ));
    }
    Ok(())
}

fn manifest_has_current_file(
    manifest: &ContentManifest,
    file: &SelectedContentFile,
    relative_path: &str,
    destination: &Path,
) -> bool {
    manifest.files.iter().any(|entry| {
        entry.file_id == file.id
            && entry.expected_size == file.expected_size
            && entry.server_change_marker == file.server_change_marker
            && entry.relative_path == relative_path
            && destination.is_file()
            && fs::metadata(destination)
                .map(|metadata| metadata.len() == file.expected_size)
                .unwrap_or(false)
    })
}

fn remove_old_paths(
    content_directory: &Path,
    paths: Vec<String>,
    current_path: &str,
) -> Result<()> {
    for old_path in paths {
        if old_path == current_path {
            continue;
        }
        let old_path = content_directory.join(&old_path);
        if is_safe_manifest_path(content_directory, &old_path) {
            match fs::remove_file(&old_path) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => {
                    return Err(error).with_context(|| {
                        format!(
                            "Failed to remove stale Switch content file {}",
                            old_path.display()
                        )
                    })
                }
            }
        }
    }
    Ok(())
}

fn is_safe_manifest_path(root: &Path, candidate: &Path) -> bool {
    candidate.starts_with(root)
        && candidate
            .strip_prefix(root)
            .map(|relative| {
                !relative.as_os_str().is_empty()
                    && relative.components().all(|component| {
                        !matches!(
                            component,
                            std::path::Component::ParentDir
                                | std::path::Component::RootDir
                                | std::path::Component::Prefix(_)
                        )
                    })
            })
            .unwrap_or(false)
}

fn remove_if_present(path: &Path) -> Result<()> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error)
            .with_context(|| format!("Failed to remove stale temporary file {}", path.display())),
    }
}

fn cleanup_staged_file(error: anyhow::Error, path: &Path) -> anyhow::Error {
    match fs::remove_file(path) {
        Ok(()) => error,
        Err(cleanup_error) if cleanup_error.kind() == std::io::ErrorKind::NotFound => error,
        Err(cleanup_error) => error.context(format!(
            "Failed to clean up staged file {}: {cleanup_error}",
            path.display()
        )),
    }
}

pub(crate) fn replace_file(source: &Path, destination: &Path) -> Result<()> {
    #[cfg(windows)]
    {
        replace_file_windows(source, destination)
    }

    #[cfg(not(windows))]
    {
        fs::rename(source, destination)
            .with_context(|| format!("Failed to atomically replace {}", destination.display()))
    }
}

#[cfg(windows)]
fn replace_file_windows(source: &Path, destination: &Path) -> Result<()> {
    use std::os::windows::ffi::OsStrExt;

    const MOVEFILE_REPLACE_EXISTING: u32 = 0x0000_0001;
    const MOVEFILE_WRITE_THROUGH: u32 = 0x0000_0008;

    let source_wide = source
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let destination_display = destination.display().to_string();
    let destination_wide = destination
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let replaced = unsafe {
        move_file_ex_w(
            source_wide.as_ptr(),
            destination_wide.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if replaced == 0 {
        Err(std::io::Error::last_os_error())
            .with_context(|| format!("Failed to atomically replace {}", destination_display))
    } else {
        Ok(())
    }
}

#[cfg(windows)]
#[link(name = "kernel32")]
extern "system" {
    #[link_name = "MoveFileExW"]
    fn move_file_ex_w(existing_file_name: *const u16, new_file_name: *const u16, flags: u32)
        -> i32;
}

fn actionable_download_error(error: anyhow::Error) -> anyhow::Error {
    let message = error.to_string();
    if message.contains("HTTP error 401") || message.contains("HTTP error 403") {
        anyhow::anyhow!(
            "RomM denied Switch update/DLC access. Reconnect in Settings > RomM so the session includes roms.read, then retry"
        )
    } else if message.contains("HTTP error 404")
        || message.contains("HTTP error 405")
        || message.contains("HTTP error 501")
    {
        anyhow::anyhow!(
            "RomM Switch child-file content endpoint is unsupported or unavailable. Verify RomM 4.8.1, then retry"
        )
    } else {
        error.context("Switch update/DLC transfer failed; verify RomM connectivity and retry")
    }
}

fn content_progress(
    stage: SwitchContentStage,
    file: &SelectedContentFile,
    file_index: usize,
    total_files: usize,
    progress: Option<DownloadProgress>,
) -> SwitchContentProgress {
    SwitchContentProgress {
        stage,
        file_name: Some(file.file_name.clone()),
        category: Some(file.category.clone()),
        file_index,
        total_files,
        downloaded: progress.as_ref().map(|value| value.downloaded),
        total: progress.as_ref().and_then(|value| value.total),
        percent: progress.as_ref().and_then(|value| value.percent),
    }
}

fn register_external_content_dir_with_check(
    ini_path: &Path,
    owned_directory: &Path,
    eden_running: impl Fn() -> Result<bool>,
) -> Result<()> {
    if eden_running().context(
        "Could not verify whether Eden is running; close Eden completely, then retry Switch content sync",
    )? {
        anyhow::bail!("Eden is running; close Eden completely, then retry Switch content sync");
    }
    if !owned_directory.is_dir() {
        anyhow::bail!(
            "Wingosy Switch content directory does not exist: {}",
            owned_directory.display()
        );
    }
    let contents = match fs::read_to_string(ini_path) {
        Ok(contents) => contents,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(error) => {
            return Err(error)
                .with_context(|| format!("Failed to read Eden config {}", ini_path.display()))
        }
    };
    let updated =
        update_qsettings_external_content_dirs(&contents, &owned_directory.to_string_lossy())?;
    let temporary = ini_path.with_file_name("qt-config.ini.partial");
    if let Some(parent) = ini_path.parent() {
        fs::create_dir_all(parent)?;
    }
    if let Err(error) = fs::write(&temporary, updated) {
        return Err(cleanup_staged_file(
            anyhow::Error::from(error).context(format!(
                "Failed to stage Eden config {}",
                temporary.display()
            )),
            &temporary,
        ));
    }
    if let Err(error) = replace_file(&temporary, ini_path) {
        return Err(cleanup_staged_file(
            error.context(format!(
                "Failed to atomically update Eden config {}",
                ini_path.display()
            )),
            &temporary,
        ));
    }
    Ok(())
}

fn update_qsettings_external_content_dirs(contents: &str, owned_directory: &str) -> Result<String> {
    let line_ending = if contents.contains("\r\n") {
        "\r\n"
    } else {
        "\n"
    };
    let lines = contents
        .split('\n')
        .map(|line| line.strip_suffix('\r').unwrap_or(line).to_string())
        .collect::<Vec<_>>();
    let mut section_start = None;
    let mut section_end = lines.len();
    let mut in_section = false;
    for (index, line) in lines.iter().enumerate() {
        if line.starts_with('[') && line.ends_with(']') {
            if in_section {
                section_end = index;
                break;
            }
            in_section = line == EDEN_PATHS_SECTION;
            if in_section {
                section_start = Some(index);
            }
        }
    }

    let Some(section_start) = section_start else {
        let mut result = contents.to_string();
        if !result.is_empty() && !result.ends_with(line_ending) {
            result.push_str(line_ending);
        }
        result.push_str(EDEN_PATHS_SECTION);
        result.push_str(line_ending);
        result.push_str("Paths\\external_content_dirs\\1\\path=");
        result.push_str(&encode_qsettings_value(owned_directory));
        result.push_str(line_ending);
        result.push_str("Paths\\external_content_dirs\\size=1");
        return Ok(result);
    };

    let mut existing_paths = Vec::new();
    let mut array_line_indexes = HashSet::new();
    let mut first_array_line = None;
    for (index, line) in lines
        .iter()
        .enumerate()
        .take(section_end)
        .skip(section_start + 1)
    {
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        match qsettings_array_key(key) {
            Some(QSettingsArrayKey::Path(array_index)) => {
                first_array_line.get_or_insert(index);
                array_line_indexes.insert(index);
                existing_paths.push((array_index, decode_qsettings_value(value)));
            }
            Some(QSettingsArrayKey::Size) => {
                first_array_line.get_or_insert(index);
                array_line_indexes.insert(index);
            }
            None => {}
        }
    }
    existing_paths.sort_by_key(|(index, _)| *index);
    let owned_normalized = normalize_path_for_comparison(owned_directory);
    let mut paths = existing_paths
        .into_iter()
        .map(|(_, path)| path)
        .filter(|path| normalize_path_for_comparison(path) != owned_normalized)
        .collect::<Vec<_>>();
    paths.push(owned_directory.to_string());

    let insert_at = first_array_line.unwrap_or(section_end);
    let mut output_lines = Vec::with_capacity(lines.len() + paths.len() + 1);
    for (index, line) in lines.iter().enumerate() {
        if index == insert_at {
            append_qsettings_array(&mut output_lines, &paths);
        }
        if index < section_start || index >= section_end || !array_line_indexes.contains(&index) {
            output_lines.push(line.clone());
        }
    }
    if insert_at == lines.len() {
        append_qsettings_array(&mut output_lines, &paths);
    }
    Ok(output_lines.join(line_ending))
}

#[derive(Debug, PartialEq, Eq)]
enum QSettingsArrayKey {
    Path(usize),
    Size,
}

fn qsettings_array_key(key: &str) -> Option<QSettingsArrayKey> {
    let suffix = key.strip_prefix(EDEN_ARRAY_PREFIX)?;
    if suffix == "size" {
        return Some(QSettingsArrayKey::Size);
    }
    let (index, property) = suffix.split_once('\\')?;
    if property != "path" {
        return None;
    }
    Some(QSettingsArrayKey::Path(index.parse().ok()?))
}

fn append_qsettings_array(lines: &mut Vec<String>, paths: &[String]) {
    for (index, path) in paths.iter().enumerate() {
        lines.push(format!(
            "Paths\\external_content_dirs\\{}\\path={}",
            index + 1,
            encode_qsettings_value(path)
        ));
    }
    lines.push(format!(
        "Paths\\external_content_dirs\\size={}",
        paths.len()
    ));
}

fn decode_qsettings_value(value: &str) -> String {
    let mut decoded = String::new();
    let mut chars = value.chars();
    while let Some(character) = chars.next() {
        if character != '\\' {
            decoded.push(character);
            continue;
        }
        match chars.next() {
            Some('n') => decoded.push('\n'),
            Some('r') => decoded.push('\r'),
            Some('t') => decoded.push('\t'),
            Some('\\') => decoded.push('\\'),
            Some('x') => {
                let digits = chars.by_ref().take(4).collect::<String>();
                if digits.len() == 4 {
                    if let Ok(codepoint) = u32::from_str_radix(&digits, 16) {
                        if let Some(character) = char::from_u32(codepoint) {
                            decoded.push(character);
                            continue;
                        }
                    }
                }
                decoded.push('\\');
                decoded.push('x');
                decoded.push_str(&digits);
            }
            Some(other) => {
                decoded.push('\\');
                decoded.push(other);
            }
            None => decoded.push('\\'),
        }
    }
    decoded
}

fn encode_qsettings_value(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

fn normalize_path_for_comparison(path: &str) -> String {
    let mut normalized = path.replace('\\', "/");
    while normalized.ends_with('/') && normalized.len() > 1 {
        normalized.pop();
    }
    if cfg!(windows) {
        normalized.make_ascii_lowercase();
    }
    normalized
}

#[cfg(windows)]
fn eden_process_is_running(executable: &Path) -> Result<bool> {
    let name = executable
        .file_name()
        .and_then(|value| value.to_str())
        .context("Configured Eden executable has no valid filename")?;
    let output = std::process::Command::new("tasklist")
        .args(["/FI", &format!("IMAGENAME eq {name}"), "/FO", "CSV", "/NH"])
        .output()
        .context("Failed to inspect running Eden processes with tasklist")?;
    if !output.status.success() {
        anyhow::bail!("tasklist failed while checking Eden process state");
    }
    let stdout = String::from_utf8(output.stdout)
        .context("tasklist returned invalid UTF-8 while checking Eden process state")?;
    for line in stdout.lines().map(str::trim) {
        if line.is_empty() || line.starts_with("INFO:") {
            continue;
        }
        let row = line
            .strip_prefix('"')
            .and_then(|line| line.split_once('"'))
            .context("tasklist returned an unexpected CSV row while checking Eden process state")?;
        if !row.1.starts_with(',') {
            anyhow::bail!(
                "tasklist returned an incomplete CSV row while checking Eden process state"
            );
        }
        if row.0.eq_ignore_ascii_case(name) {
            return Ok(true);
        }
    }
    Ok(false)
}

#[cfg(unix)]
fn eden_process_is_running(executable: &Path) -> Result<bool> {
    let expected = fs::canonicalize(executable).with_context(|| {
        format!(
            "Failed to resolve configured Eden executable {}",
            executable.display()
        )
    })?;
    let entries = fs::read_dir("/proc").context("Failed to inspect running processes in /proc")?;
    for entry in entries {
        let entry = entry.context("Failed to inspect a running process entry in /proc")?;
        let Some(pid) = entry.file_name().to_string_lossy().parse::<u32>().ok() else {
            continue;
        };
        let process_path = match fs::read_link(format!("/proc/{pid}/exe")) {
            Ok(path) => path,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(error) => {
                return Err(error)
                    .with_context(|| format!("Failed to inspect executable for process {pid}"))
            }
        };
        let process_path = match fs::canonicalize(process_path) {
            Ok(path) => path,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(error) => {
                return Err(error)
                    .with_context(|| format!("Failed to resolve executable for process {pid}"))
            }
        };
        if process_path == expected {
            return Ok(true);
        }
    }
    Ok(false)
}

#[cfg(not(any(unix, windows)))]
fn eden_process_is_running(_executable: &Path) -> Result<bool> {
    anyhow::bail!("Running Eden process state cannot be verified on this platform")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::RomMFile;
    use crate::models::Game;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
    use std::thread::JoinHandle;
    use tempfile::tempdir;

    fn selected_rom(files: Option<Vec<RomMFile>>) -> RomMRom {
        RomMRom {
            id: 42,
            platform_id: 1,
            platform_slug: "switch".into(),
            name: "Game".into(),
            fs_name: "Game [0100AAAA00000001].nsp".into(),
            fs_size_bytes: 1,
            igdb_id: None,
            summary: None,
            url_cover: None,
            igdb_metadata: None,
            screenshots: vec![],
            title_id_candidates: Some(vec!["0100AAAA00000001".into()]),
            files,
        }
    }

    fn child(id: i32, category: &str) -> RomMFile {
        RomMFile {
            id: Some(id),
            rom_id: Some(42),
            file_name: Some(format!("{category}.nsp")),
            file_path: Some(format!("/library/{category}.nsp")),
            file_size_bytes: Some(10),
            updated_at: Some("2026-09-07T00:00:00Z".into()),
            last_modified: None,
            category: Some(category.into()),
        }
    }

    #[test]
    fn selects_only_api_update_and_dlc_categories() {
        let files = select_eligible_files(&selected_rom(Some(vec![
            child(1, "game"),
            child(2, "UPDATE"),
            child(3, "dlc"),
            child(4, "patch"),
        ])))
        .unwrap();
        assert_eq!(
            files.iter().map(|file| file.id).collect::<Vec<_>>(),
            vec![2, 3]
        );
        assert_eq!(files[0].category, "update");
    }

    #[test]
    fn missing_or_malformed_file_contract_is_actionable() {
        let missing = select_eligible_files(&selected_rom(None)).unwrap_err();
        assert!(missing.to_string().contains("'files' array"));

        let mut malformed = child(1, "update");
        malformed.file_name = Some("../unsafe.nsp".into());
        let error = select_eligible_files(&selected_rom(Some(vec![malformed]))).unwrap_err();
        assert!(error.to_string().contains("unsafe file_name"));

        let mut zero_sized = child(2, "update");
        zero_sized.file_size_bytes = Some(0);
        let error = select_eligible_files(&selected_rom(Some(vec![zero_sized]))).unwrap_err();
        assert!(error.to_string().contains("zero file_size_bytes"));
    }

    #[test]
    fn numeric_last_modified_is_parsed_and_used_for_change_identity() {
        let file: RomMFile = serde_json::from_value(serde_json::json!({
            "id": 5,
            "rom_id": 42,
            "file_name": "update.nsp",
            "file_path": "/library/update.nsp",
            "file_size_bytes": 10,
            "updated_at": null,
            "last_modified": 1725643200.25,
            "category": "update"
        }))
        .unwrap();
        assert!(matches!(
            file.last_modified.as_ref(),
            Some(RomMFileLastModified::Number(value)) if *value == 1725643200.25
        ));
        let selected = select_eligible_files(&selected_rom(Some(vec![file]))).unwrap();
        assert_eq!(
            selected[0].server_change_marker,
            "updated_at=;last_modified=1725643200.25"
        );
    }

    #[test]
    fn base_title_id_is_exactly_one_detailed_candidate() {
        assert_eq!(
            resolve_base_title_id(&selected_rom(Some(vec![]))).unwrap(),
            "0100AAAA00000001"
        );
        let mut ambiguous = selected_rom(Some(vec![]));
        ambiguous.title_id_candidates =
            Some(vec!["0100AAAA00000001".into(), "0100BBBB00000002".into()]);
        assert!(resolve_base_title_id(&ambiguous).is_err());
        assert_eq!(
            content_directory(Path::new("/wingosy"), "0100AAAA00000001"),
            PathBuf::from("/wingosy/switch-content/0100AAAA00000001")
        );
    }

    #[test]
    fn manifest_identity_distinguishes_unchanged_and_changed_server_records() {
        let temp = tempdir().unwrap();
        let file = child(1, "update");
        let selected = select_eligible_files(&selected_rom(Some(vec![file.clone()]))).unwrap();
        let selected = &selected[0];
        let relative = content_relative_path(selected);
        let destination = temp.path().join(&relative);
        fs::create_dir_all(destination.parent().unwrap()).unwrap();
        fs::write(&destination, vec![0; selected.expected_size as usize]).unwrap();
        let manifest = ContentManifest {
            version: MANIFEST_VERSION,
            files: vec![ContentManifestEntry {
                file_id: selected.id,
                category: selected.category.clone(),
                file_name: selected.file_name.clone(),
                relative_path: relative.clone(),
                expected_size: selected.expected_size,
                server_change_marker: selected.server_change_marker.clone(),
            }],
        };
        assert!(manifest_has_current_file(
            &manifest,
            selected,
            &relative,
            &destination
        ));
        let mut changed = selected.clone();
        changed.server_change_marker = "updated_at=changed;last_modified=".into();
        assert!(!manifest_has_current_file(
            &manifest,
            &changed,
            &relative,
            &destination
        ));
    }

    #[test]
    fn registration_is_idempotent_and_preserves_user_paths() {
        let temp = tempdir().unwrap();
        let ini = temp.path().join("Eden/config/qt-config.ini");
        let owned = temp.path().join("switch-content");
        fs::create_dir_all(ini.parent().unwrap()).unwrap();
        fs::create_dir_all(&owned).unwrap();
        let owned_config_value = encode_qsettings_value(&owned.to_string_lossy());
        fs::write(
            &ini,
            format!(
                "[General]\nfoo=bar\n\n[UI]\ntheme=dark\nPaths\\keep=yes\nPaths\\external_content_dirs\\1\\path=C:\\\\User\\\\addons\nPaths\\external_content_dirs\\2\\path=/other\nPaths\\external_content_dirs\\3\\path=/other\nPaths\\external_content_dirs\\size=3\nPaths\\external_content_dirs\\4\\path={owned_config_value}\n\n[Other]\nkeep=yes\n"
            ),
        )
        .unwrap();
        register_external_content_dir_with_check(&ini, &owned, || Ok(false)).unwrap();
        register_external_content_dir_with_check(&ini, &owned, || Ok(false)).unwrap();
        let contents = fs::read_to_string(&ini).unwrap();
        assert!(contents.contains("foo=bar"));
        assert!(contents.contains("theme=dark"));
        assert!(contents.contains("Paths\\keep=yes"));
        assert!(contents.contains("Paths\\external_content_dirs\\1\\path=C:\\\\User\\\\addons"));
        assert!(contents.contains("Paths\\external_content_dirs\\2\\path=/other"));
        assert_eq!(
            contents
                .matches("Paths\\external_content_dirs\\3\\path=/other")
                .count(),
            1
        );
        assert!(contents.contains("Paths\\external_content_dirs\\size=4"));
        let owned_text = owned.to_string_lossy();
        assert_eq!(contents.matches(owned_text.as_ref()).count(), 1);
        assert!(contents.contains("[Other]\nkeep=yes"));
        assert!(!contents.contains("[UI/Paths]"));
    }

    #[test]
    fn registration_refuses_to_write_while_eden_runs() {
        let temp = tempdir().unwrap();
        let ini = temp.path().join("Eden/config/qt-config.ini");
        fs::create_dir_all(ini.parent().unwrap()).unwrap();
        fs::write(&ini, "[UI]\nPaths\\keep=yes\n").unwrap();
        let owned = temp.path().join("owned");
        fs::create_dir_all(&owned).unwrap();
        let before = fs::read(&ini).unwrap();
        let error =
            register_external_content_dir_with_check(&ini, &owned, || Ok(true)).unwrap_err();
        assert!(error.to_string().contains("close Eden"));
        assert_eq!(fs::read(&ini).unwrap(), before);
    }

    #[test]
    fn registration_fails_closed_when_process_state_cannot_be_verified() {
        let temp = tempdir().unwrap();
        let ini = temp.path().join("Eden/config/qt-config.ini");
        fs::create_dir_all(ini.parent().unwrap()).unwrap();
        fs::write(&ini, "[UI]\nPaths\\keep=yes\n").unwrap();
        let owned = temp.path().join("owned");
        fs::create_dir_all(&owned).unwrap();
        let before = fs::read(&ini).unwrap();
        let error = register_external_content_dir_with_check(&ini, &owned, || {
            Err(anyhow::anyhow!("tasklist unavailable"))
        })
        .unwrap_err();
        assert!(error
            .to_string()
            .contains("Could not verify whether Eden is running"));
        assert_eq!(fs::read(&ini).unwrap(), before);
    }

    fn test_romm_server() -> (String, Arc<AtomicBool>, Arc<AtomicUsize>, JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap().to_string();
        let changed = Arc::new(AtomicBool::new(false));
        let file_requests = Arc::new(AtomicUsize::new(0));
        let server_changed = Arc::clone(&changed);
        let server_file_requests = Arc::clone(&file_requests);
        let server = std::thread::spawn(move || {
            for _ in 0..5 {
                let (mut stream, _) = listener.accept().unwrap();
                let mut request = Vec::new();
                let mut buffer = [0_u8; 1024];
                while !request.windows(4).any(|window| window == b"\r\n\r\n") {
                    let amount = stream.read(&mut buffer).unwrap();
                    if amount == 0 {
                        break;
                    }
                    request.extend_from_slice(&buffer[..amount]);
                }
                let request = String::from_utf8_lossy(&request);
                let is_file_request = request.contains("/files/content/");
                let is_changed = server_changed.load(Ordering::Relaxed);
                let body = if is_file_request {
                    server_file_requests.fetch_add(1, Ordering::Relaxed);
                    vec![if is_changed { b'b' } else { b'a' }; 10]
                } else {
                    let marker = if is_changed { "v2" } else { "v1" };
                    format!(
                        r#"{{"id":42,"platform_id":1,"platform_slug":"switch","name":"Game","fs_name":"Game [0100AAAA00000001].nsp","fs_size_bytes":10,"files":[{{"id":1,"rom_id":42,"file_name":"update.nsp","file_path":"/library/update.nsp","file_size_bytes":10,"updated_at":"{marker}","category":"update"}}]}}"#
                    )
                    .into_bytes()
                };
                let headers = format!(
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                );
                stream.write_all(headers.as_bytes()).unwrap();
                stream.write_all(&body).unwrap();
            }
        });
        (format!("http://{address}"), changed, file_requests, server)
    }

    #[tokio::test]
    async fn sync_reuses_unchanged_files_and_redownloads_changed_records() {
        let temp = tempdir().unwrap();
        let data_root = temp.path().join("data");
        let appdata = temp.path().join("appdata");
        let eden_executable = temp.path().join("eden.exe");
        fs::write(&eden_executable, b"test executable").unwrap();
        let mut game = Game::new("Game".into(), "Game.nsp".into(), "switch".into());
        game.id = 7;
        game.source = GameSource::RomM;
        game.romm_id = Some(42);

        let (server_url, changed, file_requests, server) = test_romm_server();
        let client = RomMClient::new(server_url).with_token("test-token".into());
        let first = sync_switch_content_at_root(
            &game,
            &client,
            &data_root,
            &eden_executable,
            Some(&appdata),
            |_| {},
            || Ok(false),
        )
        .await
        .unwrap();
        assert_eq!(first.downloaded, 1);
        assert_eq!(first.reused, 0);
        let destination = data_root.join("switch-content/0100AAAA00000001/update/1-update.nsp");
        assert_eq!(fs::read(&destination).unwrap(), vec![b'a'; 10]);

        let second = sync_switch_content_at_root(
            &game,
            &client,
            &data_root,
            &eden_executable,
            Some(&appdata),
            |_| {},
            || Ok(false),
        )
        .await
        .unwrap();
        assert_eq!(second.downloaded, 0);
        assert_eq!(second.reused, 1);
        assert_eq!(file_requests.load(Ordering::Relaxed), 1);

        changed.store(true, Ordering::Relaxed);
        let third = sync_switch_content_at_root(
            &game,
            &client,
            &data_root,
            &eden_executable,
            Some(&appdata),
            |_| {},
            || Ok(false),
        )
        .await
        .unwrap();
        assert_eq!(third.downloaded, 1);
        assert_eq!(third.reused, 0);
        assert_eq!(file_requests.load(Ordering::Relaxed), 2);
        assert_eq!(fs::read(&destination).unwrap(), vec![b'b'; 10]);
        let ini = appdata.join("Eden/config/qt-config.ini");
        let ini = fs::read_to_string(ini).unwrap();
        assert!(ini.contains("[UI]\nPaths\\external_content_dirs\\1\\path="));
        assert_eq!(ini.matches("Paths\\external_content_dirs").count(), 2);
        assert!(!appdata.join("Eden/qt-config.ini").exists());
        server.join().unwrap();
    }

    #[test]
    fn qsettings_array_update_replaces_only_the_array() {
        let source = "[General]\nkeep=1\n\n[UI]\ntheme=dark\nPaths\\other=value\nPaths\\external_content_dirs\\1\\path=/one\nPaths\\external_content_dirs\\2\\path=/owned\nPaths\\external_content_dirs\\size=2\n\n[Other]\nkeep=2\n";
        let updated = update_qsettings_external_content_dirs(source, "/owned").unwrap();
        assert!(updated.contains("[General]\nkeep=1"));
        assert!(updated.contains("theme=dark"));
        assert!(updated.contains("Paths\\other=value"));
        assert!(updated.contains("Paths\\external_content_dirs\\1\\path=/one"));
        assert_eq!(
            updated
                .matches("Paths\\external_content_dirs\\2\\path=/owned")
                .count(),
            1
        );
        assert!(updated.contains("[Other]\nkeep=2"));
        assert_eq!(updated, source);
    }
}
