//! Argosy-compatible Switch (Eden) save sync via RomM device-aware API.
use anyhow::{Context, Result};
use serde::Serialize;
use std::future::Future;
use std::path::PathBuf;

use crate::api::RomMClient;
use crate::api::RomMSave;
use crate::config::AppConfig;
use crate::models::Game;

use super::switch_save::{
    extract_title_ids_from_path, resolve_local_title_save_path_for_title_id,
    unzip_into_title_folder, zip_title_folder, ARGOSY_LATEST_SAVE_NAME, DEFAULT_SAVE_SLOT,
    EDEN_EMULATOR_ID,
};

#[derive(Debug, Clone, Serialize)]
pub struct SwitchSaveSyncResult {
    pub success: bool,
    pub message: String,
    pub local_path: Option<String>,
    pub romm_save_id: Option<i32>,
    pub slot: Option<String>,
}

#[derive(Debug, PartialEq, Eq)]
enum SyncAction {
    Upload,
    Download(Option<i32>),
    Refused(String),
    NoOp(Option<i32>),
    Unsupported(String),
}

#[derive(Debug, PartialEq, Eq)]
enum SyncTransfer {
    Upload,
    Download(Option<i32>),
}

pub fn ensure_device_id(config: &mut AppConfig) -> String {
    if let Some(id) = config.romm.device_id.clone() {
        if !id.trim().is_empty() {
            return id;
        }
    }
    let host = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "wingosy".to_string());
    let id = format!("wingosy-{}", host.to_lowercase().replace(' ', "-"));
    config.romm.device_id = Some(id.clone());
    let _ = config.save();
    id
}

fn romm_client(config: &AppConfig) -> Result<RomMClient> {
    let url = config
        .romm
        .server_url
        .as_deref()
        .context("RomM server URL not configured")?;
    let token = crate::romm_credentials::load_device_token(url)?
        .or_else(|| config.romm.auth_token.clone())
        .context("RomM not connected")?;
    Ok(RomMClient::new(url).with_token(token))
}

fn slot_name(slot: Option<&str>) -> &str {
    slot.filter(|s| !s.trim().is_empty())
        .unwrap_or(DEFAULT_SAVE_SLOT)
}

fn is_latest_slot_name(slot: &str) -> bool {
    slot.eq_ignore_ascii_case(DEFAULT_SAVE_SLOT)
        || slot.eq_ignore_ascii_case(ARGOSY_LATEST_SAVE_NAME)
}

fn is_latest_save(save: &RomMSave, rom_base_name: Option<&str>) -> bool {
    if let Some(slot) = save.slot.as_deref() {
        if is_latest_slot_name(slot) {
            return true;
        }
    }

    let stem = save
        .file_name
        .rsplit_once('.')
        .map(|(name, _)| name)
        .unwrap_or(save.file_name.as_str());
    if is_latest_slot_name(stem) {
        return true;
    }

    rom_base_name
        .map(|base| stem.eq_ignore_ascii_case(base))
        .unwrap_or(false)
}

fn safe_file_stem(name: &str) -> String {
    let stem = std::path::Path::new(name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(name)
        .trim();
    let cleaned: String = stem
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => c,
        })
        .collect();
    let cleaned = cleaned.trim_matches(|c| c == ' ' || c == '.');
    if cleaned.is_empty() {
        ARGOSY_LATEST_SAVE_NAME.to_string()
    } else {
        cleaned.to_string()
    }
}

fn rom_base_name(game: &Game) -> String {
    let candidate = if !game.name.trim().is_empty() {
        game.name.as_str()
    } else {
        game.file_path.as_str()
    };
    safe_file_stem(candidate)
}

fn upload_filename(slot: &str, rom_base_name: &str) -> String {
    let stem = if is_latest_slot_name(slot) {
        rom_base_name
    } else {
        slot.strip_suffix(".zip").unwrap_or(slot)
    };
    format!("{}.zip", safe_file_stem(stem))
}

