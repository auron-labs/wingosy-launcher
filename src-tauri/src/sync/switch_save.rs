//! Eden / yuzu-style Switch save paths and ZIP layout compatible with Argosy `SwitchSaveHandler`.
use anyhow::{bail, Context, Result};
use regex_lite::Regex;
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use zip::read::ZipArchive;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

use crate::config::AppConfig;

/// RomM autosync slot used by Argosy for the latest save.
pub const DEFAULT_SAVE_SLOT: &str = "autosave";

/// Legacy/latest file stem still recognized by Argosy and older Wingosy builds.
pub const ARGOSY_LATEST_SAVE_NAME: &str = "argosy-latest";

/// RomM `emulator` query value for Eden on desktop (Argosy uses emulator id `eden` for Switch).
pub const EDEN_EMULATOR_ID: &str = "eden";

static TITLE_ID_RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();

fn title_id_re() -> &'static Regex {
    TITLE_ID_RE.get_or_init(|| Regex::new(r"(?i)\b(0100[0-9A-F]{12})\b").expect("title id regex"))
}

pub fn extract_title_ids_from_path(path: &str) -> Vec<String> {
    let mut title_ids = Vec::new();
    for caps in title_id_re().captures_iter(path) {
        let title_id = caps[1].to_ascii_uppercase();
        if !title_ids.contains(&title_id) {
            title_ids.push(title_id);
        }
    }
    title_ids
}

pub fn extract_title_id_from_path(path: &str) -> Option<String> {
    extract_title_ids_from_path(path).into_iter().next()
}

pub fn is_valid_title_id(title_id: &str) -> bool {
    title_id.len() == 16
        && title_id.to_ascii_uppercase().starts_with("0100")
        && title_id.chars().all(|c| c.is_ascii_hexdigit())
}

pub fn is_valid_user_folder_id(name: &str) -> bool {
    name.len() == 16 && name.chars().all(|c| c.is_ascii_hexdigit())
}

pub fn is_valid_profile_folder_id(name: &str) -> bool {
    (name.len() == 16 || name.len() == 32) && name.chars().all(|c| c.is_ascii_hexdigit())
}

/// Resolve `.../nand/user/save` under the same Eden data root used by BIOS and
/// controller setup.
pub fn resolve_eden_save_base(config: &AppConfig) -> PathBuf {
    let appdata = std::env::var_os("APPDATA").map(PathBuf::from);
    resolve_eden_save_base_with_appdata(config, appdata.as_deref())
}

fn resolve_eden_save_base_with_appdata(
    config: &AppConfig,
    appdata: Option<&Path>,
) -> PathBuf {
    if let Some(custom) = &config.emulators.eden_save_root {
        return normalize_save_base(custom);
    }

    if let Some(eden_exe) = &config.emulators.eden {
        if let Ok(root) = crate::bios::eden_data_root(eden_exe, appdata) {
            return root.join("nand").join("user").join("save");
        }
    }

    if let Some(appdata) = appdata {
        return appdata
            .to_path_buf()
            .join("Eden")
            .join("nand")
            .join("user")
            .join("save");
    }

    PathBuf::from("Eden").join("nand").join("user").join("save")
}

fn normalize_save_base(path: &Path) -> PathBuf {
    let normalized = path.to_path_buf();
    let s = normalized.to_string_lossy().replace('\\', "/");
    if s.ends_with("/nand/user/save") || s.ends_with("/user/save") {
        return normalized;
    }
    if s.ends_with("/nand/user") {
        return normalized.join("save");
    }
    if s.ends_with("/nand") {
        return normalized.join("user").join("save");
    }
    normalized.join("nand").join("user").join("save")
}

fn newest_mtime(path: &Path) -> u64 {
    let mut newest = 0u64;
    if path.is_file() {
        return path
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
    }
    if !path.is_dir() {
        return 0;
    }
    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            if let Ok(m) = entry.metadata() {
                if let Ok(modified) = m.modified() {
                    if let Ok(d) = modified.duration_since(std::time::UNIX_EPOCH) {
                        newest = newest.max(d.as_secs());
                    }
                }
            }
        }
    }
    newest
}

