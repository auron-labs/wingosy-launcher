//! Argosy-compatible RetroArch SRAM save sync via RomM device-aware API.
use anyhow::{bail, Context, Result};
use serde::Serialize;
use std::path::{Path, PathBuf};

use crate::api::{RomMClient, RomMSave};
use crate::config::AppConfig;
use crate::models::Game;

use super::switch_romm::ensure_device_id;
use super::switch_save::{ARGOSY_LATEST_SAVE_NAME, DEFAULT_SAVE_SLOT};

const RETROARCH_EMULATOR_ID: &str = "retroarch";
const SAVE_EXTENSIONS: [&str; 2] = ["srm", "sav"];

#[derive(Debug, Clone, Serialize)]
pub struct RetroArchSaveSyncResult {
    pub success: bool,
    pub message: String,
    pub local_path: Option<String>,
    pub romm_save_id: Option<i32>,
    pub slot: Option<String>,
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

fn file_stem_lossy(path_or_name: &str) -> String {
    std::path::Path::new(path_or_name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(path_or_name)
        .trim()
        .to_string()
}

fn sanitize_file_stem(name: &str) -> String {
    let cleaned: String = name
        .trim()
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
    let source = game
        .local_file_path
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or(game.file_path.as_str());
    let stem = file_stem_lossy(source);
    if stem.is_empty() {
        sanitize_file_stem(&game.name)
    } else {
        sanitize_file_stem(&stem)
    }
}

fn core_stem(core_name: &str) -> String {
    let stem = file_stem_lossy(core_name);
    stem.strip_suffix("_libretro").unwrap_or(&stem).to_string()
}

fn retroarch_root(config: &AppConfig) -> Result<PathBuf> {
    let exe = config
        .emulators
        .retroarch
        .as_ref()
        .context("RetroArch not configured")?;
    exe.parent()
        .map(|p| p.to_path_buf())
        .context("RetroArch executable has no parent directory")
}

fn save_dirs(config: &AppConfig, core_name: &str) -> Result<Vec<PathBuf>> {
    let root = retroarch_root(config)?;
    let core = core_stem(core_name);
    let mut dirs = vec![root.join("saves").join(&core), root.join("saves")];

    if let Some(appdata) = std::env::var_os("APPDATA") {
        let base = PathBuf::from(appdata).join("RetroArch").join("saves");
        dirs.push(base.join(&core));
        dirs.push(base);
    }
    if let Some(local_appdata) = std::env::var_os("LOCALAPPDATA") {
        let base = PathBuf::from(local_appdata).join("RetroArch").join("saves");
        dirs.push(base.join(&core));
        dirs.push(base);
    }

    dirs.dedup();
    Ok(dirs)
}

fn local_save_candidates(
    config: &AppConfig,
    core_name: &str,
    rom_base: &str,
) -> Result<Vec<PathBuf>> {
    let mut out = Vec::new();
    for dir in save_dirs(config, core_name)? {
        for ext in SAVE_EXTENSIONS {
            out.push(dir.join(format!("{rom_base}.{ext}")));
        }
    }
    Ok(out)
}

fn newest_existing(paths: Vec<PathBuf>) -> Option<PathBuf> {
    paths.into_iter().filter(|p| p.is_file()).max_by_key(|p| {
        p.metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0)
    })
}

fn default_save_path(
    config: &AppConfig,
    core_name: &str,
    rom_base: &str,
    ext: &str,
) -> Result<PathBuf> {
    let first_dir = save_dirs(config, core_name)?
        .into_iter()
        .next()
        .context("No RetroArch save directory candidates")?;
    Ok(first_dir.join(format!("{rom_base}.{ext}")))
}

fn is_latest_save(save: &RomMSave, rom_base_name: &str) -> bool {
    if let Some(slot) = save.slot.as_deref() {
        if is_latest_slot_name(slot) {
            return true;
        }
    }

    let stem = file_stem_lossy(&save.file_name);
    is_latest_slot_name(&stem) || stem.eq_ignore_ascii_case(rom_base_name)
}

fn pick_save_for_slot<'a>(
    saves: &'a [RomMSave],
    slot: &str,
    rom_base_name: &str,
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

fn extension_for_save(save: &RomMSave) -> &str {
    Path::new(&save.file_name)
        .extension()
        .and_then(|s| s.to_str())
        .filter(|s| {
            SAVE_EXTENSIONS
                .iter()
                .any(|ext| ext.eq_ignore_ascii_case(s))
        })
        .unwrap_or("srm")
}

pub async fn upload_retroarch_save(
    game: &Game,
    config: &mut AppConfig,
    core_name: &str,
    slot: Option<String>,
) -> Result<RetroArchSaveSyncResult> {
    let romm_id = game.romm_id.context("Game is not linked to RomM")?;
    let rom_base = rom_base_name(game);
    let local_path = newest_existing(local_save_candidates(config, core_name, &rom_base)?)
        .context(format!("No RetroArch save found for {rom_base}"))?;
    let ext = local_path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("srm");
    let slot_s = slot_name(slot.as_deref()).to_string();
    let upload_name = if is_latest_slot_name(&slot_s) {
        format!("{rom_base}.{ext}")
    } else {
        format!("{}.{}", sanitize_file_stem(&slot_s), ext)
    };

    let bytes = std::fs::read(&local_path)?;
    let client = romm_client(config)?;
    let device_id = ensure_device_id(config);
    let uploaded = client
        .upload_save_device(
            romm_id,
            RETROARCH_EMULATOR_ID,
            &device_id,
            Some(&slot_s),
            bytes,
            &upload_name,
            false,
        )
        .await?;

    Ok(RetroArchSaveSyncResult {
        success: true,
        message: format!(
            "Uploaded RetroArch save {} to RomM (slot: {slot_s})",
            local_path.display()
        ),
        local_path: Some(local_path.to_string_lossy().into_owned()),
        romm_save_id: Some(uploaded.id),
        slot: Some(slot_s),
    })
}

pub async fn download_retroarch_save(
    game: &Game,
    config: &mut AppConfig,
    core_name: &str,
    slot: Option<String>,
    save_id: Option<i32>,
) -> Result<RetroArchSaveSyncResult> {
    let romm_id = game.romm_id.context("Game is not linked to RomM")?;
    let rom_base = rom_base_name(game);
    let slot_s = slot_name(slot.as_deref()).to_string();
    let client = romm_client(config)?;
    let device_id = ensure_device_id(config);

    let save = if let Some(id) = save_id {
        client
            .get_saves_for_rom_device(romm_id, &device_id)
            .await?
            .into_iter()
            .find(|s| s.id == id)
            .context("Save not found on server")?
    } else {
        let saves = client.get_saves_for_rom_device(romm_id, &device_id).await?;
        pick_save_for_slot(&saves, &slot_s, &rom_base)
            .or_else(|| saves.iter().max_by(|a, b| a.updated_at.cmp(&b.updated_at)))
            .cloned()
            .context(format!("No save found on RomM for slot {slot_s}"))?
    };

    let bytes = client
        .download_save_content_device(&save, &device_id)
        .await?;
    if bytes.is_empty() {
        bail!("Downloaded RetroArch save was empty");
    }

    let ext = extension_for_save(&save);
    let target = newest_existing(local_save_candidates(config, core_name, &rom_base)?)
        .unwrap_or(default_save_path(config, core_name, &rom_base, ext)?);
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let nonce = chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default();
    let temp = target.with_extension(format!("wingosy-download-{nonce}.tmp"));
    {
        let mut file = std::fs::File::create(&temp)?;
        std::io::Write::write_all(&mut file, &bytes)?;
        file.sync_all()?;
    }
    let backup = target.with_extension(format!(
        "{}.bak-{}",
        target.extension().and_then(|s| s.to_str()).unwrap_or("srm"),
        chrono::Utc::now().timestamp()
    ));
    if target.exists() {
        std::fs::rename(&target, &backup)?;
    }
    if let Err(error) = std::fs::rename(&temp, &target) {
        if backup.exists() {
            let _ = std::fs::rename(&backup, &target);
        }
        let _ = std::fs::remove_file(&temp);
        return Err(error.into());
    }
    client.confirm_save_downloaded(save.id, &device_id).await?;

    Ok(RetroArchSaveSyncResult {
        success: true,
        message: format!(
            "Restored RetroArch save {} from RomM (slot: {}, save id: {})",
            target.display(),
            save.slot.as_deref().unwrap_or(&slot_s),
            save.id
        ),
        local_path: Some(target.to_string_lossy().into_owned()),
        romm_save_id: Some(save.id),
        slot: save.slot.or(Some(slot_s)),
    })
}

pub async fn pre_launch_sync(
    game: &Game,
    config: &mut AppConfig,
    core_name: Option<&str>,
) -> Result<()> {
    if !config.romm.sync_saves {
        return Ok(());
    }
    let Some(core_name) = core_name else {
        return Ok(());
    };
    let result = negotiated_launch_sync(game, config, core_name, true).await;
    match result {
        Ok(r) => tracing::info!("[SaveSync] RetroArch pre-launch: {}", r.message),
        Err(e) => {
            tracing::warn!("[SaveSync] RetroArch pre-launch sync skipped: {e}");
            return Err(e);
        }
    }
    Ok(())
}

pub async fn post_launch_sync(
    game: &Game,
    config: &mut AppConfig,
    core_name: Option<&str>,
) -> Result<()> {
    if !config.romm.sync_saves {
        return Ok(());
    }
    let Some(core_name) = core_name else {
        return Ok(());
    };
    let result = negotiated_launch_sync(game, config, core_name, false).await;
    match result {
        Ok(r) => tracing::info!("[SaveSync] RetroArch post-launch: {}", r.message),
        Err(e) => {
            tracing::warn!("[SaveSync] RetroArch post-launch sync failed: {e}");
            return Err(e);
        }
    }
    Ok(())
}

async fn negotiated_launch_sync(
    game: &Game,
    config: &mut AppConfig,
    core_name: &str,
    allow_download: bool,
) -> Result<RetroArchSaveSyncResult> {
    let romm_id = game.romm_id.context("Game is not linked to RomM")?;
    let rom_base = rom_base_name(game);
    let slot = slot_name(None).to_string();
    let client = romm_client(config)?;
    let device_id = ensure_device_id(config);

    let client_saves = newest_existing(local_save_candidates(config, core_name, &rom_base)?)
        .map(|path| -> Result<_> {
            let bytes = std::fs::read(&path)?;
            let modified = std::fs::metadata(&path)?
                .modified()
                .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
            let file_name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("save.srm")
                .to_string();
            Ok(crate::sync::negotiation::client_save_state(
                romm_id,
                file_name,
                slot.clone(),
                RETROARCH_EMULATOR_ID,
                &bytes,
                modified,
            ))
        })
        .transpose()?
        .into_iter()
        .collect();

    let Some(plan) = client.negotiate_sync(&device_id, client_saves).await? else {
        return if allow_download {
            download_retroarch_save(game, config, core_name, Some(slot), None).await
        } else {
            upload_retroarch_save(game, config, core_name, Some(slot)).await
        };
    };
    let operation = crate::sync::negotiation::operation_for(&plan, romm_id, &slot).cloned();
    let result = match operation
        .as_ref()
        .map(|operation| operation.action.as_str())
    {
        Some("upload") => upload_retroarch_save(game, config, core_name, Some(slot.clone())).await,
        Some("download") if allow_download => {
            let save_id = operation.as_ref().and_then(|operation| operation.save_id);
            download_retroarch_save(game, config, core_name, Some(slot.clone()), save_id).await
        }
        Some("download") => Err(anyhow::anyhow!(
            "RomM has a newer save after this play session; local upload was blocked"
        )),
        Some("conflict") => Err(anyhow::anyhow!(
            "Save conflict: {}",
            operation
                .as_ref()
                .map(|op| op.reason.as_str())
                .unwrap_or("both saves changed")
        )),
        Some("no_op") | None => Ok(RetroArchSaveSyncResult {
            success: true,
            message: "RetroArch save is already synchronized".to_string(),
            local_path: None,
            romm_save_id: operation.as_ref().and_then(|operation| operation.save_id),
            slot: Some(slot),
        }),
        Some(other) => Err(anyhow::anyhow!("Unsupported sync action: {other}")),
    };

    let operation_was_planned = matches!(
        operation
            .as_ref()
            .map(|operation| operation.action.as_str()),
        Some("upload" | "download" | "conflict")
    );
    let (completed, failed) = match (operation_was_planned, result.is_ok()) {
        (false, _) => (0, 0),
        (true, true) => (1, 0),
        (true, false) => (0, 1),
    };
    client
        .complete_sync_session(plan.session_id, completed, failed)
        .await?;
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn save(id: i32, file_name: &str, slot: Option<&str>, updated_at: &str) -> RomMSave {
        RomMSave {
            id,
            rom_id: 7,
            file_name: file_name.to_string(),
            file_size_bytes: 128,
            emulator: Some(RETROARCH_EMULATOR_ID.to_string()),
            created_at: updated_at.to_string(),
            updated_at: updated_at.to_string(),
            slot: slot.map(|s| s.to_string()),
        }
    }

    #[test]
    fn core_stem_drops_libretro_suffix() {
        assert_eq!(core_stem("mgba_libretro.dll"), "mgba");
        assert_eq!(core_stem("snes9x.dll"), "snes9x");
    }

    #[test]
    fn latest_detection_matches_argosy_slots_and_rom_base() {
        assert!(is_latest_save(
            &save(1, "Metroid Fusion.srm", Some("autosave"), "2026-01-01"),
            "Metroid Fusion"
        ));
        assert!(is_latest_save(
            &save(2, "argosy-latest.srm", None, "2026-01-01"),
            "Metroid Fusion"
        ));
        assert!(is_latest_save(
            &save(3, "Metroid Fusion.sav", None, "2026-01-01"),
            "Metroid Fusion"
        ));
    }

    #[test]
    fn pick_latest_slot_ignores_named_manual_slots() {
        let saves = vec![
            save(1, "boss.srm", Some("boss"), "2026-01-03"),
            save(2, "Metroid Fusion.srm", Some("autosave"), "2026-01-02"),
        ];
        let picked = pick_save_for_slot(&saves, "autosave", "Metroid Fusion").unwrap();
        assert_eq!(picked.id, 2);
    }
}