fn pick_save_for_slot<'a>(
    saves: &'a [RomMSave],
    slot: &str,
    rom_base_name: Option<&str>,
) -> Option<&'a RomMSave> {
    saves
        .iter()
        .filter(|s| {
            s.slot
                .as_deref()
                .map(|x| x.eq_ignore_ascii_case(slot))
                .unwrap_or(false)
                || (is_latest_slot_name(slot) && is_latest_save(s, rom_base_name))
        })
        .max_by(|a, b| a.updated_at.cmp(&b.updated_at))
}

fn sync_action_for(
    operation: Option<&crate::api::SyncOperation>,
    allow_download: bool,
) -> SyncAction {
    match operation.map(|operation| operation.action.as_str()) {
        Some("upload") => SyncAction::Upload,
        Some("download") if allow_download => {
            SyncAction::Download(operation.and_then(|operation| operation.save_id))
        }
        Some("download") => SyncAction::Refused(
            "RomM has a newer save after this play session; local upload was blocked".to_string(),
        ),
        Some("conflict") => SyncAction::Refused(format!(
            "Save conflict: {}",
            operation
                .map(|operation| operation.reason.as_str())
                .unwrap_or("both saves changed")
        )),
        Some("no_op") | None => SyncAction::NoOp(operation.and_then(|operation| operation.save_id)),
        Some(other) => SyncAction::Unsupported(other.to_string()),
    }
}

async fn execute_sync_action<Transfer, TransferFuture>(
    action: SyncAction,
    slot: String,
    transfer: Transfer,
) -> Result<SwitchSaveSyncResult>
where
    Transfer: FnOnce(SyncTransfer) -> TransferFuture,
    TransferFuture: Future<Output = Result<SwitchSaveSyncResult>>,
{
    match action {
        SyncAction::Upload => transfer(SyncTransfer::Upload).await,
        SyncAction::Download(save_id) => transfer(SyncTransfer::Download(save_id)).await,
        SyncAction::Refused(reason) => Err(anyhow::anyhow!(reason)),
        SyncAction::NoOp(save_id) => Ok(SwitchSaveSyncResult {
            success: true,
            message: "Switch save is already synchronized".to_string(),
            local_path: None,
            romm_save_id: save_id,
            slot: Some(slot),
        }),
        SyncAction::Unsupported(action) => {
            Err(anyhow::anyhow!("Unsupported sync action: {action}"))
        }
    }
}

struct SyncPlanOutcome {
    result: Result<SwitchSaveSyncResult>,
    completed: u32,
    failed: u32,
}

async fn execute_negotiated_sync_plan<Transfer, TransferFuture>(
    plan: crate::api::SyncNegotiateResponse,
    rom_id: i32,
    slot: String,
    allow_download: bool,
    transfer: Transfer,
) -> SyncPlanOutcome
where
    Transfer: FnOnce(SyncTransfer) -> TransferFuture,
    TransferFuture: Future<Output = Result<SwitchSaveSyncResult>>,
{
    let operation = crate::sync::negotiation::operation_for(&plan, rom_id, &slot).cloned();
    let action = sync_action_for(operation.as_ref(), allow_download);
    let operation_was_planned = matches!(
        &action,
        SyncAction::Upload | SyncAction::Download(_) | SyncAction::Refused(_)
    );
    let result = execute_sync_action(action, slot, transfer).await;
    let (completed, failed) = match (operation_was_planned, result.is_ok()) {
        (false, _) => (0, 0),
        (true, true) => (1, 0),
        (true, false) => (0, 1),
    };

    SyncPlanOutcome {
        result,
        completed,
        failed,
    }
}

pub async fn upload_switch_save_from_eden(
    game: &Game,
    config: &mut AppConfig,
    slot: Option<String>,
) -> Result<SwitchSaveSyncResult> {
    let client = romm_client(config)?;
    let device_id = ensure_device_id(config);
    let title_id = resolve_sync_title_id(game, &client).await?;
    upload_switch_save_from_eden_with_title_id(game, config, slot, &title_id, &client, &device_id)
        .await
}