/// Pick the profile folder with the newest save activity (Argosy `findActiveProfileFolder` heuristic).
pub fn find_active_profile_folder(save_base: &Path) -> PathBuf {
    if !save_base.is_dir() {
        return save_base.to_path_buf();
    }

    let mut best_path: Option<PathBuf> = None;
    let mut best_time = 0u64;
    let mut first_non_zero: Option<PathBuf> = None;

    let Ok(entries) = std::fs::read_dir(save_base) else {
        return save_base.to_path_buf();
    };

    for user_entry in entries.flatten() {
        let user_path = user_entry.path();
        if !user_path.is_dir()
            || !is_valid_user_folder_id(&user_entry.file_name().to_string_lossy())
        {
            continue;
        }
        let Ok(profiles) = std::fs::read_dir(&user_path) else {
            continue;
        };
        for profile_entry in profiles.flatten() {
            let profile_path = profile_entry.path();
            if !profile_path.is_dir() {
                continue;
            }
            let name = profile_entry.file_name().to_string_lossy().to_string();
            if !is_valid_profile_folder_id(&name) {
                continue;
            }
            let is_zero = name.chars().all(|c| c == '0');
            if !is_zero && first_non_zero.is_none() {
                first_non_zero = Some(profile_path.clone());
            }
            if !is_zero {
                let t = newest_mtime(&profile_path);
                if t > best_time {
                    best_time = t;
                    best_path = Some(profile_path);
                }
            }
        }
    }

    best_path
        .or(first_non_zero)
        .unwrap_or_else(|| save_base.to_path_buf())
}

pub fn construct_title_save_path(save_base: &Path, title_id: &str) -> PathBuf {
    let profile = find_active_profile_folder(save_base);
    profile.join(title_id.to_ascii_uppercase())
}

pub fn find_title_save_folder(save_base: &Path, title_id: &str) -> Option<PathBuf> {
    let normalized = title_id.to_ascii_uppercase();
    if !save_base.is_dir() {
        return None;
    }

    let mut best: Option<PathBuf> = None;
    let mut best_time = 0u64;

    let Ok(users) = std::fs::read_dir(save_base) else {
        return None;
    };

    for user in users.flatten() {
        let user_path = user.path();
        if !user_path.is_dir() || !is_valid_user_folder_id(&user.file_name().to_string_lossy()) {
            continue;
        }
        let Ok(profiles) = std::fs::read_dir(&user_path) else {
            continue;
        };
        for profile in profiles.flatten() {
            let profile_path = profile.path();
            if !profile_path.is_dir() {
                continue;
            }
            if !is_valid_profile_folder_id(&profile.file_name().to_string_lossy()) {
                continue;
            }
            let candidate = profile_path.join(&normalized);
            if candidate.is_dir() {
                let t = newest_mtime(&candidate);
                if best.is_none() || t > best_time {
                    best_time = t;
                    best = Some(candidate);
                }
            }
        }
    }

    best
}

pub fn resolve_local_title_save_path(
    config: &AppConfig,
    rom_path: &str,
) -> Result<(PathBuf, String)> {
    let title_ids = extract_title_ids_from_path(rom_path);
    let title_id = match title_ids.as_slice() {
        [title_id] => title_id.clone(),
        [] => {
            bail!("Could not read Switch title ID from ROM filename (expected [0100XXXXXXXXXXXX])")
        }
        _ => bail!(
            "Could not resolve a unique Switch title ID from ROM filename (multiple candidates)"
        ),
    };
    resolve_local_title_save_path_for_title_id(config, &title_id)
}

