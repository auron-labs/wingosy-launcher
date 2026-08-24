use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::api::{
    download::{DownloadManager, DownloadProgress},
    RomMClient,
};
use crate::config::{AppConfig, RetroArchInstallKind, RomMConfig, UpdateChannel};
use crate::database::Database;
use crate::emulators::{EmulatorLauncher, LaunchCommand, LaunchResult};
use crate::emulators::detection::detect_installed_emulators;
use crate::models::{
    default_emulators, retroarch_cores, Collection, Game, GameFilter, GameSort, GameSource,
    Platform,
};
use crate::scanner::RomScanner;

/// Path saved in config (e.g. after install or browse) counts as installed when detection missed it.
fn configured_emulator_path(config: &AppConfig, emulator_id: &str) -> Option<PathBuf> {
    let p = match emulator_id {
        "retroarch" => config.emulators.retroarch.as_ref(),
        "dolphin" => config.emulators.dolphin.as_ref(),
        "pcsx2" => config.emulators.pcsx2.as_ref(),
        "rpcs3" => config.emulators.rpcs3.as_ref(),
        "ppsspp" => config.emulators.ppsspp.as_ref(),
        "duckstation" => config.emulators.duckstation.as_ref(),
        "cemu" => config.emulators.cemu.as_ref(),
        "eden" => config.emulators.eden.as_ref(),
        "citra" => config.emulators.citra.as_ref(),
        "melonds" => config.emulators.melonds.as_ref(),
        "mgba" => config.emulators.mgba.as_ref(),
        "flycast" => config.emulators.flycast.as_ref(),
        "xemu" => config.emulators.xemu.as_ref(),
        "xenia" => config.emulators.xenia.as_ref(),
        "mame" => config.emulators.mame.as_ref(),
        _ => return None,
    }?;
    if p.exists() {
        Some(p.clone())
    } else {
        None
    }
}

/// True if this emulator supports the given platform id (including RetroArch wildcard `"*"`).
fn emulator_supports_platform(supported: &[String], platform_id: &str) -> bool {
    supported.contains(&platform_id.to_string()) || supported.contains(&"*".to_string())
}

/// True if `retroarch_exe` resolves to a RetroArch install whose cores folder contains
/// the libretro DLL mapped for `platform_id` in [`retroarch_cores()`].
fn retroarch_core_installed_for_platform(retroarch_exe: &Path, platform_id: &str) -> bool {
    let Some(dll) = retroarch_cores().get(platform_id).copied() else {
        return false;
    };
    crate::emulators::cores::is_core_installed(retroarch_exe, dll)
}

fn retroarch_has_core_ready_for_platform(platform_id: &str) -> Result<bool, String> {
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    let Some(ref ra_exe) = config.emulators.retroarch else {
        return Ok(false);
    };
    if !ra_exe.exists() {
        return Ok(false);
    }
    if config.emulators.retroarch_install_kind == RetroArchInstallKind::Managed
        && !crate::emulators::retroarch::managed_install_is_ready(&config, ra_exe)
    {
        return Ok(false);
    }
    Ok(retroarch_core_installed_for_platform(ra_exe, platform_id))
}

/// Ensures a ROM filename has the correct extension for its platform.
/// If the file already has a valid extension, returns it unchanged.
fn ensure_rom_extension(filename: &str, platform_id: &str) -> String {
    let path = Path::new(filename);
    
    // If it already has an extension, return as-is
    if path.extension().is_some() {
        return filename.to_string();
    }
    
    // Map platform IDs to their primary ROM extension
    let extension = match platform_id {
        "gba" => "gba",
        "gbc" => "gbc",
        "gb" => "gb",
        "nes" => "nes",
        "snes" => "sfc",
        "n64" => "z64",
        "nds" => "nds",
        "3ds" => "3ds",
        "gc" | "gamecube" => "iso",
        "wii" => "iso",
        "wiiu" => "wud",
        "switch" => "nsp",
        "psx" | "ps1" => "bin",
        "ps2" => "iso",
        "psp" => "iso",
        "ps3" => "iso",
        "genesis" | "megadrive" => "md",
        "sms" | "mastersystem" => "sms",
        "gg" | "gamegear" => "gg",
        "saturn" => "iso",
        "dreamcast" => "gdi",
        "xbox" => "iso",
        "xbox360" => "iso",
        "arcade" => "zip",
        _ => return filename.to_string(), // Unknown platform, return as-is
    };
    
    format!("{}.{}", filename, extension)
}