async fn upload_switch_save_from_eden_with_title_id(
    game: &Game,
    config: &mut AppConfig,
    slot: Option<String>,
    title_id: &str,
    client: &RomMClient,
    device_id: &str,
) -> Result<SwitchSaveSyncResult> {
    let romm_id = game.romm_id.context("Game is not linked to RomM")?;
    let (title_dir, title_id) = resolve_local_title_save_path_for_title_id(config, title_id)?;
    let slot_s = slot_name(slot.as_deref()).to_string();
    let rom_base = rom_base_name(game);

    let cache_dir = AppConfig::data_dir()
        .map(|d| d.join("save_sync_cache"))
        .unwrap_or_else(|_| PathBuf::from("save_sync_cache"));
    std::fs::create_dir_all(&cache_dir)?;
    let zip_path = cache_dir.join(format!("upload_{romm_id}_{}.zip", safe_file_stem(&slot_s)));
    zip_title_folder(&title_dir, &title_id, &zip_path)?;

    let zip_bytes = std::fs::read(&zip_path)?;
    let uploaded = client
        .upload_save_device(
            romm_id,
            EDEN_EMULATOR_ID,
            &device_id,
            Some(&slot_s),
            zip_bytes,
            &upload_filename(&slot_s, &rom_base),
            false,
        )
        .await?;

    let _ = std::fs::remove_file(&zip_path);

    Ok(SwitchSaveSyncResult {
        success: true,
        message: format!("Uploaded Switch save for {title_id} to RomM (slot: {slot_s})"),
        local_path: Some(title_dir.to_string_lossy().into_owned()),
        romm_save_id: Some(uploaded.id),
        slot: Some(slot_s),
    })
}

pub async fn download_switch_save_to_eden(
    game: &Game,
    config: &mut AppConfig,
    slot: Option<String>,
    save_id: Option<i32>,
) -> Result<SwitchSaveSyncResult> {
    let client = romm_client(config)?;
    let device_id = ensure_device_id(config);
    let title_id = resolve_sync_title_id(game, &client).await?;
    download_switch_save_to_eden_with_title_id(
        game, config, slot, save_id, &title_id, &client, &device_id,
    )
    .await
}

async fn download_switch_save_to_eden_with_title_id(
    game: &Game,
    config: &mut AppConfig,
    slot: Option<String>,
    save_id: Option<i32>,
    title_id: &str,
    client: &RomMClient,
    device_id: &str,
) -> Result<SwitchSaveSyncResult> {
    let romm_id = game.romm_id.context("Game is not linked to RomM")?;
    let (title_dir, title_id) = resolve_local_title_save_path_for_title_id(config, title_id)?;
    let slot_s = slot_name(slot.as_deref()).to_string();
    let rom_base = rom_base_name(game);

    let save = if let Some(id) = save_id {
        client
            .get_saves_for_rom_device(romm_id, &device_id)
            .await?
            .into_iter()
            .find(|s| s.id == id)
            .context("Save not found on server")?
    } else {
        let saves = client.get_saves_for_rom_device(romm_id, &device_id).await?;
        let picked = pick_save_for_slot(&saves, &slot_s, Some(&rom_base))
            .or_else(|| saves.iter().max_by(|a, b| a.updated_at.cmp(&b.updated_at)));
        picked
            .cloned()
            .context(format!("No save found on RomM for slot {slot_s}"))?
    };

    let bytes = client
        .download_save_content_device(&save, &device_id)
        .await?;

    let cache_dir = AppConfig::data_dir()
        .map(|d| d.join("save_sync_cache"))
        .unwrap_or_else(|_| PathBuf::from("save_sync_cache"));
    std::fs::create_dir_all(&cache_dir)?;
    let zip_path = cache_dir.join(format!("download_{romm_id}_{}.zip", save.id));
    std::fs::write(&zip_path, bytes)?;

    if title_dir.exists() {
        let backup = cache_dir.join(format!(
            "backup_{}_{}.zip",
            title_id,
            chrono::Utc::now().timestamp()
        ));
        let _ = zip_title_folder(&title_dir, &title_id, &backup);
    }

    unzip_into_title_folder(&zip_path, &title_dir)?;
    client.confirm_save_downloaded(save.id, &device_id).await?;
    let _ = std::fs::remove_file(&zip_path);

    Ok(SwitchSaveSyncResult {
        success: true,
        message: format!(
            "Restored Switch save {title_id} from RomM (slot: {}, save id: {})",
            save.slot.as_deref().unwrap_or(&slot_s),
            save.id
        ),
        local_path: Some(title_dir.to_string_lossy().into_owned()),
        romm_save_id: Some(save.id),
        slot: save.slot.or(Some(slot_s)),
    })
}