pub fn resolve_local_title_save_path_for_title_id(
    config: &AppConfig,
    title_id: &str,
) -> Result<(PathBuf, String)> {
    if !is_valid_title_id(title_id) {
        bail!("Invalid Switch title ID: {title_id}");
    }
    let save_base = resolve_eden_save_base(config);
    let folder = find_title_save_folder(&save_base, title_id)
        .unwrap_or_else(|| construct_title_save_path(&save_base, title_id));
    Ok((folder, title_id.to_ascii_uppercase()))
}

/// Zip `title_dir` so the archive root is `{title_id}/...` (Argosy `zipFolder` layout).
pub fn zip_title_folder(title_dir: &Path, title_id: &str, dest_zip: &Path) -> Result<()> {
    if !title_dir.is_dir() {
        bail!("Save folder does not exist: {}", title_dir.display());
    }
    if let Some(parent) = dest_zip.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let file = File::create(dest_zip)?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    let root = title_id.to_ascii_uppercase();

    for entry in WalkDir::new(title_dir) {
        let entry = entry?;
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let rel = path
            .strip_prefix(title_dir)
            .context("strip_prefix title_dir")?
            .to_string_lossy()
            .replace('\\', "/");
        let zip_path = format!("{root}/{rel}");
        zip.start_file(zip_path, options)?;
        let mut f = File::open(path)?;
        let mut buffer = Vec::new();
        f.read_to_end(&mut buffer)?;
        zip.write_all(&buffer)?;
    }

    zip.finish()?;
    Ok(())
}