#[derive(Debug, Serialize)]
pub struct EmulatorInfo {
    pub id: String,
    pub name: String,
    pub is_installed: bool,
    pub installed_path: Option<String>,
    pub install_type: Option<String>,
    pub version: Option<String>,
    pub has_download: bool,
    pub supported_platforms: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct MissingCore {
    pub core_filename: String,
    pub platform_name: String,
}

#[tauri::command]
pub async fn is_first_run() -> Result<bool, String> {
    let config_path = AppConfig::config_path().map_err(|e| e.to_string())?;
    let is_first = !config_path.exists();
    tracing::debug!("[App] First run check: {}", is_first);
    Ok(is_first)
}

#[tauri::command]
pub async fn complete_setup(
    romm_url: Option<String>,
    romm_username: Option<String>,
    roms_directory: Option<String>,
) -> Result<(), String> {
    tracing::info!("[Setup] Completing initial setup");
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    let config = merge_setup_config(config, romm_url, romm_username, roms_directory);
    config.save().map_err(|e| e.to_string())?;
    tracing::info!("[Setup] Setup completed successfully");
    Ok(())
}

fn merge_setup_config(
    mut config: AppConfig,
    romm_url: Option<String>,
    romm_username: Option<String>,
    roms_directory: Option<String>,
) -> AppConfig {
    if let Some(url) = romm_url {
        config.romm.server_url = Some(url);
    }
    if let Some(username) = romm_username {
        config.romm.username = Some(username);
    }
    if let Some(directory) = roms_directory {
        config.library.roms_directory = Some(PathBuf::from(directory));
    }
    config
}

#[tauri::command]
pub async fn get_all_games() -> Result<Vec<Game>, String> {
    tracing::debug!("[Library] Fetching all games");
    let db = Database::open().map_err(|e| e.to_string())?;
    let games = db.get_all_games().map_err(|e| e.to_string())?;
    tracing::info!("[Library] Loaded {} games from database", games.len());
    
    // Validate local paths and update sync states
    let validated_games = validate_game_paths(games, &db);
    Ok(validated_games)
}

/// Validate that local ROM files exist and update sync states accordingly
fn validate_game_paths(games: Vec<Game>, db: &Database) -> Vec<Game> {
    let config = AppConfig::load().ok();
    
    games.into_iter().map(|mut game| {
        let original_state = game.sync_state;
        let original_path = game.local_file_path.clone();
        
        // Check if local file path exists
        if let Some(ref local_path) = game.local_file_path {
            // Normalize the path for Windows (handle forward/back slashes)
            let normalized_path = std::path::PathBuf::from(local_path);
            let path_exists = normalized_path.exists() || {
                // Also try canonicalizing the path
                normalized_path.canonicalize().map(|p| p.exists()).unwrap_or(false)
            };
            
            if path_exists {
                // File exists - mark as synced if it was remote_only
                if game.sync_state == crate::models::SyncState::RemoteOnly {
                    game.sync_state = crate::models::SyncState::Synced;
                    tracing::debug!("[Validation] Game {} file exists, marking as synced", game.name);
                }
            } else {
                tracing::debug!("[Validation] Game {} file not found at: {:?}", game.name, normalized_path);
                // File doesn't exist - mark as remote only if from RomM
                // But only reset if it's been a while (file might be temporarily unavailable)
                if game.romm_id.is_some() {
                    // Try to discover the file in case it was moved
                    if let Some(ref cfg) = config {
                        if let Some(discovered_path) = discover_rom_file(&game, cfg) {
                            tracing::info!("[Validation] Re-discovered ROM at: {}", discovered_path);
                            game.local_file_path = Some(discovered_path);
                            game.sync_state = crate::models::SyncState::Synced;
                        } else {
                            game.sync_state = crate::models::SyncState::RemoteOnly;
                            game.local_file_path = None;
                        }
                    } else {
                        game.sync_state = crate::models::SyncState::RemoteOnly;
                        game.local_file_path = None;
                    }
                }
            }
        } else if game.romm_id.is_some() {
            // No local path but has RomM ID - try to discover file
            if let Some(ref cfg) = config {
                if let Some(discovered_path) = discover_rom_file(&game, cfg) {
                    game.local_file_path = Some(discovered_path);
                    game.sync_state = crate::models::SyncState::Synced;
                } else {
                    game.sync_state = crate::models::SyncState::RemoteOnly;
                }
            }
        }
        
        // Persist changes if state or path changed
        if game.sync_state != original_state || game.local_file_path != original_path {
            tracing::debug!("[Validation] Game {} state changed: {:?} -> {:?}", game.name, original_state, game.sync_state);
            if let Err(e) = db.update_game(&game) {
                tracing::warn!("[Library] Failed to update game {}: {}", game.id, e);
            }
        }
        
        game
    }).collect()
}

/// Try to discover a ROM file in expected locations
fn discover_rom_file(game: &Game, config: &AppConfig) -> Option<String> {
    let roms_dir = config.roms_dir();
    let platform_dir = roms_dir.join(&game.platform_id);
    
    if !platform_dir.exists() {
        return None;
    }
    
    // Normalize game name for matching
    let normalized_name = normalize_for_match(&game.name);
    
    // Also try matching the file_path (which contains the original filename)
    let file_path_stem = std::path::Path::new(&game.file_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .map(normalize_for_match);
    
    // Search for matching files
    if let Ok(entries) = std::fs::read_dir(&platform_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    let normalized_stem = normalize_for_match(stem);
                    
                    // Match by game name or original filename
                    if normalized_stem == normalized_name {
                        tracing::debug!("[Discovery] Found ROM by name: {:?}", path);
                        return Some(path.to_string_lossy().to_string());
                    }
                    
                    if let Some(ref fp_stem) = file_path_stem {
                        if &normalized_stem == fp_stem {
                            tracing::debug!("[Discovery] Found ROM by filename: {:?}", path);
                            return Some(path.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }
    
    None
}

/// Normalize a string for fuzzy matching (like Argosy does)
fn normalize_for_match(name: &str) -> String {
    name.chars()
        .map(|c| if c == '_' { ' ' } else { c }) // Treat underscores as spaces
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

#[tauri::command]
pub async fn get_games_filtered(
    platform_id: Option<String>,
    search_query: Option<String>,
    favorites_only: bool,
    sort_by: Option<String>,
) -> Result<Vec<Game>, String> {
    let db = Database::open().map_err(|e| e.to_string())?;
    
    let sort = sort_by.as_deref().map(|s| match s {
        "name" => GameSort::Name,
        "last_played" => GameSort::LastPlayed,
        "play_count" => GameSort::PlayCount,
        "play_time" => GameSort::PlayTime,
        "release_year" => GameSort::ReleaseYear,
        _ => GameSort::Name,
    }).unwrap_or(GameSort::Name);
    
    let filter = GameFilter {
        platform_id,
        genre: None,
        search_query,
        favorites_only,
        sort_by: sort,
        sort_descending: false,
    };
    
    db.get_games_filtered(&filter).map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct GamesPage {
    games: Vec<Game>,
    total: i64,
}

#[tauri::command]
pub async fn get_games_page(
    platform_id: Option<String>,
    search_query: Option<String>,
    page: u32,
    page_size: u32,
) -> Result<GamesPage, String> {
    let db = Database::open().map_err(|e| e.to_string())?;
    let filter = GameFilter {
        platform_id,
        genre: None,
        search_query,
        favorites_only: false,
        sort_by: GameSort::Name,
        sort_descending: false,
    };
    let page_size = page_size.clamp(1, 60);
    let offset = i64::from(page.saturating_sub(1)) * i64::from(page_size);
    let (games, total) = db
        .get_games_page(&filter, i64::from(page_size), offset)
        .map_err(|error| error.to_string())?;

    Ok(GamesPage {
        games: validate_game_paths(games, &db),
        total,
    })
}

#[tauri::command]
pub async fn get_all_platforms() -> Result<Vec<Platform>, String> {
    let db = Database::open().map_err(|e| e.to_string())?;
    db.get_all_platforms().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_platforms_with_games() -> Result<Vec<(Platform, i32)>, String> {
    let db = Database::open().map_err(|e| e.to_string())?;
    db.get_platforms_with_games().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_recent_games(limit: i32) -> Result<Vec<Game>, String> {
    let db = Database::open().map_err(|e| e.to_string())?;
    db.get_recent_games(limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_favorite_games() -> Result<Vec<Game>, String> {
    let db = Database::open().map_err(|e| e.to_string())?;
    db.get_favorite_games().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_favorite(game_id: i64) -> Result<bool, String> {
    let db = Database::open().map_err(|e| e.to_string())?;
    let game = db.get_game(game_id).map_err(|e| e.to_string())?
        .ok_or("Game not found")?;
    let new_state = !game.is_favorite;
    db.set_favorite(game_id, new_state).map_err(|e| e.to_string())?;
    Ok(new_state)
}

#[derive(Debug, Serialize)]
pub struct LaunchGameResult {
    pub success: bool,
    pub error: Option<String>,
    pub save_sync_warnings: Vec<String>,
    pub dry_run: bool,
    pub duration_minutes: Option<i32>,
    pub exit_code: Option<i32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
enum LaunchStage {
    Resolving,
    Downloading,
    Validating,
    Finalizing,
    SaveSync,
    Launching,
    Running,
    Completion,
    Failure,
}

impl LaunchStage {
    fn can_transition_to(self, next: Self) -> bool {
        matches!(
            (self, next),
            (Self::Resolving, Self::Downloading | Self::SaveSync | Self::Failure)
                | (Self::Downloading, Self::Downloading | Self::Validating | Self::Failure)
                | (Self::Validating, Self::Finalizing | Self::Failure)
                | (Self::Finalizing, Self::SaveSync | Self::Failure)
                | (Self::SaveSync, Self::Launching | Self::Completion | Self::Failure)
                | (Self::Launching, Self::Running | Self::Completion | Self::Failure)
                | (Self::Running, Self::SaveSync | Self::Completion | Self::Failure)
        )
    }
}

#[derive(Debug, Clone, Serialize)]
struct LaunchProgressEvent {
    game_id: i64,
    game_name: String,
    stage: LaunchStage,
    error: Option<String>,
    downloaded: Option<u64>,
    total: Option<u64>,
    percent: Option<u8>,
}

static ACTIVE_GAME_IDS: OnceLock<Mutex<HashSet<i64>>> = OnceLock::new();

struct ActiveGameGuard {
    game_id: i64,
}

impl ActiveGameGuard {
    fn try_acquire(game_id: i64) -> Option<Self> {
        let mut active = ACTIVE_GAME_IDS
            .get_or_init(|| Mutex::new(HashSet::new()))
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if !active.insert(game_id) {
            return None;
        }
        Some(Self { game_id })
    }
}

impl Drop for ActiveGameGuard {
    fn drop(&mut self) {
        let mut active = ACTIVE_GAME_IDS
            .get_or_init(|| Mutex::new(HashSet::new()))
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        active.remove(&self.game_id);
    }
}

fn launch_progress_event(
    game_id: i64,
    game_name: &str,
    stage: LaunchStage,
    error: Option<&str>,
) -> LaunchProgressEvent {
    launch_progress_event_with_metrics(game_id, game_name, stage, error, None)
}

fn launch_progress_event_with_metrics(
    game_id: i64,
    game_name: &str,
    stage: LaunchStage,
    error: Option<&str>,
    metrics: Option<&DownloadProgress>,
) -> LaunchProgressEvent {
    let downloaded = metrics.map(|progress| progress.downloaded);
    let total = metrics.and_then(|progress| progress.total);
    let percent = metrics.and_then(|progress| progress.percent);

    LaunchProgressEvent {
        game_id,
        game_name: game_name.to_string(),
        stage,
        error: error.map(str::to_string),
        downloaded,
        total,
        percent,
    }
}

fn emit_launch_progress(
    app: Option<&AppHandle>,
    game_id: i64,
    game_name: &str,
    previous_stage: Option<LaunchStage>,
    stage: LaunchStage,
    error: Option<&str>,
) -> Option<LaunchStage> {
    emit_launch_progress_with_metrics(
        app,
        game_id,
        game_name,
        previous_stage,
        stage,
        error,
        None,
    )
}

fn emit_launch_progress_with_metrics(
    app: Option<&AppHandle>,
    game_id: i64,
    game_name: &str,
    previous_stage: Option<LaunchStage>,
    stage: LaunchStage,
    error: Option<&str>,
    metrics: Option<&DownloadProgress>,
) -> Option<LaunchStage> {
    if let Some(previous) = previous_stage {
        if previous != stage && !previous.can_transition_to(stage) {
            tracing::warn!(
                "[Launch] Ignoring invalid progress transition: {:?} -> {:?}",
                previous,
                stage
            );
            return previous_stage;
        }
    }

    let Some(app) = app else {
        return Some(stage);
    };
    if let Err(e) = app.emit(
        "game-launch-progress",
        launch_progress_event_with_metrics(
            game_id,
            game_name,
            stage,
            error,
            metrics,
        ),
    ) {
        tracing::warn!("[Launch] Failed to emit progress: {e}");
    }
    Some(stage)
}

fn emit_launch_failure(
    app: Option<&AppHandle>,
    game_id: i64,
    game_name: &str,
    previous_stage: Option<LaunchStage>,
    error: impl Into<String>,
) -> String {
    let error = error.into();
    let _ = emit_launch_progress(
        app,
        game_id,
        game_name,
        previous_stage,
        LaunchStage::Failure,
        Some(&error),
    );
    error
}

fn failed_launch_result(error: String) -> LaunchGameResult {
    LaunchGameResult {
        success: false,
        error: Some(error),
        save_sync_warnings: vec![],
        dry_run: false,
        duration_minutes: None,
        exit_code: None,
    }
}

struct PreparedRom {
    game: Game,
    expected_size: Option<u64>,
}

fn fill_expected_size(
    mut progress: DownloadProgress,
    expected_size: Option<u64>,
) -> DownloadProgress {
    if progress.total.is_none() {
        progress.total = expected_size;
        if progress.percent.is_none() {
            progress.percent = expected_size.and_then(|total| {
                (total > 0).then(|| {
                    (progress.downloaded as f64 / total as f64 * 100.0).min(100.0) as u8
                })
            });
        }
    }
    progress
}

async fn prepare_remote_rom<F>(
    db: &Database,
    config: &AppConfig,
    game: &Game,
    server_url: &str,
    token: &str,
    progress_callback: F,
) -> Result<PreparedRom, String>
where
    F: Fn(DownloadProgress) + Send + 'static,
{
    let romm_id = game.romm_id.ok_or("Game has no RomM ID")?;
    let client = RomMClient::new(server_url).with_token(token.to_string());
    let rom = client.get_rom(romm_id).await.map_err(|e| e.to_string())?;
    let expected_size = (rom.fs_size_bytes > 0).then_some(rom.fs_size_bytes as u64);
    let file_name = if rom.fs_name.is_empty() {
        rom.name.clone()
    } else {
        rom.fs_name.clone()
    };
    let dest_dir = config.roms_dir().join(&game.platform_id);
    let dest_path = dest_dir.join(ensure_rom_extension(&file_name, &game.platform_id));
    let download_url = client.rom_download_url(romm_id, &file_name);

    DownloadManager::new()
        .download_file_atomic(
            &download_url,
            &dest_path,
            Some(token),
            expected_size,
            move |progress| progress_callback(fill_expected_size(progress, expected_size)),
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut updated_game = game.clone();
    updated_game.local_file_path = Some(dest_path.to_string_lossy().into_owned());
    updated_game.sync_state = crate::models::SyncState::Synced;
    db.update_game(&updated_game).map_err(|e| e.to_string())?;
    let updated_game = db
        .get_game(game.id)
        .map_err(|e| e.to_string())?
        .ok_or("Game disappeared after ROM preparation")?;

    Ok(PreparedRom {
        game: updated_game,
        expected_size,
    })
}

#[tauri::command]
pub async fn launch_game(game_id: i64) -> Result<LaunchGameResult, String> {
    run_launch_pipeline(game_id, None).await
}

#[tauri::command]
pub async fn prepare_and_launch_game(
    app: AppHandle,
    game_id: i64,
) -> Result<LaunchGameResult, String> {
    run_launch_pipeline(game_id, Some(app)).await
}

async fn run_launch_pipeline(
    game_id: i64,
    app: Option<AppHandle>,
) -> Result<LaunchGameResult, String> {
    tracing::info!("[Launch] Launching game id={}", game_id);

    let mut config = match AppConfig::load() {
        Ok(config) => config,
        Err(e) => {
            let error = emit_launch_failure(app.as_ref(), game_id, "", None, e.to_string());
            return Err(error);
        }
    };
    let db = match Database::open() {
        Ok(db) => db,
        Err(e) => {
            let error = emit_launch_failure(app.as_ref(), game_id, "", None, e.to_string());
            return Err(error);
        }
    };

    let mut game = match db.get_game(game_id) {
        Ok(Some(game)) => game,
        Ok(None) => {
            let error = emit_launch_failure(app.as_ref(), game_id, "", None, "Game not found");
            return Err(error);
        }
        Err(e) => {
            let error = emit_launch_failure(app.as_ref(), game_id, "", None, e.to_string());
            return Err(error);
        }
    };

    let Some(_active_game) = ActiveGameGuard::try_acquire(game.id) else {
        let error = format!("Game {} is already launching", game.id);
        let error = emit_launch_failure(app.as_ref(), game.id, &game.name, None, error);
        return Ok(failed_launch_result(error));
    };

    let mut previous_stage = emit_launch_progress(
        app.as_ref(),
        game.id,
        &game.name,
        None,
        LaunchStage::Resolving,
        None,
    );

    let needs_remote_preparation = game.source == GameSource::RomM
        && game.romm_id.is_some()
        && EmulatorLauncher::resolve_rom_path(&game).is_err();

    if needs_remote_preparation {
        if app.is_none() {
            let error = emit_launch_failure(
                app.as_ref(),
                game.id,
                &game.name,
                previous_stage,
                "Remote ROM preparation requires the desktop launch pipeline",
            );
            return Ok(failed_launch_result(error));
        }

        let session = match restore_romm_session().await {
            Ok(Some(session)) => session,
            Ok(None) => {
                let error = emit_launch_failure(
                    app.as_ref(),
                    game.id,
                    &game.name,
                    previous_stage,
                    "No saved RomM session is available",
                );
                return Ok(failed_launch_result(error));
            }
            Err(error) => {
                let error = emit_launch_failure(
                    app.as_ref(),
                    game.id,
                    &game.name,
                    previous_stage,
                    error,
                );
                return Ok(failed_launch_result(error));
            }
        };

        config = match AppConfig::load() {
            Ok(config) => config,
            Err(error) => {
                let error = emit_launch_failure(
                    app.as_ref(),
                    game.id,
                    &game.name,
                    previous_stage,
                    error.to_string(),
                );
                return Ok(failed_launch_result(error));
            }
        };

        previous_stage = emit_launch_progress(
            app.as_ref(),
            game.id,
            &game.name,
            previous_stage,
            LaunchStage::Downloading,
            None,
        );
        let download_app = app.clone();
        let download_game_id = game.id;
        let download_game_name = game.name.clone();
        let prepared = {
            let _download_activity = match crate::storage::begin_rom_download() {
                Ok(activity) => activity,
                Err(error) => {
                    let error = emit_launch_failure(
                        app.as_ref(),
                        game.id,
                        &game.name,
                        previous_stage,
                        error,
                    );
                    return Ok(failed_launch_result(error));
                }
            };
            prepare_remote_rom(
                &db,
                &config,
                &game,
                &session.server_url,
                &session.access_token,
                move |progress| {
                    let _ = emit_launch_progress_with_metrics(
                        download_app.as_ref(),
                        download_game_id,
                        &download_game_name,
                        Some(LaunchStage::Downloading),
                        LaunchStage::Downloading,
                        None,
                        Some(&progress),
                    );
                },
            )
            .await
        };

        let prepared = match prepared {
            Ok(prepared) => prepared,
            Err(error) => {
                let error = emit_launch_failure(
                    app.as_ref(),
                    game.id,
                    &game.name,
                    previous_stage,
                    error,
                );
                return Ok(failed_launch_result(error));
            }
        };

        let downloaded = prepared
            .game
            .local_file_path
            .as_deref()
            .and_then(|path| std::fs::metadata(path).ok())
            .map(|metadata| metadata.len())
            .unwrap_or(0);
        let percent = prepared.expected_size.and_then(|total| {
            (total > 0).then(|| (downloaded as f64 / total as f64 * 100.0).min(100.0) as u8)
        });
        let download_progress = DownloadProgress {
            downloaded,
            total: prepared.expected_size,
            percent,
        };
        previous_stage = emit_launch_progress_with_metrics(
            app.as_ref(),
            game.id,
            &game.name,
            previous_stage,
            LaunchStage::Validating,
            None,
            Some(&download_progress),
        );

        game = prepared.game;
        if let Err(error) = EmulatorLauncher::resolve_rom_path(&game) {
            let error = emit_launch_failure(
                app.as_ref(),
                game.id,
                &game.name,
                previous_stage,
                error.to_string(),
            );
            return Ok(failed_launch_result(error));
        }

        previous_stage = emit_launch_progress(
            app.as_ref(),
            game.id,
            &game.name,
            previous_stage,
            LaunchStage::Finalizing,
            None,
        );
    } else if let Err(e) = EmulatorLauncher::resolve_rom_path(&game) {
        let error = emit_launch_failure(
            app.as_ref(),
            game.id,
            &game.name,
            previous_stage,
            e.to_string(),
        );
        return Ok(failed_launch_result(error));
    }

    tracing::info!("[Launch] Game: {} ({})", game.name, game.platform_id);

    let launcher = EmulatorLauncher::new(config.clone(), db.clone());
    let launch_command = launcher.build_command(&game).ok();
    let mut save_sync_warnings = Vec::new();

    previous_stage = emit_launch_progress(
        app.as_ref(),
        game.id,
        &game.name,
        previous_stage,
        LaunchStage::SaveSync,
        None,
    );

    let pre_sync_result = if let Some(command) = launch_command.as_ref() {
        if command.emulator_id == "retroarch" {
            crate::sync::retroarch_romm::pre_launch_sync(
                &game,
                &mut config,
                command.core_name.as_deref(),
            )
            .await
        } else {
            crate::sync::switch_romm::pre_launch_sync(&game, &mut config).await
        }
    } else {
        crate::sync::switch_romm::pre_launch_sync(&game, &mut config).await
    };
    if config.romm.sync_saves {
        if let Err(e) = &pre_sync_result {
            tracing::warn!("[SaveSync] Pre-launch: {e}");
            save_sync_warnings.push(format!("Pre-launch save sync: {e}"));
            let _ = db.record_save_sync_failure(game.id, "pre_launch", &e.to_string());
        } else {
            let _ = db.clear_save_sync_failure(game.id);
        }
    }

    previous_stage = emit_launch_progress(
        app.as_ref(),
        game.id,
        &game.name,
        previous_stage,
        LaunchStage::Launching,
        None,
    );
    let running_previous_stage = previous_stage;
    let running_app = app.clone();
    let running_game_id = game.id;
    let running_game_name = game.name.clone();
    let result = match launcher
        .launch_with_running_stage(&game, move || {
            let _ = emit_launch_progress(
                running_app.as_ref(),
                running_game_id,
                &running_game_name,
                running_previous_stage,
                LaunchStage::Running,
                None,
            );
        })
        .await
    {
        Ok(result) => result,
        Err(e) => {
            tracing::error!("[Launch] Failed to launch: {}", e);
            let error = emit_launch_failure(
                app.as_ref(),
                game.id,
                &game.name,
                previous_stage,
                e.to_string(),
            );
            return Err(error);
        }
    };

    match result {
        LaunchResult::Success { duration_minutes, exit_code, .. } => {
            previous_stage = Some(LaunchStage::Running);
            previous_stage = emit_launch_progress(
                app.as_ref(),
                game.id,
                &game.name,
                previous_stage,
                LaunchStage::SaveSync,
                None,
            );
            let post_sync_result = if let Some(command) = launch_command.as_ref() {
                if command.emulator_id == "retroarch" {
                    crate::sync::retroarch_romm::post_launch_sync(
                        &game,
                        &mut config,
                        command.core_name.as_deref(),
                    )
                    .await
                } else {
                    crate::sync::switch_romm::post_launch_sync(&game, &mut config).await
                }
            } else {
                crate::sync::switch_romm::post_launch_sync(&game, &mut config).await
            };
            if config.romm.sync_saves {
                if let Err(e) = &post_sync_result {
                    tracing::warn!("[SaveSync] Post-launch: {e}");
                    save_sync_warnings.push(format!("Post-launch save sync: {e}"));
                    let _ = db.record_save_sync_failure(game.id, "post_launch", &e.to_string());
                } else {
                    let _ = db.clear_save_sync_failure(game.id);
                }
            }
            tracing::info!("[Launch] Game exited successfully (duration: {}min, exit_code: {:?})", duration_minutes, exit_code);
            let result = LaunchGameResult {
                success: true,
                error: None,
                save_sync_warnings,
                dry_run: false,
                duration_minutes: Some(duration_minutes),
                exit_code,
            };
            let _ = emit_launch_progress(
                app.as_ref(),
                game.id,
                &game.name,
                previous_stage,
                LaunchStage::Completion,
                None,
            );
            Ok(result)
        }
        LaunchResult::DryRun { ref command } => {
            tracing::info!("[Launch] Dry run completed for: {}", command.full_command);
            let result = LaunchGameResult {
                success: true,
                error: None,
                save_sync_warnings,
                dry_run: true,
                duration_minutes: None,
                exit_code: None,
            };
            let _ = emit_launch_progress(
                app.as_ref(),
                game.id,
                &game.name,
                previous_stage,
                LaunchStage::Completion,
                None,
            );
            Ok(result)
        }
        LaunchResult::FileNotFound(path) => {
            let error = format!("ROM file not found: {path}");
            let error = emit_launch_failure(
                app.as_ref(),
                game.id,
                &game.name,
                previous_stage,
                error,
            );
            Ok(failed_launch_result(error))
        }
        _ => {
            let error_msg = result.error_message();
            tracing::error!("[Launch] Launch failed: {:?}", error_msg);
            if let Some(error) = error_msg.as_deref() {
                let _ = emit_launch_failure(
                    app.as_ref(),
                    game.id,
                    &game.name,
                    previous_stage,
                    error,
                );
            }
            let result = LaunchGameResult {
                success: false,
                error: error_msg,
                save_sync_warnings,
                dry_run: false,
                duration_minutes: None,
                exit_code: None,
            };
            Ok(result)
        }
    }
}

#[tauri::command]
pub async fn get_launch_command(game_id: i64) -> Result<LaunchCommand, String> {
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    let db = Database::open().map_err(|e| e.to_string())?;
    
    let game = db.get_game(game_id).map_err(|e| e.to_string())?
        .ok_or("Game not found")?;
    
    let launcher = EmulatorLauncher::new(config, db);
    launcher.build_command(&game).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn scan_directory(path: String, recursive: bool) -> Result<Vec<Game>, String> {
    tracing::info!("[Scan] Starting directory scan: {} (recursive={})", path, recursive);
    
    let db = Database::open().map_err(|e| e.to_string())?;
    let platforms = db.get_all_platforms().map_err(|e| e.to_string())?;
    
    let scanner = RomScanner::new(platforms);
    let (tx, mut rx) = tokio::sync::mpsc::channel(100);
    
    let scan_path = std::path::PathBuf::from(&path);
    let games = scanner.scan(&scan_path, recursive, tx).await.map_err(|e| {
        tracing::error!("[Scan] Scan failed: {}", e);
        e.to_string()
    })?;
    
    while rx.recv().await.is_some() {}
    
    tracing::info!("[Scan] Saving {} games to database", games.len());
    for game in &games {
        db.upsert_game(game).map_err(|e| e.to_string())?;
    }
    
    tracing::info!("[Scan] Directory scan complete");
    Ok(games)
}

#[tauri::command]
pub async fn get_config() -> Result<AppConfig, String> {
    AppConfig::load().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_config(config: AppConfig) -> Result<(), String> {
    config.save().map_err(|e| e.to_string())
}

/// Sorted paths to playable audio files in a folder (for Immersive ambient BGM).
#[tauri::command]
pub fn list_ambient_audio_files(dir: String) -> Result<Vec<String>, String> {
    use std::path::PathBuf;
    let p = PathBuf::from(dir);
    if !p.is_dir() {
        return Err("Not a directory".to_string());
    }
    const EXTS: &[&str] = &["mp3", "ogg", "wav", "flac", "m4a", "opus"];
    let mut out: Vec<String> = std::fs::read_dir(&p)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let path = e.path();
            if !path.is_file() {
                return None;
            }
            let ext = path.extension()?.to_str()?.to_lowercase();
            if EXTS.contains(&ext.as_str()) {
                Some(path.to_string_lossy().into_owned())
            } else {
                None
            }
        })
        .collect();
    out.sort();
    Ok(out)
}

#[tauri::command]
pub async fn begin_romm_device_auth(
    server_url: String,
) -> Result<crate::api::DeviceAuthInitResponse, String> {
    let mut config = AppConfig::load().unwrap_or_default();
    let client_identifier = crate::sync::switch_romm::ensure_device_id(&mut config);
    let device_name = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "Windows PC".to_string());
    let client = RomMClient::new(&server_url);
    let mut pairing = client
        .begin_device_auth(&client_identifier, &device_name)
        .await
        .map_err(|e| e.to_string())?;

    let base = server_url.trim_end_matches('/');
    if pairing.verification_path.starts_with('/') {
        pairing.verification_path = format!("{base}{}", pairing.verification_path);
    }
    if pairing.verification_path_complete.starts_with('/') {
        pairing.verification_path_complete =
            format!("{base}{}", pairing.verification_path_complete);
    }
    Ok(pairing)
}

#[tauri::command]
pub async fn poll_romm_device_auth(
    server_url: String,
    device_code: String,
) -> Result<crate::api::DeviceAuthPollResponse, String> {
    let client = RomMClient::new(&server_url);
    let result = client
        .poll_device_auth(&device_code)
        .await
        .map_err(|e| e.to_string())?;

    if result.status == "approved" {
        let token = result
            .access_token
            .as_deref()
            .ok_or("RomM approved pairing without returning a token")?;
        RomMClient::new(&server_url)
            .with_token(token.to_string())
            .get_platforms()
            .await
            .map_err(|e| format!("RomM paired the device, but token verification failed: {e}"))?;

        let mut config = AppConfig::load().unwrap_or_default();
        if let (Some(previous_server), Some(previous_username)) =
            (config.romm.server_url.as_deref(), config.romm.username.as_deref())
        {
            crate::romm_credentials::delete_refresh_token(previous_server, previous_username)
                .map_err(|e| e.to_string())?;
        }
        config.romm.server_url = Some(server_url.clone());
        config.romm.auth_method = Some("pairing".to_string());
        config.romm.username = None;
        config.romm.password = None;
        crate::romm_credentials::store_device_token(&server_url, token)
            .map_err(|e| e.to_string())?;
        config.romm.auth_token = None;
        if let Some(device_id) = result.device_id.as_ref() {
            config.romm.device_id = Some(device_id.clone());
        }
        config.save().map_err(|e| e.to_string())?;
    }

    Ok(result)
}

#[derive(Debug, Serialize)]
pub struct RomMAuthSession {
    pub server_url: String,
    pub access_token: String,
    pub refreshed: bool,
}

#[tauri::command]
pub fn has_saved_romm_session() -> bool {
    let Ok(config) = AppConfig::load() else {
        return false;
    };
    let Some(server_url) = config.romm.server_url.as_deref() else {
        return false;
    };
    let Some(username) = config.romm.username.as_deref() else {
        return crate::romm_credentials::load_device_token(server_url)
            .ok()
            .flatten()
            .is_some()
            || config.romm.auth_token.is_some();
    };
    crate::romm_credentials::load_refresh_token(server_url, username)
        .ok()
        .flatten()
        .is_some()
}

/// Verify that the configured RomM server is reachable and that the current
/// token is still accepted. Kept separate from `has_saved_romm_session`, which
/// only reports whether credentials exist locally.
#[tauri::command]
pub async fn check_romm_connection(server_url: String, token: String) -> String {
    if server_url.trim().is_empty() || token.trim().is_empty() {
        return "not-configured".to_string();
    }

    let client = RomMClient::new(&server_url).with_token(token);
    match tokio::time::timeout(std::time::Duration::from_secs(10), client.get_platforms()).await {
        Ok(Ok(_)) => "online".to_string(),
        Ok(Err(error)) => {
            let message = error.to_string();
            if message.contains("401") || message.contains("403") {
                "unauthorized".to_string()
            } else {
                "offline".to_string()
            }
        }
        Err(_) => "offline".to_string(),
    }
}

fn default_windows_device_name() -> String {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::HKEY_LOCAL_MACHINE;
        use winreg::RegKey;

        if let Ok(key) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(
            r"SYSTEM\CurrentControlSet\Control\ComputerName\ActiveComputerName",
        ) {
            if let Ok(name) = key.get_value::<String, _>("ComputerName") {
                if !name.trim().is_empty() {
                    return name;
                }
            }
        }
    }

    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .ok()
        .filter(|name| !name.trim().is_empty())
        .unwrap_or_else(|| "Windows PC".to_string())
}

#[tauri::command]
pub fn get_default_romm_device_name() -> String {
    default_windows_device_name()
}

fn delete_romm_credentials<DeleteDevice, DeleteRefresh>(
    server_url: &str,
    username: Option<&str>,
    delete_device: DeleteDevice,
    delete_refresh: DeleteRefresh,
) -> Result<(), String>
where
    DeleteDevice: FnOnce(&str) -> anyhow::Result<()>,
    DeleteRefresh: FnOnce(&str, &str) -> anyhow::Result<()>,
{
    let mut first_error = None;
    if let Err(error) = delete_device(server_url) {
        first_error = Some(error.to_string());
    }
    if let Some(username) = username {
        if let Err(error) = delete_refresh(server_url, username) {
            if first_error.is_none() {
                first_error = Some(error.to_string());
            }
        }
    }

    match first_error {
        Some(error) => Err(error),
        None => Ok(()),
    }
}

/// Remove all locally stored RomM credentials and session metadata. This does
/// not delete the device record from the RomM server; it only signs Wingosy out.
#[tauri::command]
pub fn disconnect_romm() -> Result<(), String> {
    let mut config = AppConfig::load().map_err(|error| error.to_string())?;

    if let Some(server_url) = config.romm.server_url.as_deref() {
        delete_romm_credentials(
            server_url,
            config.romm.username.as_deref(),
            crate::romm_credentials::delete_device_token,
            crate::romm_credentials::delete_refresh_token,
        )?;
    }

    clear_romm_auth_fields(&mut config.romm);
    config.save().map_err(|error| error.to_string())
}

fn reconnect_required(error: impl std::fmt::Display) -> String {
    format!("Reconnect required: secure RomM credential storage failed: {error}")
}

fn migrate_legacy_romm_access_token<Store, Save>(
    config: &mut AppConfig,
    server_url: &str,
    store: Store,
    save: Save,
) -> Result<Option<String>, String>
where
    Store: FnOnce(&str, &str) -> anyhow::Result<()>,
    Save: FnOnce(&AppConfig) -> anyhow::Result<()>,
{
    let Some(token) = config
        .romm
        .auth_token
        .as_deref()
        .filter(|token| !token.is_empty())
        .map(str::to_owned)
    else {
        return Ok(None);
    };

    store(server_url, &token).map_err(reconnect_required)?;
    config.romm.auth_token = None;
    save(config).map_err(|error| error.to_string())?;
    Ok(Some(token))
}

fn clear_romm_auth_fields(config: &mut RomMConfig) {
    config.username = None;
    config.auth_method = None;
    config.password = None;
    config.auth_token = None;
}

/// Restore the saved RomM session on startup. Password-based connections are
/// silently renewed using a refresh token in Windows Credential Manager. Device tokens are loaded
/// from Credential Manager, and legacy access tokens are migrated there on first restore.
#[tauri::command]
pub async fn restore_romm_session() -> Result<Option<RomMAuthSession>, String> {
    let mut config = AppConfig::load().map_err(|error| error.to_string())?;
    let Some(server_url) = config.romm.server_url.clone() else {
        return Ok(None);
    };
    let migrated_token = migrate_legacy_romm_access_token(
        &mut config,
        &server_url,
        crate::romm_credentials::store_device_token,
        |config| config.save(),
    )?;
    let (existing_token, access_token_error) = match migrated_token {
        Some(token) => (Some(token), None),
        None => match crate::romm_credentials::load_device_token(&server_url) {
            Ok(access_token) => (access_token, None),
            Err(error) => (None, Some(error.to_string())),
        },
    };
    let Some(username) = config.romm.username.clone() else {
        if existing_token.is_none() {
            if let Some(error) = access_token_error {
                return Err(error);
            }
        }
        return Ok(existing_token.map(|access_token| RomMAuthSession {
            server_url,
            access_token,
            refreshed: false,
        }));
    };

    let refresh_token = match crate::romm_credentials::load_refresh_token(&server_url, &username) {
        Ok(Some(refresh_token)) => Some(refresh_token),
        Ok(None) => None,
        Err(error) => {
            tracing::warn!("[RomM] Could not access Windows Credential Manager: {}", error);
            None
        }
    };
    let Some(refresh_token) = refresh_token else {
        if let Some(error) = access_token_error {
            return Err(error);
        }
        return Ok(existing_token.map(|access_token| RomMAuthSession {
            server_url,
            access_token,
            refreshed: false,
        }));
    };

    let mut client = RomMClient::new(&server_url);
    match client.refresh_authentication(&refresh_token).await {
        Ok(token_response) => {
            let access_token = token_response.access_token.clone();
            crate::romm_credentials::store_device_token(&server_url, &access_token)
                .map_err(reconnect_required)?;
            if let Some(next_refresh_token) = token_response.refresh_token.as_deref() {
                crate::romm_credentials::store_refresh_token(
                    &server_url,
                    &username,
                    next_refresh_token,
                )
                .map_err(|e| e.to_string())?;
            }
            config.romm.password = None;
            config.romm.auth_token = None;
            config.save().map_err(|e| e.to_string())?;
            Ok(Some(RomMAuthSession {
                server_url,
                access_token,
                refreshed: true,
            }))
        }
        Err(error) => {
            tracing::warn!("[RomM] Automatic session renewal failed: {}", error);
            existing_token
                .map(|access_token| RomMAuthSession {
                    server_url,
                    access_token,
                    refreshed: false,
                })
                .map(Some)
                .ok_or_else(|| error.to_string())
        }
    }
}

/// Connect to RomM using a direct access token (for users with SSO/OIDC or API tokens)
#[tauri::command]
pub async fn connect_romm_with_token(
    server_url: String,
    token: String,
    device_name: Option<String>,
) -> Result<String, String> {
    tracing::info!("[RomM] Connecting to server with token: {}", server_url);
    
    // Verify the token works by making a test request, then mirror Argosy by
    // registering this install as an API-mode device. Device pairing performs
    // this registration server-side and therefore does not need this step.
    let client = RomMClient::new(&server_url).with_token(token.clone());
    
    // Try to fetch platforms as a connection test
    client.get_platforms().await
        .map_err(|e| {
            tracing::error!("[RomM] Token verification failed: {}", e);
            format!("Token verification failed: {}", e)
        })?;

    let hostname = default_windows_device_name();
    let raw_device_name = device_name
        .filter(|name| !name.trim().is_empty())
        .unwrap_or_else(|| hostname.clone());
    let normalized_device_name = raw_device_name
        .trim()
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join("-");
    let device_name = if normalized_device_name.starts_with("wingosy-") {
        normalized_device_name
    } else {
        format!("wingosy-{normalized_device_name}")
    };
    let existing_config = AppConfig::load().unwrap_or_default();
    let same_server = existing_config
        .romm
        .server_url
        .as_deref()
        .map(|url| url.trim_end_matches('/') == server_url.trim_end_matches('/'))
        .unwrap_or(false);
    let existing_device_id = same_server
        .then(|| existing_config.romm.device_id.clone())
        .flatten();

    let device_id = if let Some(existing_id) = existing_device_id {
        if client
            .update_wingosy_device(&existing_id, &device_name, &hostname)
            .await
            .map_err(|e| format!("Token verified, but the existing device could not be updated: {e}"))?
        {
            existing_id
        } else {
            client
                .register_wingosy_device(&device_name, &hostname)
                .await
                .map_err(|e| format!("Token verified, but device registration failed: {e}"))?
        }
    } else {
        client
            .register_wingosy_device(&device_name, &hostname)
            .await
            .map_err(|e| format!("Token verified, but device registration failed: {e}"))?
    };
    
    tracing::info!("[RomM] Token verified, saving credentials");
    
    let mut config = AppConfig::load().unwrap_or_default();
    if let (Some(previous_server), Some(previous_username)) =
        (config.romm.server_url.as_deref(), config.romm.username.as_deref())
    {
        crate::romm_credentials::delete_refresh_token(previous_server, previous_username)
            .map_err(|e| e.to_string())?;
    }
    if let Some(previous_server) = config.romm.server_url.as_deref() {
        crate::romm_credentials::delete_device_token(previous_server)
            .map_err(|e| e.to_string())?;
    }
    crate::romm_credentials::store_device_token(&server_url, &token)
        .map_err(|e| e.to_string())?;
    config.romm.server_url = Some(server_url.clone());
    config.romm.auth_method = Some("token".to_string());
    config.romm.username = None;
    config.romm.password = None;
    config.romm.auth_token = None;
    config.romm.device_id = Some(device_id);
    config.save().map_err(|e| e.to_string())?;
    
    tracing::info!("[RomM] Connected to {} with token", server_url);
    Ok(token)
}

#[derive(Debug, Serialize)]
pub struct SyncResult {
    pub games_added: i32,
    pub games_updated: i32,
    pub games_deleted: i32,
    pub total_games: i32,
}

#[tauri::command]
pub async fn sync_romm_library(
    server_url: String,
    token: String,
) -> Result<Vec<Game>, String> {
    use crate::models::map_romm_slug;
    
    tracing::info!("[RomM] Starting library sync from {}", server_url);
    
    let client = RomMClient::new(&server_url).with_token(token);
    let db = Database::open().map_err(|e| e.to_string())?;
    
    let romm_platforms = client.get_platforms().await.map_err(|e| {
        tracing::error!("[RomM] Failed to fetch platforms: {}", e);
        e.to_string()
    })?;
    
    tracing::info!("[RomM] Found {} platforms", romm_platforms.len());
    
    // Update platform info (logos, names)
    for romm_platform in &romm_platforms {
        let platform_id = map_romm_slug(&romm_platform.slug);
        
        let logo_url = romm_platform.url_logo.as_ref().map(|logo| {
            if logo.starts_with("http") {
                logo.clone()
            } else {
                format!("{}{}", server_url.trim_end_matches('/'), logo)
            }
        });
        
        let platform = Platform {
            id: platform_id.clone(),
            name: romm_platform.display_name.clone().unwrap_or_else(|| romm_platform.name.clone()),
            short_name: Some(romm_platform.name.clone()),
            extensions: vec![],
            logo_path: logo_url,
            sort_order: 0,
        };
        
        if let Err(e) = db.insert_platform(&platform) {
            tracing::warn!("[RomM] Failed to update platform {}: {}", platform_id, e);
        }
    }
    
    // === ARGOSY-STYLE SYNC PATTERN ===
    // Step 1: Mark ALL RomM games as dirty before sync
    // This allows us to detect games that no longer exist on the server
    let dirty_count = db.mark_romm_games_dirty().map_err(|e| e.to_string())?;
    tracing::info!("[RomM] Marked {} existing RomM games as dirty", dirty_count);
    
    // Step 2: Fetch ALL ROMs and upsert them (clearing dirty flag as we go)
    tracing::info!("[RomM] Fetching all ROMs...");
    let mut all_games = Vec::new();
    let mut games_added = 0;
    let mut games_updated = 0;
    let mut offset = 0;
    let limit = 1000;
    
    loop {
        // Retry logic for unreliable connections
        let mut retries = 3;
        let response = loop {
            match client.get_roms(None, limit, offset).await {
                Ok(r) => break r,
                Err(e) => {
                    retries -= 1;
                    if retries == 0 {
                        // On failure, clear dirty flags to avoid accidental deletion
                        let _ = db.clear_all_sync_dirty();
                        tracing::error!("[RomM] Failed to fetch ROMs after retries: {}", e);
                        return Err(e.to_string());
                    }
                    tracing::warn!("[RomM] Retry {} - fetch failed: {}", 3 - retries, e);
                    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                }
            }
        };
        
        let fetched_count = response.items.len();
        tracing::info!("[RomM] Fetched {} ROMs (offset={}, total={})", 
            fetched_count, offset, response.total);
        
        for rom in response.items {
            let romm_id = rom.id;
            let game = rom.into_game(&server_url);
            
            // Check if game exists to track added vs updated
            let existing = db.get_game_by_romm_id(romm_id).ok().flatten();
            let is_new = existing.is_none();
            
            // Upsert the game
            let game_id = db.upsert_game(&game).map_err(|e| e.to_string())?;
            
            // Clear the dirty flag for this game (it exists on server)
            db.clear_sync_dirty(game_id).map_err(|e| e.to_string())?;
            
            if is_new {
                games_added += 1;
            } else {
                games_updated += 1;
            }
            
            // Get the updated game with proper ID
            if let Ok(Some(updated_game)) = db.get_game(game_id) {
                all_games.push(updated_game);
            }
        }
        
        // Check if we've fetched all ROMs
        if fetched_count < limit as usize || all_games.len() >= response.total as usize {
            break;
        }
        
        offset += limit;
    }
    
    // Step 3: Delete games that are still marked dirty (no longer on server)
    // These are games that existed locally but weren't seen during sync
    let dirty_games = db.get_dirty_games().map_err(|e| e.to_string())?;
    let games_to_delete: Vec<_> = dirty_games
        .iter()
        .filter(|g| g.romm_id.is_some()) // Only delete RomM-sourced games
        .collect();
    
    let mut games_deleted = 0;
    for game in &games_to_delete {
        tracing::info!(
            "[RomM] Removing orphaned game no longer on server: {} (romm_id={:?}, hidden={})", 
            game.name, game.romm_id, game.is_hidden
        );
        if let Err(e) = db.delete_game(game.id) {
            tracing::warn!("[RomM] Failed to delete orphaned game {}: {}", game.id, e);
        } else {
            games_deleted += 1;
        }
    }
    
    // Step 4: Clear any remaining dirty flags (cleanup)
    db.clear_all_sync_dirty().map_err(|e| e.to_string())?;
    
    tracing::info!(
        "[RomM] Library sync complete: {} added, {} updated, {} deleted, {} total", 
        games_added, games_updated, games_deleted, all_games.len()
    );
    
    Ok(all_games)
}

#[tauri::command]
pub async fn download_rom(
    app: tauri::AppHandle,
    game_id: i64,
    server_url: String,
    token: String,
) -> Result<String, String> {
    tracing::info!("[Download] Downloading ROM for game id={}", game_id);
    let _download_activity = crate::storage::begin_rom_download()?;
    
    let db = Database::open().map_err(|e| e.to_string())?;
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    
    let game = db.get_game(game_id).map_err(|e| e.to_string())?
        .ok_or("Game not found")?;
    if game.romm_id.is_none() {
        return Err("Game has no RomM ID".to_string());
    }

    let app_handle = app.clone();
    let gid = game_id;
    let _ = app_handle.emit(
        "rom-download-started",
        serde_json::json!({
            "game_id": gid,
            "game_name": game.name.clone(),
        }),
    );

    let app_progress = app_handle.clone();
    let progress_game_name = game.name.clone();
    let download_result = prepare_remote_rom(
        &db,
        &config,
        &game,
        &server_url,
        &token,
        move |p| {
            let _ = app_progress.emit(
                "rom-download-progress",
                serde_json::json!({
                    "game_id": gid,
                    "game_name": progress_game_name.clone(),
                    "downloaded": p.downloaded,
                    "total": p.total,
                    "percent": p.percent,
                }),
            );
        },
    )
    .await;

    let updated_game = match download_result {
        Ok(prepared) => prepared.game,
        Err(msg) => {
            let _ = app_handle.emit(
                "rom-download-error",
                serde_json::json!({
                    "game_id": gid,
                    "game_name": game.name.clone(),
                    "message": msg,
                }),
            );
            tracing::error!("[Download] Download failed: {}", msg);
            return Err(msg);
        }
    };
    let dest_str = updated_game
        .local_file_path
        .clone()
        .ok_or("ROM download completed without a local path")?;
    let _ = app_handle.emit(
        "rom-download-complete",
        serde_json::json!({
            "game_id": gid,
            "game_name": updated_game.name,
            "path": dest_str,
        }),
    );

    tracing::info!("[Download] ROM download complete: {}", dest_str);
    Ok(dest_str)
}

#[tauri::command]
pub async fn get_game_saves(
    romm_id: i32,
    server_url: String,
    token: String,
) -> Result<Vec<crate::api::RomMSave>, String> {
    let client = RomMClient::new(&server_url).with_token(token);
    client.get_saves(romm_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn download_game_save(
    romm_id: i32,
    save_id: i32,
    server_url: String,
    token: String,
) -> Result<String, String> {
    let client = RomMClient::new(&server_url).with_token(token);
    
    let save_data = client.download_save(romm_id, save_id).await
        .map_err(|e| e.to_string())?;
    
    let saves_dir = AppConfig::saves_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&saves_dir).map_err(|e| e.to_string())?;
    
    let save_path = saves_dir.join(format!("save_{}_{}.sav", romm_id, save_id));
    std::fs::write(&save_path, save_data).map_err(|e| e.to_string())?;
    
    Ok(save_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn upload_game_save(
    romm_id: i32,
    file_path: String,
    server_url: String,
    token: String,
) -> Result<(), String> {
    let client = RomMClient::new(&server_url).with_token(token);
    
    let save_data = std::fs::read(&file_path).map_err(|e| e.to_string())?;
    let filename = std::path::Path::new(&file_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "save.sav".to_string());
    
    client.upload_save(romm_id, save_data, &filename).await
        .map_err(|e| e.to_string())
}

#[derive(Debug, Serialize)]
pub struct SwitchSavePathInfo {
    pub title_id: String,
    pub local_save_path: String,
    pub eden_save_base: String,
    pub default_slot: String,
}

#[tauri::command]
pub async fn get_switch_save_path_info(game_id: i64) -> Result<SwitchSavePathInfo, String> {
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    let db = Database::open().map_err(|e| e.to_string())?;
    let game = db
        .get_game(game_id)
        .map_err(|e| e.to_string())?
        .ok_or("Game not found")?;
    let rom_path = game
        .local_file_path
        .as_deref()
        .or(Some(game.file_path.as_str()))
        .ok_or("No ROM path")?;
    let (local, title_id) =
        crate::sync::resolve_local_title_save_path(&config, rom_path).map_err(|e| e.to_string())?;
    let base = crate::sync::switch_save::resolve_eden_save_base(&config);
    Ok(SwitchSavePathInfo {
        title_id,
        local_save_path: local.to_string_lossy().into_owned(),
        eden_save_base: base.to_string_lossy().into_owned(),
        default_slot: crate::sync::switch_save::DEFAULT_SAVE_SLOT.to_string(),
    })
}

#[tauri::command]
pub async fn upload_switch_save(
    game_id: i64,
    slot: Option<String>,
) -> Result<crate::sync::SwitchSaveSyncResult, String> {
    let mut config = AppConfig::load().map_err(|e| e.to_string())?;
    let db = Database::open().map_err(|e| e.to_string())?;
    let game = db
        .get_game(game_id)
        .map_err(|e| e.to_string())?
        .ok_or("Game not found")?;
    crate::sync::upload_switch_save_from_eden(&game, &mut config, slot)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn download_switch_save(
    game_id: i64,
    slot: Option<String>,
    save_id: Option<i32>,
) -> Result<crate::sync::SwitchSaveSyncResult, String> {
    let mut config = AppConfig::load().map_err(|e| e.to_string())?;
    let db = Database::open().map_err(|e| e.to_string())?;
    let game = db
        .get_game(game_id)
        .map_err(|e| e.to_string())?
        .ok_or("Game not found")?;
    crate::sync::download_switch_save_to_eden(&game, &mut config, slot, save_id)
        .await
        .map_err(|e| e.to_string())
}

// ========== Game Management Commands ==========

#[tauri::command]
pub async fn delete_local_rom(game_id: i64) -> Result<String, String> {
    tracing::info!("[Game] Deleting local ROM for game id={}", game_id);
    
    let db = Database::open().map_err(|e| e.to_string())?;
    let game = db.get_game(game_id).map_err(|e| e.to_string())?
        .ok_or("Game not found")?;
    
    let mut deleted_path = String::new();
    
    if let Some(local_path) = &game.local_file_path {
        let path = std::path::Path::new(local_path);
        if path.exists() {
            std::fs::remove_file(path).map_err(|e| {
                tracing::error!("[Game] Failed to delete file: {}", e);
                format!("Failed to delete file: {}", e)
            })?;
            deleted_path = local_path.clone();
            tracing::info!("[Game] Deleted ROM file: {}", local_path);
        }
    }
    
    if game.romm_id.is_some() {
        db.clear_local_path(game_id).map_err(|e| e.to_string())?;
        tracing::info!("[Game] Cleared local path, game remains in library (RomM sync)");
    } else {
        db.delete_game(game_id).map_err(|e| e.to_string())?;
        tracing::info!("[Game] Deleted local-only game from database");
    }
    
    Ok(deleted_path)
}

#[tauri::command]
pub async fn toggle_game_hidden(game_id: i64) -> Result<bool, String> {
    tracing::info!("[Game] Toggling hidden status for game id={}", game_id);
    
    let db = Database::open().map_err(|e| e.to_string())?;
    let game = db.get_game(game_id).map_err(|e| e.to_string())?
        .ok_or("Game not found")?;
    
    let new_state = !game.is_hidden;
    db.set_hidden(game_id, new_state).map_err(|e| e.to_string())?;
    
    tracing::info!("[Game] Game {} is now {}", game.name, if new_state { "hidden" } else { "visible" });
    Ok(new_state)
}

#[tauri::command]
pub async fn get_hidden_games() -> Result<Vec<Game>, String> {
    let db = Database::open().map_err(|e| e.to_string())?;
    db.get_hidden_games().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn unhide_game(game_id: i64) -> Result<(), String> {
    let db = Database::open().map_err(|e| e.to_string())?;
    db.set_hidden(game_id, false).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn open_rom_location(game_id: i64) -> Result<(), String> {
    tracing::info!("[Game] Opening ROM location for game id={}", game_id);
    
    let db = Database::open().map_err(|e| e.to_string())?;
    let game = db.get_game(game_id).map_err(|e| e.to_string())?
        .ok_or("Game not found")?;
    
    let path = game.local_file_path.clone()
        .or_else(|| if game.file_path.is_empty() { None } else { Some(game.file_path.clone()) })
        .ok_or("Game has no local file")?;
    
    let file_path = std::path::Path::new(&path);
    
    if !file_path.exists() {
        return Err("File no longer exists".to_string());
    }
    
    let _parent = file_path.parent().ok_or("Invalid file path")?;
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &file_path.to_string_lossy()])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &file_path.to_string_lossy()])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    tracing::info!("[Game] Opened file location: {}", path);
    Ok(())
}

#[tauri::command]
pub fn open_logs_folder() -> Result<(), String> {
    let log_dir = AppConfig::logs_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&log_dir).map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(&log_dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(&log_dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(&log_dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    tracing::info!("[Support] Opened logs folder: {:?}", log_dir);
    Ok(())
}

#[tauri::command]
pub async fn refresh_game_metadata(
    game_id: i64,
    server_url: String,
    token: String,
) -> Result<Game, String> {
    tracing::info!("[Game] Refreshing metadata for game id={}", game_id);
    
    let db = Database::open().map_err(|e| e.to_string())?;
    let game = db.get_game(game_id).map_err(|e| e.to_string())?
        .ok_or("Game not found")?;
    
    let romm_id = game.romm_id.ok_or("Game has no RomM ID (local-only game)")?;
    
    let client = RomMClient::new(&server_url).with_token(token);
    let rom = client.get_rom(romm_id).await.map_err(|e| e.to_string())?;
    
    let mut updated_game = rom.into_game(&server_url);
    updated_game.id = game.id;
    updated_game.is_favorite = game.is_favorite;
    updated_game.is_hidden = game.is_hidden;
    updated_game.play_count = game.play_count;
    updated_game.play_time_minutes = game.play_time_minutes;
    updated_game.last_played_at = game.last_played_at;
    updated_game.local_file_path = game.local_file_path.clone();
    updated_game.library_status = game.library_status.clone();
    updated_game.personal_rating = game.personal_rating;
    updated_game.personal_difficulty = game.personal_difficulty;

    if game.local_file_path.is_some() {
        updated_game.sync_state = crate::models::SyncState::Synced;
    }
    
    db.update_game(&updated_game).map_err(|e| e.to_string())?;
    
    tracing::info!("[Game] Metadata refreshed for: {}", updated_game.name);
    Ok(updated_game)
}

#[tauri::command]
pub fn get_retroarch_default_core_dlls() -> std::collections::HashMap<String, String> {
    retroarch_cores()
        .into_iter()
        .map(|(k, v)| (k, v.to_string()))
        .collect()
}

#[tauri::command]
pub async fn detect_emulators() -> Result<Vec<EmulatorInfo>, String> {
    tracing::info!("[Emulators] Starting emulator detection");
    
    let detected = detect_installed_emulators();
    let config = AppConfig::load().unwrap_or_default();
    let all_emulators = default_emulators();
    
    let mut result: Vec<EmulatorInfo> = Vec::new();
    let mut installed_count = 0;
    
    for emu in all_emulators {
        let detected_match = detected.iter().find(|d| d.id == emu.id);
        let configured_path = configured_emulator_path(&config, &emu.id);

        let configured_retroarch = emu.id == "retroarch" && configured_path.is_some();
        let (is_installed, installed_path, install_type, version) = if configured_retroarch {
            let path = configured_path.expect("configured RetroArch path was checked");
            let managed = crate::emulators::retroarch::managed_profile_enabled(&config, &path)
                && AppConfig::emulators_dir().ok().is_some_and(|root| path.starts_with(root));
            (true, Some(path.to_string_lossy().to_string()), Some(if managed { "managed" } else { "external" }.to_string()), if managed { config.emulators.retroarch_manifest_version.clone() } else { None })
        } else if let Some(d) = detected_match {
            let detected_managed = emu.id == "retroarch"
                && d.install_type == crate::emulators::detection::InstallType::Managed
                && crate::emulators::retroarch::managed_manifest_marker_matches(&d.path);
            let detected_install_type = if emu.id == "retroarch" {
                if detected_managed { "managed" } else { "external" }
            } else { d.install_type.as_str() };
            (
                true,
                Some(d.path.to_string_lossy().to_string()),
                Some(detected_install_type.to_string()),
                if detected_managed { Some(crate::emulators::retroarch::MANIFEST_VERSION.to_string()) } else if emu.id == "retroarch" { None } else { d.version.clone() },
            )
        } else if let Some(p) = configured_path {
            let kind = AppConfig::emulators_dir()
                .ok()
                .filter(|root| p.starts_with(root))
                .map(|_| "managed")
                .unwrap_or("custom");
            (
                true,
                Some(p.to_string_lossy().to_string()),
                Some(kind.to_string()),
                None,
            )
        } else {
            (false, None, None, None)
        };

        if is_installed {
            installed_count += 1;
        }
        
        result.push(EmulatorInfo {
            id: emu.id.clone(),
            name: emu.name.clone(),
            is_installed,
            installed_path,
            install_type,
            version,
            has_download: emu.download_url.is_some() || emu.github_repo.is_some(),
            supported_platforms: emu.supported_platforms,
        });
    }
    
    tracing::info!("[Emulators] Detection complete: {}/{} emulators installed", installed_count, result.len());
    Ok(result)
}

#[tauri::command]
pub async fn launch_emulator(emulator_path: String) -> Result<(), String> {
    tracing::info!("[Emulators] Launching emulator: {}", emulator_path);
    let path = std::path::PathBuf::from(&emulator_path);
    crate::emulators::detection::launch_emulator(&path)
}

#[tauri::command]
pub async fn open_retroarch_input_setup() -> Result<(), String> {
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    let executable = config.emulators.retroarch.as_ref().ok_or_else(|| "RetroArch is not configured".to_string())?;
    if !executable.is_file() {
        return Err("Configured RetroArch executable was not found".to_string());
    }
    let mut command = std::process::Command::new(executable);
    if (config.emulators.retroarch_install_kind == RetroArchInstallKind::External
        && config.emulators.retroarch_use_beta_profile)
        || crate::emulators::retroarch::managed_profile_enabled(&config, executable)
    {
        let profile = crate::emulators::retroarch::ensure_profile().map_err(|e| e.to_string())?;
        command.arg(format!("--appendconfig={}", profile.to_string_lossy()));
    }
    command.spawn().map_err(|e| format!("Failed to launch RetroArch input setup: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn set_retroarch_beta_profile(enabled: bool) -> Result<(), String> {
    let mut config = AppConfig::load().map_err(|e| e.to_string())?;
    let executable = config.emulators.retroarch.as_ref().ok_or_else(|| "RetroArch is not configured".to_string())?;
    if !executable.is_file() {
        return Err("Configured RetroArch executable was not found".to_string());
    }
    let managed = crate::emulators::retroarch::managed_profile_enabled(&config, executable)
        && AppConfig::emulators_dir().ok().is_some_and(|root| executable.starts_with(root));
    if managed {
        return Err("Managed RetroArch always uses the certified Wingosy profile".to_string());
    }
    config.emulators.retroarch_install_kind = RetroArchInstallKind::External;
    config.emulators.retroarch_manifest_version = None;
    config.emulators.retroarch_use_beta_profile = enabled;
    config.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reset_retroarch_controller_additions() -> Result<Option<String>, String> {
    crate::emulators::retroarch::reset_profile()
        .map(|path| path.map(|path| path.to_string_lossy().into_owned()))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_emulator_location(emulator_path: String) -> Result<(), String> {
    tracing::info!("[Emulators] Opening location: {}", emulator_path);
    let path = std::path::PathBuf::from(&emulator_path);
    crate::emulators::detection::open_emulator_location(&path)
}

#[tauri::command]
pub async fn get_game_details(game_id: i64) -> Result<Game, String> {
    let db = Database::open().map_err(|e| e.to_string())?;
    db.get_game(game_id).map_err(|e| e.to_string())?
        .ok_or_else(|| "Game not found".to_string())
}

/// Persist library status and personal 1–5 ratings (0 = unset for ratings).
#[tauri::command]
pub async fn update_game_personal_fields(
    game_id: i64,
    library_status: Option<String>,
    personal_rating: i32,
    personal_difficulty: i32,
) -> Result<Game, String> {
    let db = Database::open().map_err(|e| e.to_string())?;
    let mut game = db
        .get_game(game_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Game not found".to_string())?;

    game.library_status = library_status.and_then(|s| {
        let t = s.trim();
        if t.is_empty() {
            None
        } else {
            Some(t.to_string())
        }
    });
    game.personal_rating = personal_rating.clamp(0, 5);
    game.personal_difficulty = personal_difficulty.clamp(0, 5);

    db.update_game(&game).map_err(|e| e.to_string())?;
    db.get_game(game_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Game not found".to_string())
}

#[tauri::command]
pub async fn get_collections() -> Result<Vec<Collection>, String> {
    let db = Database::open().map_err(|e| e.to_string())?;
    db.get_all_collections().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_game_to_collection(collection_id: i64, game_id: i64) -> Result<(), String> {
    let db = Database::open().map_err(|e| e.to_string())?;
    db.add_game_to_collection(collection_id, game_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_games(query: String) -> Result<Vec<Game>, String> {
    let db = Database::open().map_err(|e| e.to_string())?;
    
    let filter = GameFilter {
        platform_id: None,
        genre: None,
        search_query: Some(query),
        favorites_only: false,
        sort_by: GameSort::Name,
        sort_descending: false,
    };
    
    db.get_games_filtered(&filter).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_all_emulators() -> Result<Vec<EmulatorInfo>, String> {
    detect_emulators().await
}

/// Fetch the latest Dolphin download URL from their update API
async fn fetch_dolphin_download_url() -> anyhow::Result<String> {
    #[derive(serde::Deserialize)]
    struct DolphinArtifact {
        system: String,
        url: String,
    }
    
    #[derive(serde::Deserialize)]
    struct DolphinUpdate {
        artifacts: Vec<DolphinArtifact>,
    }
    
    let client = reqwest::Client::new();
    let response = client
        .get("https://dolphin-emu.org/update/latest/beta")
        .header("User-Agent", "Wingosy-Launcher")
        .send()
        .await?;
    
    let update: DolphinUpdate = response.json().await?;
    
    // Find Windows x64 artifact
    let artifact = update.artifacts.iter()
        .find(|a| a.system == "Windows x64")
        .ok_or_else(|| anyhow::anyhow!("No Windows x64 artifact found"))?;
    
    tracing::info!("[Emulators] Found Dolphin download: {}", artifact.url);
    Ok(artifact.url.clone())
}

async fn download_verified_retroarch_artifact(
    app: Option<&tauri::AppHandle>,
    artifact: crate::emulators::retroarch::Artifact,
) -> Result<PathBuf, String> {
    let archive_path = crate::emulators::retroarch::temporary_archive_path(artifact.filename);
    if let Err(error) = crate::emulators::installer::download_file_with_progress(
        artifact.url,
        &archive_path,
        |progress| {
            if let Some(app) = app {
                let _ = app.emit(
                    "emulator-download-progress",
                    serde_json::json!({
                        "emulator_id": "retroarch",
                        "phase": "download",
                        "filename": artifact.filename,
                        "downloaded": progress.downloaded,
                        "total": progress.total,
                        "percent": progress.percent,
                    }),
                );
            }
        },
    )
    .await
    {
        std::fs::remove_file(&archive_path).ok();
        return Err(error.to_string());
    }
    if let Err(error) = crate::emulators::retroarch::verify_sha256(&archive_path, artifact.sha256) {
        std::fs::remove_file(&archive_path).ok();
        return Err(error.to_string());
    }
    Ok(archive_path)
}

fn extract_certified_retroarch_cores(archive: &Path, install_root: &Path, format: &str) -> Result<(), String> {
    let staging_dir = crate::emulators::retroarch::temporary_archive_path("cores-extraction");
    std::fs::create_dir_all(&staging_dir).map_err(|e| e.to_string())?;
    let result = (|| {
        crate::emulators::installer::extract_archive(archive, &staging_dir, format).map_err(|e| e.to_string())?;
        let cores_dir = install_root.join("cores");
        std::fs::create_dir_all(&cores_dir).map_err(|e| e.to_string())?;
        let mut copied_filenames = HashSet::new();
        for core in crate::emulators::retroarch::core_artifacts() {
            if !copied_filenames.insert(core.filename) {
                continue;
            }
            let source = walkdir::WalkDir::new(&staging_dir)
                .into_iter().filter_map(Result::ok)
                .find(|entry| entry.file_type().is_file() && entry.file_name().to_string_lossy() == core.filename)
                .map(|entry| entry.into_path())
                .ok_or_else(|| format!("Certified RetroArch core archive did not contain {}", core.filename))?;
            let destination = cores_dir.join(core.filename);
            std::fs::copy(source, &destination).map_err(|e| e.to_string())?;
            crate::emulators::retroarch::verify_sha256(&destination, core.sha256)
                .map_err(|e| e.to_string())?;
        }
        Ok::<(), String>(())
    })();
    std::fs::remove_dir_all(&staging_dir).ok();
    result
}

async fn download_managed_retroarch(_app: tauri::AppHandle) -> Result<String, String> {
    let emulators_dir = AppConfig::emulators_dir().map_err(|e| e.to_string())?;
    let emu_dir = emulators_dir.join("retroarch");
    std::fs::create_dir_all(&emu_dir).map_err(|e| e.to_string())?;
    let artifact = crate::emulators::retroarch::retroarch_artifact();
    let archive = download_verified_retroarch_artifact(Some(&_app), artifact).await?;
    let extracted = crate::emulators::installer::extract_archive(&archive, &emu_dir, artifact.format).map_err(|e| e.to_string())?;
    std::fs::remove_file(&archive).ok();
    let executable = crate::emulators::installer::find_executable(&extracted, &["retroarch.exe", "RetroArch.exe"])
        .ok_or_else(|| "RetroArch executable was not found after extraction".to_string())?;
    let install_root = executable.parent().ok_or_else(|| "RetroArch executable has no install directory".to_string())?;
    let cores_artifact = crate::emulators::retroarch::retroarch_cores_artifact();
    let cores_archive = download_verified_retroarch_artifact(Some(&_app), cores_artifact).await?;
    let core_result = extract_certified_retroarch_cores(&cores_archive, install_root, cores_artifact.format);
    std::fs::remove_file(&cores_archive).ok();
    core_result?;
    crate::emulators::retroarch::ensure_profile().map_err(|e| e.to_string())?;
    crate::emulators::retroarch::write_manifest_marker(&executable).map_err(|e| e.to_string())?;
    let mut config = AppConfig::load().map_err(|e| e.to_string())?;
    config.emulators.retroarch = Some(executable.clone());
    config.emulators.retroarch_install_kind = RetroArchInstallKind::Managed;
    config.emulators.retroarch_manifest_version = Some(crate::emulators::retroarch::MANIFEST_VERSION.to_string());
    config.emulators.retroarch_use_beta_profile = false;
    config.save().map_err(|e| e.to_string())?;
    let path = executable.to_string_lossy().to_string();
    let _ = _app.emit(
        "emulator-download-complete",
        serde_json::json!({
            "emulator_id": "retroarch",
            "path": path,
            "manifest_version": crate::emulators::retroarch::MANIFEST_VERSION,
        }),
    );
    Ok(path)
}

#[tauri::command]
pub async fn download_emulator(app: tauri::AppHandle, emulator_id: String) -> Result<String, String> {
    tracing::info!("[Emulators] Downloading emulator: {}", emulator_id);

    if emulator_id == "retroarch" {
        return download_managed_retroarch(app).await;
    }

    fn emit_progress(app: &tauri::AppHandle, emulator_id: &str, phase: &str, downloaded: u64, total: Option<u64>, percent: Option<u8>) {
        let _ = app.emit(
            "emulator-download-progress",
            serde_json::json!({
                "emulator_id": emulator_id,
                "phase": phase,
                "downloaded": downloaded,
                "total": total,
                "percent": percent,
            }),
        );
    }

    let report_err = |msg: String| {
        let _ = app.emit(
            "emulator-download-error",
            serde_json::json!({ "emulator_id": &emulator_id, "message": &msg }),
        );
        msg
    };

    let emulators = default_emulators();
    let emu = emulators
        .iter()
        .find(|e| e.id == emulator_id)
        .ok_or_else(|| {
            let msg = "Emulator not found".to_string();
            let _ = app.emit(
                "emulator-download-error",
                serde_json::json!({ "emulator_id": emulator_id, "message": msg }),
            );
            msg
        })?;

    let dest_dir = AppConfig::emulators_dir().map_err(|e| {
        let msg = e.to_string();
        let _ = app.emit(
            "emulator-download-error",
            serde_json::json!({ "emulator_id": emulator_id, "message": msg }),
        );
        msg
    })?;
    std::fs::create_dir_all(&dest_dir).map_err(|e| {
        let msg = e.to_string();
        let _ = app.emit(
            "emulator-download-error",
            serde_json::json!({ "emulator_id": emulator_id, "message": msg }),
        );
        msg
    })?;

    let emu_dir = dest_dir.join(&emulator_id);
    std::fs::create_dir_all(&emu_dir).map_err(|e| {
        let msg = e.to_string();
        let _ = app.emit(
            "emulator-download-error",
            serde_json::json!({ "emulator_id": emulator_id, "message": msg }),
        );
        msg
    })?;
    
    let (download_url, archive_name, format) = if let Some(github_repo) = &emu.github_repo {
        // GitHub release download
        tracing::debug!("[Emulators] Fetching GitHub release from: {}", github_repo);
        
        let release = crate::emulators::github::fetch_latest_release(github_repo).await
            .map_err(|e| {
                tracing::error!("[Emulators] Failed to fetch GitHub release: {}", e);
                report_err(e.to_string())
            })?;
        
        tracing::debug!("[Emulators] Found release: {}", release.tag_name);
        
        // Use emulator's asset pattern if available, otherwise fallback to generic Windows patterns
        let asset = if let Some(pattern) = &emu.asset_pattern {
            crate::emulators::github::find_matching_asset(&release, pattern)
        } else {
            None
        }.or_else(|| crate::emulators::github::find_matching_asset(&release, "(?i)windows.*x64"))
         .or_else(|| crate::emulators::github::find_matching_asset(&release, "(?i)win64"))
         .or_else(|| crate::emulators::github::find_matching_asset(&release, "(?i)mame\\d+b_x64\\.exe$"))
         .or_else(|| crate::emulators::github::find_matching_asset(&release, "(?i)win.*\\.zip$"))
         .or_else(|| crate::emulators::github::find_matching_asset(&release, "(?i)win.*\\.7z$"))
         .ok_or_else(|| {
             tracing::error!("[Emulators] No matching Windows asset found in release. Assets: {:?}", 
                 release.assets.iter().map(|a| &a.name).collect::<Vec<_>>());
             report_err("No Windows asset found in GitHub release".to_string())
         })?;
        
        let fmt = if asset.name.ends_with(".zip") { "zip" } 
            else if asset.name.ends_with(".7z") { "7z" }
            else { emu.archive_format.as_deref().unwrap_or("zip") };
        
        (asset.browser_download_url.clone(), asset.name.clone(), fmt.to_string())
    } else if let Some(direct_url) = &emu.download_url {
        // Forgejo/Gitea: `forgejo://{host}/{owner}/{repo}` — same JSON shape as GitHub releases/latest
        if let Some(rest) = direct_url.strip_prefix("forgejo://") {
            tracing::debug!("[Emulators] Resolving Forgejo release URL: {}", direct_url);
            let mut parts = rest.split('/');
            let host = parts.next().filter(|s| !s.is_empty()).ok_or_else(|| {
                report_err("Invalid forgejo:// URL (missing host)".to_string())
            })?;
            let owner = parts.next().filter(|s| !s.is_empty()).ok_or_else(|| {
                report_err("Invalid forgejo:// URL (missing owner)".to_string())
            })?;
            let repo_name = parts.next().filter(|s| !s.is_empty()).ok_or_else(|| {
                report_err("Invalid forgejo:// URL (missing repository)".to_string())
            })?;
            let api_origin = if host.starts_with("http://") || host.starts_with("https://") {
                host.to_string()
            } else {
                format!("https://{}", host)
            };
            let release = crate::emulators::github::fetch_forgejo_latest_release(
                &api_origin,
                owner,
                repo_name,
            )
            .await
            .map_err(|e| {
                tracing::error!("[Emulators] Failed to fetch Forgejo release: {}", e);
                report_err(e.to_string())
            })?;
            tracing::debug!("[Emulators] Found Forgejo release: {}", release.tag_name);
            let asset = if let Some(pattern) = &emu.asset_pattern {
                crate::emulators::github::find_matching_asset(&release, pattern)
            } else {
                None
            }
            .or_else(|| crate::emulators::github::find_matching_asset(&release, "(?i)windows.*x64"))
            .or_else(|| crate::emulators::github::find_matching_asset(&release, "(?i)win64"))
            .or_else(|| crate::emulators::github::find_matching_asset(&release, "(?i)win.*\\.zip$"))
            .or_else(|| crate::emulators::github::find_matching_asset(&release, "(?i)win.*\\.7z$"))
            .ok_or_else(|| {
                tracing::error!(
                    "[Emulators] No matching Windows asset in Forgejo release. Assets: {:?}",
                    release.assets.iter().map(|a| &a.name).collect::<Vec<_>>()
                );
                report_err("No Windows asset found in Forgejo release".to_string())
            })?;
            let fmt = if asset.name.ends_with(".zip") {
                "zip"
            } else if asset.name.ends_with(".7z") {
                "7z"
            } else {
                emu.archive_format.as_deref().unwrap_or("zip")
            };
            (
                asset.browser_download_url.clone(),
                asset.name.clone(),
                fmt.to_string(),
            )
        } else if direct_url == "dolphin-api://latest" {
            tracing::debug!("[Emulators] Fetching Dolphin download URL from API");
            
            let dolphin_url = fetch_dolphin_download_url().await
                .map_err(|e| {
                    tracing::error!("[Emulators] Failed to fetch Dolphin URL: {}", e);
                    report_err(e.to_string())
                })?;
            
            let filename = dolphin_url
                .split('/')
                .next_back()
                .unwrap_or("dolphin.7z")
                .to_string();
            (dolphin_url, filename, "7z".to_string())
        } else {
            // Direct download URL (e.g., RetroArch buildbot)
            tracing::debug!("[Emulators] Using direct download URL: {}", direct_url);
            
            let filename = direct_url
                .split('/')
                .next_back()
                .unwrap_or("emulator.zip")
                .to_string();
            let fmt = emu.archive_format.as_deref().unwrap_or(
                if filename.ends_with(".7z") { "7z" } else { "zip" }
            );
            
            (direct_url.clone(), filename, fmt.to_string())
        }
    } else {
        tracing::error!("[Emulators] No download source configured for {}", emulator_id);
        return Err(report_err(
            "Emulator has no download URL or GitHub repo configured".to_string(),
        ));
    };

    let safe_leaf = Path::new(&archive_name)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("download.bin");
    let archive_path = dest_dir.join(format!("{}__{}", emulator_id, safe_leaf));

    tracing::info!("[Emulators] Downloading: {} -> {:?}", archive_name, archive_path);

    let _ = app.emit(
        "emulator-download-started",
        serde_json::json!({
            "emulator_id": &emulator_id,
            "filename": archive_name,
        }),
    );

    let eid_dl = emulator_id.clone();
    let app_dl = app.clone();
    if let Err(e) =
        crate::emulators::installer::download_file_with_progress(&download_url, &archive_path, move |p| {
            emit_progress(
                &app_dl,
                &eid_dl,
                "download",
                p.downloaded,
                p.total,
                p.percent,
            );
        })
        .await
    {
        let msg = e.to_string();
        tracing::error!("[Emulators] Download failed: {}", msg);
        return Err(report_err(msg));
    }

    emit_progress(&app, &emulator_id, "extract", 0, None, None);

    tracing::info!("[Emulators] Download complete, extracting {} archive...", format);

    let extracted_dir = if format == "exe" && emulator_id.as_str() == "mame" {
        let dest_exe = emu_dir.join("mame.exe");
        match std::fs::copy(&archive_path, &dest_exe) {
            Ok(_) => emu_dir.clone(),
            Err(e) => {
                let msg = e.to_string();
                tracing::error!("[Emulators] Failed to install MAME executable: {}", msg);
                return Err(report_err(msg));
            }
        }
    } else {
        match crate::emulators::installer::extract_archive(&archive_path, &emu_dir, &format) {
            Ok(d) => d,
            Err(e) => {
                let msg = e.to_string();
                tracing::error!("[Emulators] Extraction failed: {}", msg);
                return Err(report_err(msg));
            }
        }
    };
    
    // Clean up the archive
    std::fs::remove_file(&archive_path).ok();
    
    // Find the actual executable
    let exe_names: Vec<&str> = match emulator_id.as_str() {
        "retroarch" => vec!["retroarch.exe", "RetroArch.exe"],
        "dolphin" => vec!["Dolphin.exe"],
        "pcsx2" => vec!["pcsx2-qt.exe", "pcsx2.exe", "pcsx2-qtx64.exe"],
        "rpcs3" => vec!["rpcs3.exe"],
        "ppsspp" => vec!["PPSSPPWindows64.exe", "PPSSPPWindows.exe"],
        "duckstation" => vec!["duckstation-qt-x64-ReleaseLTCG.exe", "duckstation-nogui-x64-ReleaseLTCG.exe"],
        "cemu" => vec!["Cemu.exe"],
        "eden" => vec!["eden.exe", "Eden.exe"],
        "citra" => vec!["lime3ds.exe", "citra-qt.exe"],
        "melonds" => vec!["melonDS.exe"],
        "mgba" => vec!["mGBA.exe"],
        "flycast" => vec!["flycast.exe"],
        "xemu" => vec!["xemu.exe"],
        "xenia" => vec!["xenia_canary.exe", "xenia.exe"],
        "mame" => vec!["mame.exe", "mame64.exe"],
        _ => vec![],
    };
    
    let exe_path = if !exe_names.is_empty() {
        crate::emulators::installer::find_executable(&extracted_dir, &exe_names)
            .unwrap_or(extracted_dir.clone())
    } else {
        extracted_dir.clone()
    };
    
    tracing::info!("[Emulators] Emulator installed: {:?}", exe_path);
    
    // Update config with the new emulator path
    let mut config = AppConfig::load().map_err(|e| e.to_string())?;
    match emulator_id.as_str() {
        "retroarch" => config.emulators.retroarch = Some(exe_path.clone()),
        "dolphin" => config.emulators.dolphin = Some(exe_path.clone()),
        "pcsx2" => config.emulators.pcsx2 = Some(exe_path.clone()),
        "rpcs3" => config.emulators.rpcs3 = Some(exe_path.clone()),
        "ppsspp" => config.emulators.ppsspp = Some(exe_path.clone()),
        "duckstation" => config.emulators.duckstation = Some(exe_path.clone()),
        "cemu" => config.emulators.cemu = Some(exe_path.clone()),
        "eden" => config.emulators.eden = Some(exe_path.clone()),
        "citra" => config.emulators.citra = Some(exe_path.clone()),
        "melonds" => config.emulators.melonds = Some(exe_path.clone()),
        "mgba" => config.emulators.mgba = Some(exe_path.clone()),
        "flycast" => config.emulators.flycast = Some(exe_path.clone()),
        "xemu" => config.emulators.xemu = Some(exe_path.clone()),
        "xenia" => config.emulators.xenia = Some(exe_path.clone()),
        "mame" => config.emulators.mame = Some(exe_path.clone()),
        _ => {}
    }
    config.save().map_err(|e| e.to_string())?;
    tracing::info!("[Emulators] Config updated with {} path", emulator_id);

    let dest_str = exe_path.to_string_lossy().to_string();
    let _ = app.emit(
        "emulator-download-complete",
        serde_json::json!({
            "emulator_id": emulator_id,
            "path": dest_str,
        }),
    );

    Ok(dest_str)
}

#[tauri::command]
pub async fn uninstall_emulator(emulator_id: String) -> Result<(), String> {
    tracing::info!("[Emulators] Uninstalling emulator: {}", emulator_id);
    
    // Get emulators directory
    let emulators_dir = AppConfig::emulators_dir().map_err(|e| e.to_string())?;
    let emu_dir = emulators_dir.join(&emulator_id);
    
    // Delete the emulator folder if it exists
    if emu_dir.exists() {
        tracing::debug!("[Emulators] Removing directory: {:?}", emu_dir);
        std::fs::remove_dir_all(&emu_dir).map_err(|e| {
            tracing::error!("[Emulators] Failed to remove directory: {}", e);
            format!("Failed to remove emulator directory: {}", e)
        })?;
    }
    
    // Clear the config path
    let mut config = AppConfig::load().map_err(|e| e.to_string())?;
    match emulator_id.as_str() {
        "retroarch" => {
            config.emulators.retroarch = None;
            config.emulators.retroarch_install_kind = RetroArchInstallKind::External;
            config.emulators.retroarch_manifest_version = None;
            config.emulators.retroarch_use_beta_profile = false;
        }
        "dolphin" => config.emulators.dolphin = None,
        "pcsx2" => config.emulators.pcsx2 = None,
        "rpcs3" => config.emulators.rpcs3 = None,
        "ppsspp" => config.emulators.ppsspp = None,
        "duckstation" => config.emulators.duckstation = None,
        "cemu" => config.emulators.cemu = None,
        "eden" => config.emulators.eden = None,
        "citra" => config.emulators.citra = None,
        "melonds" => config.emulators.melonds = None,
        "mgba" => config.emulators.mgba = None,
        "flycast" => config.emulators.flycast = None,
        "xemu" => config.emulators.xemu = None,
        "xenia" => config.emulators.xenia = None,
        "mame" => config.emulators.mame = None,
        _ => {
            tracing::warn!("[Emulators] Unknown emulator ID: {}", emulator_id);
        }
    }
    config.save().map_err(|e| e.to_string())?;
    
    tracing::info!("[Emulators] Successfully uninstalled {}", emulator_id);
    Ok(())
}

#[tauri::command]
pub async fn download_retroarch_core(core_name: String) -> Result<String, String> {
    tracing::info!("[RetroArch] Downloading core: {}", core_name);
    
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    
    let retroarch_path = config.emulators.retroarch
        .ok_or("RetroArch not configured")?;

    if config.emulators.retroarch_install_kind == RetroArchInstallKind::Managed {
        let resolved_core_name = crate::emulators::cores::resolve_core_filename(&core_name)
            .map_err(|e| e.to_string())?;
        let artifact = crate::emulators::retroarch::core_artifact_for_filename(&resolved_core_name)
            .ok_or_else(|| format!("Unsupported certified RetroArch core: {resolved_core_name}"))?;
        let archive = download_verified_retroarch_artifact(None, artifact).await?;
        let root = retroarch_path.parent().ok_or("RetroArch has no install directory")?;
        let result = extract_certified_retroarch_cores(&archive, root, artifact.format);
        std::fs::remove_file(&archive).ok();
        result?;
        return Ok(root
            .join("cores")
            .join(resolved_core_name)
            .to_string_lossy()
            .to_string());
    }

    tracing::warn!("[RetroArch] External core download is unverified: {}", core_name);
    let core_path = crate::emulators::cores::download_core(&core_name, &retroarch_path).await
        .map_err(|e| {
            tracing::error!("[RetroArch] Core download failed: {}", e);
            e.to_string()
        })?;
    
    tracing::info!("[RetroArch] Core installed: {:?}", core_path);
    Ok(core_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_missing_cores() -> Result<Vec<MissingCore>, String> {
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    let db = Database::open().map_err(|e| e.to_string())?;
    
    let retroarch_path = match &config.emulators.retroarch {
        Some(p) => p,
        None => return Ok(vec![]),
    };
    
    let platforms = db.get_platforms_with_games().map_err(|e| e.to_string())?;
    let cores_map = retroarch_cores();
    let managed_install = config.emulators.retroarch_install_kind == RetroArchInstallKind::Managed;
    let managed_install_ready = managed_install
        && crate::emulators::retroarch::managed_install_is_ready(&config, retroarch_path);
    let mut missing = Vec::new();
    
    for (platform, count) in platforms {
        if count == 0 { continue; }
        
        if let Some(core_dll) = cores_map.get(&platform.id).copied() {
            if managed_install
                && !crate::emulators::retroarch::core_artifacts()
                    .iter()
                    .any(|core| core.platform_id == platform.id.as_str())
            {
                continue;
            }
            let is_installed = managed_install_ready
                || (!managed_install
                    && crate::emulators::cores::is_core_installed(retroarch_path, core_dll));

            if !is_installed {
                missing.push(MissingCore {
                    core_filename: core_dll.to_string(),
                    platform_name: platform.name,
                });
            }
        }
    }
    
    Ok(missing)
}

/// Platforms for which RetroArch's **mapped** libretro core DLL is present on disk (`retroarch_cores()` keys only).
#[tauri::command]
pub fn get_platform_ids_with_installed_retroarch_core() -> Result<Vec<String>, String> {
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    let Some(ref ra_exe) = config.emulators.retroarch else {
        return Ok(Vec::new());
    };
    if !ra_exe.exists() {
        return Ok(Vec::new());
    }
    if config.emulators.retroarch_install_kind == RetroArchInstallKind::Managed
        && !crate::emulators::retroarch::managed_install_is_ready(&config, ra_exe)
    {
        return Ok(Vec::new());
    }

    let mut ready: Vec<String> = retroarch_cores()
        .keys()
        .filter(|pid| retroarch_core_installed_for_platform(ra_exe, pid))
        .cloned()
        .collect();
    ready.sort_unstable();
    Ok(ready)
}

#[tauri::command]
pub async fn apply_detected_paths() -> Result<i32, String> {
    tracing::info!("[Config] Applying detected emulator paths");
    
    let detected = detect_installed_emulators();
    let mut config = AppConfig::load().map_err(|e| e.to_string())?;
    let mut count = 0;
    
    for emu in &detected {
        let path = Some(emu.path.clone());
        let changed = match emu.id.as_str() {
            "retroarch" if config.emulators.retroarch.is_none() => {
                config.emulators.retroarch = path;
                if emu.install_type == crate::emulators::detection::InstallType::Managed
                    && crate::emulators::retroarch::managed_manifest_marker_matches(&emu.path)
                {
                    config.emulators.retroarch_install_kind = RetroArchInstallKind::Managed;
                    config.emulators.retroarch_manifest_version = Some(crate::emulators::retroarch::MANIFEST_VERSION.to_string());
                } else {
                    config.emulators.retroarch_install_kind = RetroArchInstallKind::External;
                    config.emulators.retroarch_manifest_version = None;
                }
                config.emulators.retroarch_use_beta_profile = false;
                true
            }
            "dolphin" if config.emulators.dolphin.is_none() => {
                config.emulators.dolphin = path;
                true
            }
            "pcsx2" if config.emulators.pcsx2.is_none() => {
                config.emulators.pcsx2 = path;
                true
            }
            "rpcs3" if config.emulators.rpcs3.is_none() => {
                config.emulators.rpcs3 = path;
                true
            }
            "ppsspp" if config.emulators.ppsspp.is_none() => {
                config.emulators.ppsspp = path;
                true
            }
            "duckstation" if config.emulators.duckstation.is_none() => {
                config.emulators.duckstation = path;
                true
            }
            "cemu" if config.emulators.cemu.is_none() => {
                config.emulators.cemu = path;
                true
            }
            "eden" if config.emulators.eden.is_none() => {
                config.emulators.eden = path;
                true
            }
            "citra" if config.emulators.citra.is_none() => {
                config.emulators.citra = path;
                true
            }
            "melonds" if config.emulators.melonds.is_none() => {
                config.emulators.melonds = path;
                true
            }
            "mgba" if config.emulators.mgba.is_none() => {
                config.emulators.mgba = path;
                true
            }
            "flycast" if config.emulators.flycast.is_none() => {
                config.emulators.flycast = path;
                true
            }
            "xemu" if config.emulators.xemu.is_none() => {
                config.emulators.xemu = path;
                true
            }
            "xenia" if config.emulators.xenia.is_none() => {
                config.emulators.xenia = path;
                true
            }
            "mame" if config.emulators.mame.is_none() => {
                config.emulators.mame = path;
                true
            }
            _ => false,
        };
        
        if changed {
            tracing::debug!("[Config] Applied path for emulator: {}", emu.id);
            count += 1;
        }
    }
    
    config.save().map_err(|e| e.to_string())?;
    tracing::info!("[Config] Applied {} emulator paths", count);
    Ok(count)
}

#[tauri::command]
pub async fn set_platform_default_emulator(
    platform_id: String,
    emulator_id: Option<String>,
) -> Result<(), String> {
    tracing::info!("[Config] Setting default emulator for {}: {:?}", platform_id, emulator_id);
    
    let mut config = AppConfig::load().map_err(|e| e.to_string())?;
    
    if let Some(emu_id) = emulator_id {
        config.emulators.platform_defaults.insert(platform_id.clone(), emu_id);
    } else {
        config.emulators.platform_defaults.remove(&platform_id);
    }
    
    config.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_platform_default_emulators() -> Result<std::collections::HashMap<String, String>, String> {
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    Ok(config.emulators.platform_defaults.clone())
}

#[tauri::command]
pub async fn get_emulators_for_platform(platform_id: String) -> Result<Vec<EmulatorInfo>, String> {
    let all_emulators = detect_emulators().await?;
    let ra_core_ready = retroarch_has_core_ready_for_platform(&platform_id)?;

    let matching: Vec<EmulatorInfo> = all_emulators
        .into_iter()
        .filter(|e| {
            if !emulator_supports_platform(&e.supported_platforms, &platform_id) {
                return false;
            }
            if e.id == "retroarch" && !ra_core_ready {
                return false;
            }
            true
        })
        .collect();

    Ok(matching)
}

/// GitHub repo used for "latest release" update checks (see README Releases link).
const UPDATE_CHECK_REPO: &str = "auron-labs/wingosy-launcher";

/// `latest.json` attached to each GitHub release (CI uploads it next to the NSIS installer).
fn signed_updater_manifest_for_tag(tag: &str) -> String {
    format!(
        "https://github.com/{}/releases/download/{}/latest.json",
        UPDATE_CHECK_REPO,
        urlencoding::encode(tag)
    )
}

/// Returns the app version when `latest.json` exists and its Windows installer URL responds.
async fn signed_update_manifest_version(
    client: &reqwest::Client,
    manifest_url: &str,
) -> Option<String> {
    let Ok(resp) = client.get(manifest_url).send().await else {
        return None;
    };
    if !resp.status().is_success() {
        return None;
    }
    let Ok(body) = resp.json::<serde_json::Value>().await else {
        return None;
    };
    let version = body.get("version").and_then(|v| v.as_str())?;
    let installer_url = body
        .pointer("/platforms/windows-x86_64/url")
        .and_then(|v| v.as_str())?;
    let installer_is_ready = client
        .head(installer_url)
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false);
    installer_is_ready.then(|| version.to_string())
}

async fn signed_manifest_url_if_ready(
    client: &reqwest::Client,
    tag: &str,
    is_newer: bool,
) -> Option<String> {
    if !is_newer {
        return None;
    }
    let url = signed_updater_manifest_for_tag(tag);
    if signed_update_manifest_version(client, &url).await.is_some() {
        Some(url)
    } else {
        tracing::warn!(
            "[Updater] Signed manifest missing or installer URL unreachable for tag {}",
            tag
        );
        None
    }
}

#[derive(Debug, Serialize)]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub latest_version: Option<String>,
    pub is_update_available: bool,
    pub release_url: Option<String>,
    /// Direct URL to `latest.json` for the Tauri signed updater (same GitHub release as `release_url`).
    pub signed_update_manifest_url: Option<String>,
    pub error: Option<String>,
    /// Channel that was queried (`stable`, `beta`, `nightly`).
    pub channel: String,
}

#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
    html_url: String,
    #[serde(default)]
    prerelease: bool,
}

fn strip_version_prefix(s: &str) -> &str {
    s.trim()
        .strip_prefix('v')
        .or_else(|| s.trim().strip_prefix('V'))
        .unwrap_or(s.trim())
}

fn parse_semver_triple(s: &str) -> Option<(u32, u32, u32)> {
    let s = strip_version_prefix(s);
    let mut parts = s.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch_part = parts.next()?;
    let patch: String = patch_part
        .chars()
        .take_while(|c| c.is_ascii_digit())
        .collect();
    let patch = if patch.is_empty() { 0 } else { patch.parse().ok()? };
    Some((major, minor, patch))
}

fn remote_version_is_newer(latest_tag: &str, current: &str) -> bool {
    match (
        parse_semver_triple(latest_tag),
        parse_semver_triple(current),
    ) {
        (Some(l), Some(c)) => l > c,
        _ => false,
    }
}

fn release_version_is_newer(
    manifest_version: Option<&str>,
    latest_tag: &str,
    current: &str,
) -> bool {
    remote_version_is_newer(manifest_version.unwrap_or(latest_tag), current)
}

fn parse_update_channel(s: &str) -> UpdateChannel {
    match s.to_lowercase().as_str() {
        "beta" => UpdateChannel::Beta,
        "nightly" => UpdateChannel::Nightly,
        _ => UpdateChannel::Stable,
    }
}

fn channel_label(c: UpdateChannel) -> &'static str {
    match c {
        UpdateChannel::Stable => "stable",
        UpdateChannel::Beta => "beta",
        UpdateChannel::Nightly => "nightly",
    }
}

/// Picks the newest prerelease whose tag matches the channel (see `.github/workflows/` docs).
fn pick_prerelease_track(releases: &[GithubRelease], channel: UpdateChannel) -> Option<&GithubRelease> {
    let tag_matches = |r: &GithubRelease, needle: &str| {
        let t = r.tag_name.to_lowercase();
        t.contains(needle)
    };
    for r in releases {
        if !r.prerelease {
            continue;
        }
        let ok = match channel {
            UpdateChannel::Nightly => tag_matches(r, "nightly"),
            UpdateChannel::Beta => tag_matches(r, "beta") && !tag_matches(r, "nightly"),
            UpdateChannel::Stable => false,
        };
        if ok {
            return Some(r);
        }
    }
    None
}

fn gh_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(concat!(
            "WingosyLauncher/",
            env!("CARGO_PKG_VERSION"),
            " (https://github.com/auron-labs/wingosy-launcher)"
        ))
        .build()
        .map_err(|e| format!("HTTP client: {}", e))
}

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub async fn check_for_app_update(channel: String) -> UpdateCheckResult {
    let current_version = get_app_version();
    let ch = parse_update_channel(&channel);
    let ch_label = channel_label(ch).to_string();

    let client = match gh_client() {
        Ok(c) => c,
        Err(e) => {
            return UpdateCheckResult {
                current_version,
                latest_version: None,
                is_update_available: false,
                release_url: None,
                signed_update_manifest_url: None,
                error: Some(e),
                channel: ch_label,
            };
        }
    };

    if ch == UpdateChannel::Stable {
        let url = format!(
            "https://api.github.com/repos/{}/releases/latest",
            UPDATE_CHECK_REPO
        );
        let response = match client.get(&url).send().await {
            Ok(r) => r,
            Err(e) => {
                return UpdateCheckResult {
                    current_version,
                    latest_version: None,
                    is_update_available: false,
                    release_url: None,
                    signed_update_manifest_url: None,
                    error: Some(format!("Request failed: {}", e)),
                    channel: ch_label,
                };
            }
        };

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            tracing::warn!(
                "[Updater] GitHub API error: {} — {}",
                status,
                body.chars().take(200).collect::<String>()
            );
            return UpdateCheckResult {
                current_version,
                latest_version: None,
                is_update_available: false,
                release_url: None,
                signed_update_manifest_url: None,
                error: Some(format!("GitHub returned {}", status)),
                channel: ch_label,
            };
        }

        let release: GithubRelease = match response.json().await {
            Ok(r) => r,
            Err(e) => {
                return UpdateCheckResult {
                    current_version,
                    latest_version: None,
                    is_update_available: false,
                    release_url: None,
                    signed_update_manifest_url: None,
                    error: Some(format!("Bad release JSON: {}", e)),
                    channel: ch_label,
                };
            }
        };

        let latest = release.tag_name.clone();
        let is_newer = remote_version_is_newer(&latest, &current_version);
        let signed_url =
            signed_manifest_url_if_ready(&client, &release.tag_name, is_newer).await;
        return UpdateCheckResult {
            current_version,
            latest_version: Some(latest.clone()),
            is_update_available: is_newer,
            release_url: Some(release.html_url),
            signed_update_manifest_url: signed_url,
            error: None,
            channel: ch_label,
        };
    }

    // Beta / Nightly: walk recent releases (newest first per GitHub API).
    let url = format!(
        "https://api.github.com/repos/{}/releases?per_page=40",
        UPDATE_CHECK_REPO
    );
    let response = match client.get(&url).send().await {
        Ok(r) => r,
        Err(e) => {
            return UpdateCheckResult {
                current_version,
                latest_version: None,
                is_update_available: false,
                release_url: None,
                signed_update_manifest_url: None,
                error: Some(format!("Request failed: {}", e)),
                channel: ch_label,
            };
        }
    };

    if !response.status().is_success() {
        let status = response.status();
        return UpdateCheckResult {
            current_version,
            latest_version: None,
            is_update_available: false,
            release_url: None,
            signed_update_manifest_url: None,
            error: Some(format!("GitHub returned {}", status)),
            channel: ch_label,
        };
    }

    let releases: Vec<GithubRelease> = match response.json().await {
        Ok(r) => r,
        Err(e) => {
            return UpdateCheckResult {
                current_version,
                latest_version: None,
                is_update_available: false,
                release_url: None,
                signed_update_manifest_url: None,
                error: Some(format!("Bad release list JSON: {}", e)),
                channel: ch_label,
            };
        }
    };

    let picked = pick_prerelease_track(&releases, ch);
    let Some(release) = picked else {
        let hint = match ch {
            UpdateChannel::Beta => "No beta prerelease found (tags should include \"beta\", GitHub prerelease: true).",
            UpdateChannel::Nightly => "No nightly prerelease found (tags should include \"nightly\", GitHub prerelease: true).",
            UpdateChannel::Stable => unreachable!(),
        };
        return UpdateCheckResult {
            current_version,
            latest_version: None,
            is_update_available: false,
            release_url: None,
            signed_update_manifest_url: None,
            error: Some(hint.to_string()),
            channel: ch_label,
        };
    };

    let manifest_url = signed_updater_manifest_for_tag(&release.tag_name);
    let manifest_version = signed_update_manifest_version(&client, &manifest_url).await;
    let latest = manifest_version
        .clone()
        .unwrap_or_else(|| release.tag_name.clone());
    let is_newer = release_version_is_newer(
        manifest_version.as_deref(),
        &release.tag_name,
        &current_version,
    );
    let signed_url = (is_newer && manifest_version.is_some()).then_some(manifest_url);
    UpdateCheckResult {
        current_version,
        latest_version: Some(latest.clone()),
        is_update_available: is_newer,
        release_url: Some(release.html_url.clone()),
        signed_update_manifest_url: signed_url,
        error: None,
        channel: ch_label,
    }
}

/// Download and install the signed update for the given channel, then restart the app (Windows).
#[tauri::command]
pub async fn install_signed_app_update(app: tauri::AppHandle, channel: String) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;

    let info = check_for_app_update(channel).await;
    if !info.is_update_available {
        return Err("No update available for this channel.".to_string());
    }
    let manifest_url = info.signed_update_manifest_url.ok_or_else(|| {
        "Missing signed updater manifest URL (this release may predate signed updates).".to_string()
    })?;
    let manifest_url_parsed = url::Url::parse(&manifest_url)
        .map_err(|e| format!("Invalid updater manifest URL: {}", e))?;

    let update = app
        .updater_builder()
        .endpoints(vec![manifest_url_parsed])
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Signed updater manifest reported no update.".to_string())?;

    let app_emit = app.clone();
    let downloaded = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
    let dl = downloaded.clone();
    update
        .download_and_install(
            move |chunk_len, content_len| {
                let cur = dl.fetch_add(chunk_len as u64, std::sync::atomic::Ordering::Relaxed)
                    + chunk_len as u64;
                let _ = app_emit.emit(
                    "signed-updater-progress",
                    serde_json::json!({
                        "downloaded": cur,
                        "total": content_len,
                    }),
                );
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())?;

    app.restart();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn setup_merge_preserves_paired_config_and_applies_setup_values() {
        let mut existing = AppConfig::default();
        existing.romm.server_url = Some("https://paired.example".to_string());
        existing.romm.auth_method = Some("pairing".to_string());
        existing.romm.username = Some("paired-user".to_string());
        existing.romm.password = Some("legacy-password".to_string());
        existing.romm.auth_token = Some("legacy-session-token".to_string());
        existing.romm.auto_sync = true;
        existing.romm.sync_saves = true;
        existing.romm.device_id = Some("device-123".to_string());
        existing.library.roms_directory = Some(PathBuf::from("C:/old-roms"));
        existing.library.bios_directory = Some(PathBuf::from("C:/bios"));
        existing.library.scan_subdirectories = false;
        existing.display.theme = crate::config::Theme::Light;
        existing.display.grid_columns = 7;
        existing.audio.ambient_enabled = true;
        existing.audio.ambient_path = Some("C:/music".to_string());
        existing.updater.auto_update_enabled = true;
        existing.updater.channel = UpdateChannel::Beta;
        existing.emulators.retroarch = Some(PathBuf::from("C:/retroarch.exe"));
        existing
            .emulators
            .platform_defaults
            .insert("gba".to_string(), "mgba".to_string());

        let merged = merge_setup_config(
            existing,
            Some("https://new.example".to_string()),
            None,
            Some("D:/roms".to_string()),
        );

        assert_eq!(
            merged.romm.server_url.as_deref(),
            Some("https://new.example")
        );
        assert_eq!(merged.romm.auth_method.as_deref(), Some("pairing"));
        assert_eq!(merged.romm.username.as_deref(), Some("paired-user"));
        assert_eq!(merged.romm.password.as_deref(), Some("legacy-password"));
        assert_eq!(
            merged.romm.auth_token.as_deref(),
            Some("legacy-session-token")
        );
        assert!(merged.romm.auto_sync);
        assert!(merged.romm.sync_saves);
        assert_eq!(merged.romm.device_id.as_deref(), Some("device-123"));
        assert_eq!(
            merged.library.roms_directory,
            Some(PathBuf::from("D:/roms"))
        );
        assert_eq!(
            merged.library.bios_directory,
            Some(PathBuf::from("C:/bios"))
        );
        assert!(!merged.library.scan_subdirectories);
        assert_eq!(merged.display.theme, crate::config::Theme::Light);
        assert_eq!(merged.display.grid_columns, 7);
        assert!(merged.audio.ambient_enabled);
        assert_eq!(merged.audio.ambient_path.as_deref(), Some("C:/music"));
        assert!(merged.updater.auto_update_enabled);
        assert_eq!(merged.updater.channel, UpdateChannel::Beta);
        assert_eq!(
            merged.emulators.retroarch,
            Some(PathBuf::from("C:/retroarch.exe"))
        );
        assert_eq!(
            merged
                .emulators
                .platform_defaults
                .get("gba")
                .map(String::as_str),
            Some("mgba")
        );
    }

    #[test]
    fn legacy_access_token_migration_stores_before_clearing_and_saving() {
        let mut config = AppConfig::default();
        config.romm.auth_token = Some("synthetic-access-marker".to_string());
        let events = std::cell::RefCell::new(Vec::new());

        let migrated = migrate_legacy_romm_access_token(
            &mut config,
            "https://romm.example",
            |server_url, token| {
                assert_eq!(server_url, "https://romm.example");
                assert_eq!(token, "synthetic-access-marker");
                events.borrow_mut().push("store");
                Ok(())
            },
            |saved_config| {
                events.borrow_mut().push("save");
                assert!(saved_config.romm.auth_token.is_none());
                Ok(())
            },
        )
        .expect("migration should succeed");

        assert_eq!(migrated.as_deref(), Some("synthetic-access-marker"));
        assert!(config.romm.auth_token.is_none());
        assert_eq!(events.into_inner(), vec!["store", "save"]);
    }

    #[test]
    fn failed_legacy_access_token_migration_keeps_token_and_skips_save() {
        let mut config = AppConfig::default();
        config.romm.auth_token = Some("synthetic-access-marker".to_string());
        let save_called = std::cell::Cell::new(false);

        let error = migrate_legacy_romm_access_token(
            &mut config,
            "https://romm.example",
            |_, _| anyhow::bail!("synthetic secure-store failure"),
            |_| {
                save_called.set(true);
                Ok(())
            },
        )
        .expect_err("failed secure storage must require reconnect");

        assert!(error.contains("Reconnect required"));
        assert_eq!(
            config.romm.auth_token.as_deref(),
            Some("synthetic-access-marker")
        );
        assert!(!save_called.get());
    }

    #[test]
    fn deleting_romm_credentials_attempts_both_and_returns_first_error() {
        let events = std::cell::RefCell::new(Vec::new());

        let error = delete_romm_credentials(
            "https://romm.example",
            Some("synthetic-user"),
            |server_url| {
                assert_eq!(server_url, "https://romm.example");
                events.borrow_mut().push("device");
                anyhow::bail!("synthetic-device-delete-failure")
            },
            |server_url, username| {
                assert_eq!(server_url, "https://romm.example");
                assert_eq!(username, "synthetic-user");
                events.borrow_mut().push("refresh");
                anyhow::bail!("synthetic-refresh-delete-failure")
            },
        )
        .expect_err("the first deletion failure should be returned");

        assert_eq!(error, "synthetic-device-delete-failure");
        assert_eq!(events.into_inner(), vec!["device", "refresh"]);
    }

    #[test]
    fn clear_romm_auth_fields_removes_all_local_auth_fields() {
        let mut config = RomMConfig {
            username: Some("synthetic-user".to_string()),
            auth_method: Some("pairing".to_string()),
            password: Some("synthetic-password-marker".to_string()),
            auth_token: Some("synthetic-access-marker".to_string()),
            ..RomMConfig::default()
        };

        clear_romm_auth_fields(&mut config);

        assert!(config.username.is_none());
        assert!(config.auth_method.is_none());
        assert!(config.password.is_none());
        assert!(config.auth_token.is_none());
    }

    #[test]
    fn signed_updater_manifest_uses_canonical_repository() {
        assert_eq!(
            signed_updater_manifest_for_tag("beta-42"),
            "https://github.com/auron-labs/wingosy-launcher/releases/download/beta-42/latest.json"
        );
    }

    #[test]
    fn test_remote_version_is_newer_semver() {
        assert!(super::remote_version_is_newer("v0.0.2", "0.0.1"));
        assert!(!super::remote_version_is_newer("v0.0.1", "0.0.1"));
        assert!(super::remote_version_is_newer("1.0.0", "0.9.9"));
        assert!(!super::remote_version_is_newer(
            "nightly-30347498773",
            "0.0.91"
        ));
    }

    #[test]
    fn test_prerelease_comparison_uses_manifest_version() {
        assert!(!super::release_version_is_newer(
            Some("0.0.91"),
            "nightly-30347498773",
            "0.0.91"
        ));
        assert!(super::release_version_is_newer(
            Some("0.0.92"),
            "nightly-30347498773",
            "0.0.91"
        ));
        assert!(!super::release_version_is_newer(
            None,
            "nightly-30347498773",
            "0.0.91"
        ));
    }

    #[test]
    fn test_pick_prerelease_nightly_prefers_first_match() {
        use crate::config::UpdateChannel;
        let releases = vec![
            super::GithubRelease {
                tag_name: "v1.0.0".to_string(),
                html_url: "https://a".to_string(),
                prerelease: false,
            },
            super::GithubRelease {
                tag_name: "nightly-99".to_string(),
                html_url: "https://n".to_string(),
                prerelease: true,
            },
        ];
        let p = super::pick_prerelease_track(&releases, UpdateChannel::Nightly);
        assert_eq!(p.unwrap().tag_name, "nightly-99");
    }

    #[test]
    fn test_pick_prerelease_beta_skips_nightly_tag() {
        use crate::config::UpdateChannel;
        let releases = vec![
            super::GithubRelease {
                tag_name: "nightly-1".to_string(),
                html_url: "https://n".to_string(),
                prerelease: true,
            },
            super::GithubRelease {
                tag_name: "beta-2".to_string(),
                html_url: "https://b".to_string(),
                prerelease: true,
            },
        ];
        let p = super::pick_prerelease_track(&releases, UpdateChannel::Beta);
        assert_eq!(p.unwrap().tag_name, "beta-2");
    }

    #[test]
    fn test_normalize_for_match_basic() {
        assert_eq!(normalize_for_match("Super Mario Bros"), "super mario bros");
        assert_eq!(normalize_for_match("SONIC THE HEDGEHOG"), "sonic the hedgehog");
    }

    #[test]
    fn test_normalize_for_match_removes_special_chars() {
        assert_eq!(normalize_for_match("Game: The Sequel!"), "game the sequel");
        assert_eq!(normalize_for_match("Test (USA) [Rev 1]"), "test usa rev 1");
    }

    #[test]
    fn test_normalize_for_match_handles_whitespace() {
        assert_eq!(normalize_for_match("  Extra   Spaces  "), "extra spaces");
        assert_eq!(normalize_for_match("Tab\tSeparated"), "tab separated");
    }

    #[test]
    fn test_normalize_for_match_preserves_numbers() {
        assert_eq!(normalize_for_match("Final Fantasy 7"), "final fantasy 7");
        assert_eq!(normalize_for_match("2048"), "2048");
    }

    #[test]
    fn test_normalize_for_match_empty_string() {
        assert_eq!(normalize_for_match(""), "");
    }

    #[test]
    fn test_normalize_for_match_only_special_chars() {
        assert_eq!(normalize_for_match("!!!???"), "");
        assert_eq!(normalize_for_match("---"), "");
    }

    #[test]
    fn test_normalize_matches_same_game_different_formats() {
        // These should all normalize to the same value for matching
        let names = [
            "Super Mario Bros",
            "SUPER MARIO BROS",
            "Super  Mario  Bros",
            "  Super Mario Bros  ",
            "Super_Mario_Bros",  // Underscores treated as spaces
        ];
        
        let first = normalize_for_match(names[0]);
        for name in &names[1..] {
            assert_eq!(normalize_for_match(name), first, 
                "Expected '{}' to match '{}'", name, names[0]);
        }
    }

    #[test]
    fn test_normalize_treats_underscores_as_spaces() {
        // Underscores should be converted to spaces for better ROM matching
        let with_underscore = normalize_for_match("Super_Mario_Bros");
        let with_spaces = normalize_for_match("Super Mario Bros");
        
        assert_eq!(with_underscore, with_spaces);
        assert_eq!(with_underscore, "super mario bros");
    }

    #[test]
    fn test_normalize_different_games_dont_match() {
        assert_ne!(
            normalize_for_match("Super Mario Bros"),
            normalize_for_match("Super Mario Bros 2")
        );
        assert_ne!(
            normalize_for_match("Sonic"),
            normalize_for_match("Sonic 2")
        );
    }

    // Tests for LaunchGameResult
    #[test]
    fn test_launch_game_result_success() {
        let result = LaunchGameResult {
            success: true,
            error: None,
            save_sync_warnings: vec![],
            dry_run: false,
            duration_minutes: Some(60),
            exit_code: Some(0),
        };
        assert!(result.success);
        assert!(result.error.is_none());
        assert!(!result.dry_run);
        assert_eq!(result.duration_minutes, Some(60));
        assert_eq!(result.exit_code, Some(0));
    }

    #[test]
    fn test_launch_game_result_failure() {
        let result = LaunchGameResult {
            success: false,
            error: Some("Emulator not found".to_string()),
            save_sync_warnings: vec![],
            dry_run: false,
            duration_minutes: None,
            exit_code: None,
        };
        assert!(!result.success);
        assert_eq!(result.error, Some("Emulator not found".to_string()));
    }

    #[test]
    fn test_launch_game_result_dry_run() {
        let result = LaunchGameResult {
            success: true,
            error: None,
            save_sync_warnings: vec![],
            dry_run: true,
            duration_minutes: None,
            exit_code: None,
        };
        assert!(result.success);
        assert!(result.dry_run);
    }

    #[test]
    fn failed_launch_result_preserves_command_contract() {
        let result = failed_launch_result("ROM is unavailable".to_string());
        assert!(!result.success);
        assert_eq!(result.error.as_deref(), Some("ROM is unavailable"));
        assert!(result.save_sync_warnings.is_empty());
        assert!(!result.dry_run);
        assert!(result.duration_minutes.is_none());
        assert!(result.exit_code.is_none());
    }

    #[test]
    fn launch_progress_keeps_identity_and_stage_order() {
        let stages = [
            LaunchStage::Resolving,
            LaunchStage::Downloading,
            LaunchStage::Validating,
            LaunchStage::Finalizing,
            LaunchStage::SaveSync,
            LaunchStage::Launching,
            LaunchStage::Running,
            LaunchStage::SaveSync,
            LaunchStage::Completion,
        ];
        let events: Vec<_> = stages
            .iter()
            .map(|stage| launch_progress_event(42, "Cached Game", *stage, None))
            .collect();

        let observed_stages = events
            .iter()
            .map(|event| event.stage)
            .collect::<Vec<_>>();
        assert_eq!(observed_stages, stages.to_vec());
        assert!(stages
            .windows(2)
            .all(|pair| pair[0].can_transition_to(pair[1])));
        assert!(LaunchStage::Launching.can_transition_to(LaunchStage::Completion));
        assert!(LaunchStage::Launching.can_transition_to(LaunchStage::Failure));
        assert!(LaunchStage::Running.can_transition_to(LaunchStage::Failure));
        assert!(LaunchStage::Downloading.can_transition_to(LaunchStage::Downloading));
        assert!(LaunchStage::Downloading.can_transition_to(LaunchStage::Validating));
        assert!(LaunchStage::Validating.can_transition_to(LaunchStage::Finalizing));
        assert!(LaunchStage::Finalizing.can_transition_to(LaunchStage::SaveSync));
        assert!(!LaunchStage::Launching.can_transition_to(LaunchStage::SaveSync));
        assert!(!LaunchStage::Completion.can_transition_to(LaunchStage::Failure));
        assert!(!LaunchStage::Failure.can_transition_to(LaunchStage::Completion));
        assert_eq!(
            emit_launch_progress(
                None,
                42,
                "Cached Game",
                Some(LaunchStage::Launching),
                LaunchStage::SaveSync,
                None,
            ),
            Some(LaunchStage::Launching)
        );
        assert_eq!(
            serde_json::to_string(&LaunchStage::SaveSync).unwrap(),
            "\"save_sync\""
        );
        let download = launch_progress_event_with_metrics(
            42,
            "Cached Game",
            LaunchStage::Downloading,
            None,
            Some(&DownloadProgress {
                downloaded: 512,
                total: Some(1024),
                percent: Some(50),
            }),
        );
        assert_eq!(download.downloaded, Some(512));
        assert_eq!(download.total, Some(1024));
        assert_eq!(download.percent, Some(50));
        let indeterminate = launch_progress_event_with_metrics(
            42,
            "Cached Game",
            LaunchStage::Downloading,
            None,
            Some(&DownloadProgress {
                downloaded: 512,
                total: None,
                percent: None,
            }),
        );
        assert_eq!(indeterminate.total, None);
        assert_eq!(indeterminate.percent, None);
        assert!(events
            .iter()
            .all(|event| event.game_id == 42 && event.game_name == "Cached Game"));

        let failure = launch_progress_event(
            42,
            "Cached Game",
            LaunchStage::Failure,
            Some("missing ROM"),
        );
        assert_eq!(failure.error.as_deref(), Some("missing ROM"));
        assert_eq!(failure.game_id, 42);
    }

    #[test]
    fn download_progress_uses_expected_size_only_when_header_values_are_missing() {
        let fallback = fill_expected_size(
            DownloadProgress {
                downloaded: 512,
                total: None,
                percent: None,
            },
            Some(1024),
        );
        assert_eq!(fallback.total, Some(1024));
        assert_eq!(fallback.percent, Some(50));

        let header = fill_expected_size(
            DownloadProgress {
                downloaded: 512,
                total: Some(2048),
                percent: Some(25),
            },
            Some(1024),
        );
        assert_eq!(header.total, Some(2048));
        assert_eq!(header.percent, Some(25));

        let unknown = fill_expected_size(
            DownloadProgress {
                downloaded: 512,
                total: None,
                percent: None,
            },
            None,
        );
        assert_eq!(unknown.total, None);
        assert_eq!(unknown.percent, None);
    }

    #[test]
    fn active_game_guard_rejects_duplicates_and_releases_on_drop() {
        let game_id = 9_876_543_210_i64;
        let first = ActiveGameGuard::try_acquire(game_id).unwrap();
        assert!(ActiveGameGuard::try_acquire(game_id).is_none());
        drop(first);

        let released = ActiveGameGuard::try_acquire(game_id).unwrap();
        drop(released);
    }

    // Tests for EmulatorInfo
    #[test]
    fn test_emulator_info_installed() {
        let info = EmulatorInfo {
            id: "retroarch".to_string(),
            name: "RetroArch".to_string(),
            is_installed: true,
            installed_path: Some("C:\\RetroArch\\retroarch.exe".to_string()),
            install_type: Some("system".to_string()),
            version: Some("1.16.0".to_string()),
            has_download: true,
            supported_platforms: vec!["gba".to_string(), "snes".to_string()],
        };
        assert!(info.is_installed);
        assert!(info.installed_path.is_some());
        assert_eq!(info.supported_platforms.len(), 2);
    }

    #[test]
    fn test_emulator_info_not_installed() {
        let info = EmulatorInfo {
            id: "mgba".to_string(),
            name: "mGBA".to_string(),
            is_installed: false,
            installed_path: None,
            install_type: None,
            version: None,
            has_download: true,
            supported_platforms: vec!["gba".to_string()],
        };
        assert!(!info.is_installed);
        assert!(info.installed_path.is_none());
        assert!(info.has_download);
    }

    // Tests for LaunchCommand
    #[test]
    fn test_launch_command_fields() {
        let cmd = LaunchCommand {
            executable: "C:\\RetroArch\\retroarch.exe".to_string(),
            emulator_id: "retroarch".to_string(),
            emulator_name: "RetroArch".to_string(),
            core_name: Some("mgba_libretro.dll".to_string()),
            game_name: "Super Mario".to_string(),
            rom_path: "C:\\ROMs\\mario.gba".to_string(),
            args: vec!["-L".to_string(), "core.dll".to_string(), "game.gba".to_string()],
            full_command: "C:\\RetroArch\\retroarch.exe -L core.dll game.gba".to_string(),
        };
        assert_eq!(cmd.executable, "C:\\RetroArch\\retroarch.exe");
        assert_eq!(cmd.args.len(), 3);
        assert!(cmd.full_command.contains("retroarch.exe"));
        assert_eq!(cmd.game_name, "Super Mario");
    }
}