pub async fn pre_launch_sync(game: &Game, config: &mut AppConfig) -> Result<()> {
    pre_launch_sync_result(game, config).await.map(|_| ())
}

pub(crate) async fn pre_launch_sync_result(
    game: &Game,
    config: &mut AppConfig,
) -> Result<Option<SwitchSaveSyncResult>> {
    if !config.romm.sync_saves {
        return Ok(None);
    }
    if game.platform_id != "switch" {
        return Ok(None);
    }
    let result = negotiated_launch_sync(game, config, true).await.map(Some);
    match &result {
        Ok(Some(r)) => tracing::info!("[SaveSync] Pre-launch: {}", r.message),
        Err(e) => {
            tracing::warn!("[SaveSync] Pre-launch sync skipped: {e}");
        }
        Ok(None) => {}
    }
    result
}

pub async fn post_launch_sync(game: &Game, config: &mut AppConfig) -> Result<()> {
    post_launch_sync_result(game, config).await.map(|_| ())
}

pub(crate) async fn post_launch_sync_result(
    game: &Game,
    config: &mut AppConfig,
) -> Result<Option<SwitchSaveSyncResult>> {
    if !config.romm.sync_saves {
        return Ok(None);
    }
    if game.platform_id != "switch" {
        return Ok(None);
    }
    let result = negotiated_launch_sync(game, config, false).await.map(Some);
    match &result {
        Ok(Some(r)) => tracing::info!("[SaveSync] Post-launch: {}", r.message),
        Err(e) => {
            tracing::warn!("[SaveSync] Post-launch sync failed: {e}");
        }
        Ok(None) => {}
    }
    result
}