/// Extract a single-root-folder Argosy/Eden zip into `target_title_dir`.
pub fn unzip_into_title_folder(zip_path: &Path, target_title_dir: &Path) -> Result<()> {
    let file = File::open(zip_path)?;
    let mut archive = ZipArchive::new(file)?;
    let parent = target_title_dir
        .parent()
        .context("Save folder has no parent directory")?;
    std::fs::create_dir_all(parent)?;
    let nonce = chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default();
    let temp_dir = parent.join(format!(".wingosy-restore-{nonce}"));
    let old_dir = parent.join(format!(".wingosy-previous-{nonce}"));
    std::fs::create_dir_all(&temp_dir)?;

    let mut root_folder: Option<String> = None;
    for i in 0..archive.len() {
        let entry = archive.by_index(i)?;
        let safe_path = entry
            .enclosed_name()
            .context("Save archive contains an unsafe path")?;
        if let Some(seg) = safe_path.components().next() {
            if safe_path.components().count() > 1 {
                root_folder.get_or_insert_with(|| seg.as_os_str().to_string_lossy().into_owned());
            }
        }
    }

    let extraction = (|| -> Result<()> {
        for i in 0..archive.len() {
            let mut entry = archive.by_index(i)?;
            let safe_path = entry
                .enclosed_name()
                .context("Save archive contains an unsafe path")?
                .to_path_buf();
            let relative = if let Some(ref root) = root_folder {
                safe_path.strip_prefix(root).unwrap_or(&safe_path)
            } else {
                safe_path.as_path()
            };
            if relative.as_os_str().is_empty() {
                continue;
            }

            let out_path = temp_dir.join(relative);
            if entry.is_dir() {
                std::fs::create_dir_all(&out_path)?;
            } else {
                if let Some(parent) = out_path.parent() {
                    std::fs::create_dir_all(parent)?;
                }
                let mut out = File::create(&out_path)?;
                std::io::copy(&mut entry, &mut out)?;
            }
        }
        Ok(())
    })();
    if let Err(error) = extraction {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err(error);
    }

    if target_title_dir.exists() {
        std::fs::rename(target_title_dir, &old_dir)?;
    }
    if let Err(error) = std::fs::rename(&temp_dir, target_title_dir) {
        if old_dir.exists() {
            let _ = std::fs::rename(&old_dir, target_title_dir);
        }
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err(error.into());
    }
    let _ = std::fs::remove_dir_all(&old_dir);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_title_id_from_nsp_name() {
        let id = extract_title_id_from_path(
            r"C:\roms\switch\The Legend of Zelda Tears of the Kingdom [0100F2C0115B6000][v0].nsp",
        )
        .unwrap();
        assert_eq!(id, "0100F2C0115B6000");
    }

    #[test]
    fn path_title_id_fallback_requires_one_base_application_id() {
        assert_eq!(
            extract_title_ids_from_path("Game [0100F2C0115B6000].nsp"),
            vec!["0100F2C0115B6000".to_string()]
        );
        assert!(resolve_local_title_save_path(
            &AppConfig::default(),
            "Game [0100F2C0115B6000][0100ABCD00000002].nsp"
        )
        .is_err());
    }

    #[test]
    fn eden_save_base_matches_bios_root_for_portable_and_nonportable_layouts() {
        let temp = tempfile::tempdir().unwrap();

        let portable_dir = temp.path().join("portable");
        let portable_executable = portable_dir.join("eden.exe");
        let portable_user = portable_dir.join("user");
        std::fs::create_dir_all(&portable_user).unwrap();
        std::fs::write(&portable_executable, b"").unwrap();
        let mut portable_config = AppConfig::default();
        portable_config.emulators.eden = Some(portable_executable.clone());

        let portable_root = crate::bios::eden_data_root(&portable_executable, None).unwrap();
        assert_eq!(
            resolve_eden_save_base(&portable_config),
            portable_root.join("nand/user/save")
        );

        let installed_dir = temp.path().join("installed");
        let installed_executable = installed_dir.join("eden.exe");
        std::fs::create_dir_all(installed_dir.join("nand")).unwrap();
        std::fs::write(&installed_executable, b"").unwrap();
        let mut installed_config = AppConfig::default();
        installed_config.emulators.eden = Some(installed_executable.clone());

        let installed_root = crate::bios::eden_data_root(&installed_executable, None).unwrap();
        assert_eq!(installed_root, installed_dir);
        assert_eq!(
            resolve_eden_save_base(&installed_config),
            installed_root.join("nand/user/save")
        );
    }

    #[test]
    fn eden_save_base_matches_appdata_root_without_process_environment() {
        let temp = tempfile::tempdir().unwrap();
        let executable = temp.path().join("installed").join("eden.exe");
        let appdata = temp.path().join("AppData").join("Roaming");
        std::fs::create_dir_all(executable.parent().unwrap()).unwrap();
        std::fs::write(&executable, b"").unwrap();
        let mut config = AppConfig::default();
        config.emulators.eden = Some(executable.clone());

        let expected_root = crate::bios::eden_data_root(&executable, Some(&appdata)).unwrap();
        assert_eq!(
            resolve_eden_save_base_with_appdata(&config, Some(&appdata)),
            expected_root.join("nand/user/save")
        );
    }

    #[test]
    fn explicit_eden_save_root_override_remains_authoritative() {
        let temp = tempfile::tempdir().unwrap();
        let configured_root = temp.path().join("custom").join("nand").join("user");
        let mut config = AppConfig::default();
        config.emulators.eden_save_root = Some(configured_root.clone());

        assert_eq!(
            resolve_eden_save_base(&config),
            configured_root.join("save")
        );
    }

    #[test]
    fn rejects_invalid_title_id() {
        assert!(!is_valid_title_id("0200F2C0115B6000"));
    }

    #[test]
    fn rejects_archive_paths_outside_the_save_folder() {
        let temp = tempfile::tempdir().unwrap();
        let archive_path = temp.path().join("unsafe.zip");
        let file = File::create(&archive_path).unwrap();
        let mut archive = ZipWriter::new(file);
        archive
            .start_file("../escaped.dat", SimpleFileOptions::default())
            .unwrap();
        archive.write_all(b"unsafe").unwrap();
        archive.finish().unwrap();

        let target = temp.path().join("save");
        assert!(unzip_into_title_folder(&archive_path, &target).is_err());
        assert!(!temp.path().join("escaped.dat").exists());
    }
}