async fn negotiated_launch_sync(
    game: &Game,
    config: &mut AppConfig,
    allow_download: bool,
) -> Result<SwitchSaveSyncResult> {
    let romm_id = game.romm_id.context("Game is not linked to RomM")?;
    let slot = slot_name(None).to_string();
    let rom_base = rom_base_name(game);
    let client = romm_client(config)?;
    let device_id = ensure_device_id(config);

    let title_id = resolve_sync_title_id(game, &client).await?;
    let (title_dir, title_id) = resolve_local_title_save_path_for_title_id(config, &title_id)?;
    let client_saves = if title_dir.exists() {
        let cache_dir = AppConfig::data_dir()
            .map(|dir| dir.join("save_sync_cache"))
            .unwrap_or_else(|_| PathBuf::from("save_sync_cache"));
        std::fs::create_dir_all(&cache_dir)?;
        let snapshot = cache_dir.join(format!("negotiate_{romm_id}.zip"));
        zip_title_folder(&title_dir, &title_id, &snapshot)?;
        let bytes = std::fs::read(&snapshot)?;
        let _ = std::fs::remove_file(&snapshot);
        let modified = walkdir::WalkDir::new(&title_dir)
            .into_iter()
            .filter_map(|entry| entry.ok())
            .filter_map(|entry| entry.metadata().ok()?.modified().ok())
            .max()
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
        vec![crate::sync::negotiation::client_save_state(
            romm_id,
            upload_filename(&slot, &rom_base),
            slot.clone(),
            EDEN_EMULATOR_ID,
            &bytes,
            modified,
        )]
    } else {
        vec![]
    };

    let Some(plan) = client.negotiate_sync(&device_id, client_saves).await? else {
        return if allow_download {
            download_switch_save_to_eden_with_title_id(
                game,
                config,
                Some(slot),
                None,
                &title_id,
                &client,
                &device_id,
            )
            .await
        } else {
            upload_switch_save_from_eden_with_title_id(
                game,
                config,
                Some(slot),
                &title_id,
                &client,
                &device_id,
            )
            .await
        };
    };
    let transfer_client = client.clone();
    let session_id = plan.session_id;
    let outcome = execute_negotiated_sync_plan(
        plan,
        romm_id,
        slot.clone(),
        allow_download,
        |transfer| async move {
            match transfer {
                SyncTransfer::Upload => {
                    upload_switch_save_from_eden_with_title_id(
                        game,
                        config,
                        Some(slot.clone()),
                        &title_id,
                        &transfer_client,
                        &device_id,
                    )
                    .await
                }
                SyncTransfer::Download(save_id) => {
                    download_switch_save_to_eden_with_title_id(
                        game,
                        config,
                        Some(slot.clone()),
                        save_id,
                        &title_id,
                        &transfer_client,
                        &device_id,
                    )
                    .await
                }
            }
        },
    )
    .await;
    client
        .complete_sync_session(session_id, outcome.completed, outcome.failed)
        .await?;
    outcome.result
}

async fn resolve_sync_title_id(game: &Game, client: &RomMClient) -> Result<String> {
    let romm_id = game.romm_id.context("Game is not linked to RomM")?;

    let metadata_candidates = match client.get_rom(romm_id).await {
        Ok(rom) => rom.title_id_candidates,
        Err(error) => {
            tracing::debug!(
                "[SaveSync] Detailed RomM title metadata unavailable; falling back to ROM path: {error}"
            );
            None
        }
    };

    let mut path_candidates = Vec::new();
    if let Some(local_path) = game.local_file_path.as_deref() {
        path_candidates.extend(extract_title_ids_from_path(local_path));
    }
    for title_id in extract_title_ids_from_path(&game.file_path) {
        if !path_candidates.contains(&title_id) {
            path_candidates.push(title_id);
        }
    }
    resolve_title_id_from_sources(metadata_candidates.as_deref(), &path_candidates)
}

fn resolve_title_id_from_sources(
    metadata_candidates: Option<&[String]>,
    path_candidates: &[String],
) -> Result<String> {
    if let Some(candidates) = metadata_candidates {
        if let Some(title_id) = unique_title_id(candidates, "authenticated RomM metadata")? {
            return Ok(title_id);
        }
    }

    unique_title_id(path_candidates, "ROM path")?
        .context("Could not resolve a unique valid Switch base title ID; save sync was skipped")
}

fn unique_title_id(candidates: &[String], source: &str) -> Result<Option<String>> {
    let mut valid_candidates = Vec::new();
    for candidate in candidates {
        if !super::switch_save::is_valid_title_id(candidate) {
            continue;
        }
        let normalized = candidate.to_ascii_uppercase();
        if !valid_candidates.contains(&normalized) {
            valid_candidates.push(normalized);
        }
    }

    match valid_candidates.as_slice() {
        [] => Ok(None),
        [title_id] => Ok(Some(title_id.clone())),
        _ => Err(anyhow::anyhow!(
            "Could not resolve a unique valid Switch base title ID from {source}; conflicting candidates were found"
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::SyncOperation;

    fn save(id: i32, file_name: &str, slot: Option<&str>, updated_at: &str) -> RomMSave {
        RomMSave {
            id,
            rom_id: 7,
            file_name: file_name.to_string(),
            file_size_bytes: 128,
            emulator: Some(EDEN_EMULATOR_ID.to_string()),
            created_at: updated_at.to_string(),
            updated_at: updated_at.to_string(),
            slot: slot.map(|s| s.to_string()),
        }
    }

    #[test]
    fn default_slot_matches_argosy_autosave() {
        assert_eq!(slot_name(None), "autosave");
        assert_eq!(slot_name(Some("")), "autosave");
    }

    #[test]
    fn latest_detection_accepts_argosy_and_wingosy_names() {
        assert!(is_latest_save(
            &save(1, "The Game.zip", Some("autosave"), "2026-01-01"),
            Some("The Game")
        ));
        assert!(is_latest_save(
            &save(2, "argosy-latest.zip", None, "2026-01-01"),
            Some("The Game")
        ));
        assert!(is_latest_save(
            &save(3, "The Game.zip", None, "2026-01-01"),
            Some("The Game")
        ));
    }

    #[test]
    fn pick_latest_slot_prefers_newest_compatible_save() {
        let saves = vec![
            save(1, "manual.zip", Some("manual"), "2026-01-03"),
            save(2, "argosy-latest.zip", None, "2026-01-01"),
            save(3, "The Game.zip", Some("autosave"), "2026-01-02"),
        ];

        let picked = pick_save_for_slot(&saves, "autosave", Some("The Game")).unwrap();
        assert_eq!(picked.id, 3);
    }

    #[test]
    fn latest_upload_filename_uses_rom_base_name() {
        assert_eq!(upload_filename("autosave", "The Game"), "The Game.zip");
        assert_eq!(upload_filename("argosy-latest", "The Game"), "The Game.zip");
        assert_eq!(upload_filename("slot-1", "The Game"), "slot-1.zip");
    }

    fn operation(action: &str, reason: &str, save_id: Option<i32>) -> crate::api::SyncOperation {
        crate::api::SyncOperation {
            action: action.to_string(),
            rom_id: 7,
            save_id,
            file_name: "The Game.zip".to_string(),
            slot: Some(DEFAULT_SAVE_SLOT.to_string()),
            emulator: Some(EDEN_EMULATOR_ID.to_string()),
            reason: reason.to_string(),
            server_updated_at: None,
            server_content_hash: None,
        }
    }

    fn sync_result(message: &str) -> SwitchSaveSyncResult {
        SwitchSaveSyncResult {
            success: true,
            message: message.to_string(),
            local_path: None,
            romm_save_id: None,
            slot: Some(DEFAULT_SAVE_SLOT.to_string()),
        }
    }

    fn negotiate(operation: SyncOperation) -> crate::api::SyncNegotiateResponse {
        crate::api::SyncNegotiateResponse {
            session_id: 12,
            operations: vec![operation],
            total_upload: 0,
            total_download: 0,
            total_conflict: 0,
            total_no_op: 0,
        }
    }

    #[tokio::test]
    async fn negotiated_actions_execute_the_selected_transfer_and_preserve_message() {
        let uploads = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let downloads = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let remote_newer = operation("download", "server is newer", Some(19));
        let restored = execute_negotiated_sync_plan(
            negotiate(remote_newer),
            7,
            DEFAULT_SAVE_SLOT.to_string(),
            true,
            {
                let uploads = uploads.clone();
                let downloads = downloads.clone();
                move |transfer| async move {
                    match transfer {
                        SyncTransfer::Upload => {
                            uploads.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                            Ok(sync_result("uploaded"))
                        }
                        SyncTransfer::Download(save_id) => {
                            assert_eq!(save_id, Some(19));
                            downloads.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                            Ok(sync_result("Restored newer remote save"))
                        }
                    }
                }
            },
        )
        .await;
        let restored_outcome = restored.result.unwrap();
        assert_eq!(restored_outcome.message, "Restored newer remote save");
        assert_eq!(restored.completed, 1);
        assert_eq!(restored.failed, 0);
        assert_eq!(uploads.load(std::sync::atomic::Ordering::SeqCst), 0);
        assert_eq!(downloads.load(std::sync::atomic::Ordering::SeqCst), 1);

        let local_newer = operation("upload", "local is newer", None);
        let uploaded = execute_negotiated_sync_plan(
            negotiate(local_newer),
            7,
            DEFAULT_SAVE_SLOT.to_string(),
            false,
            {
                let uploads = uploads.clone();
                let downloads = downloads.clone();
                move |transfer| async move {
                    match transfer {
                        SyncTransfer::Upload => {
                            uploads.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                            Ok(sync_result("Uploaded newer local save"))
                        }
                        SyncTransfer::Download(_) => {
                            downloads.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                            Ok(sync_result("downloaded"))
                        }
                    }
                }
            },
        )
        .await;
        let uploaded_outcome = uploaded.result.unwrap();
        assert_eq!(uploaded_outcome.message, "Uploaded newer local save");
        assert_eq!(uploaded.completed, 1);
        assert_eq!(uploaded.failed, 0);
        assert_eq!(uploads.load(std::sync::atomic::Ordering::SeqCst), 1);
        assert_eq!(downloads.load(std::sync::atomic::Ordering::SeqCst), 1);
    }

    #[test]
    fn post_launch_download_and_conflict_actions_are_refused_without_transfer() {
        let download = operation("download", "server is newer", Some(19));
        assert_eq!(
            sync_action_for(Some(&download), false),
            SyncAction::Refused(
                "RomM has a newer save after this play session; local upload was blocked"
                    .to_string()
            )
        );
        assert_eq!(
            sync_action_for(Some(&download), true),
            SyncAction::Download(Some(19))
        );

        let conflict = operation("conflict", "both saves changed", None);
        assert_eq!(
            sync_action_for(Some(&conflict), false),
            SyncAction::Refused("Save conflict: both saves changed".to_string())
        );
    }

    #[tokio::test]
    async fn conflict_and_unresolved_identity_execute_no_transfer() {
        let transfers = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let conflict = operation("conflict", "both saves changed", None);
        let outcome = execute_negotiated_sync_plan(
            negotiate(conflict),
            7,
            DEFAULT_SAVE_SLOT.to_string(),
            false,
            {
                let transfers = transfers.clone();
                move |transfer| async move {
                    transfers.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                    let message = match transfer {
                        SyncTransfer::Upload => "must not upload",
                        SyncTransfer::Download(_) => "must not download",
                    };
                    Ok(sync_result(message))
                }
            },
        )
        .await;
        assert!(outcome.result.is_err());
        assert_eq!(outcome.completed, 0);
        assert_eq!(outcome.failed, 1);

        let conflicting_identity = vec![
            "0100AAAA00000001".to_string(),
            "0100BBBB00000002".to_string(),
        ];
        assert!(resolve_title_id_from_sources(Some(&conflicting_identity), &[]).is_err());
        assert_eq!(transfers.load(std::sync::atomic::Ordering::SeqCst), 0);
    }

    #[test]
    fn trusted_romm_identity_wins_over_cached_rom_path() {
        let metadata = vec!["0100BBBB00000002".to_string()];

        assert_eq!(
            resolve_title_id_from_sources(Some(&metadata), &["0100AAAA00000001".to_string()])
                .unwrap(),
            "0100BBBB00000002"
        );
    }

    #[test]
    fn conflicting_or_missing_identity_refuses_path_resolution() {
        let conflicting = vec![
            "0100AAAA00000001".to_string(),
            "0100BBBB00000002".to_string(),
        ];
        let error = resolve_title_id_from_sources(Some(&conflicting), &[])
            .unwrap_err()
            .to_string();
        assert!(error.contains("conflicting candidates"));

        assert!(resolve_title_id_from_sources(None, &[]).is_err());
        assert!(resolve_title_id_from_sources(
            None,
            &[
                "0100AAAA00000001".to_string(),
                "0100BBBB00000002".to_string()
            ]
        )
        .is_err());
    }
}
