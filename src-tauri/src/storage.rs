use crate::config::AppConfig;
use crate::database::Database;
use crate::models::Game;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Mutex, MutexGuard};

static STORAGE_CHANGE_LOCK: Mutex<()> = Mutex::new(());
static ACTIVE_ROM_DOWNLOADS: AtomicUsize = AtomicUsize::new(0);

pub struct RomDownloadActivity;

impl Drop for RomDownloadActivity {
    fn drop(&mut self) {
        ACTIVE_ROM_DOWNLOADS.fetch_sub(1, Ordering::SeqCst);
    }
}

/// Registers a download while holding the same gate used by path changes. This closes the
/// check/start race: either the download keeps the old root for its whole lifetime, or it starts
/// after the new root has been committed.
pub fn begin_rom_download() -> Result<RomDownloadActivity, String> {
    let _gate = lock_storage_changes()?;
    ACTIVE_ROM_DOWNLOADS.fetch_add(1, Ordering::SeqCst);
    Ok(RomDownloadActivity)
}

#[derive(Debug, Clone, Serialize)]
pub struct StorageLocation {
    pub key: String,
    pub label: String,
    pub path: String,
    pub exists: bool,
    pub bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct StorageOverview {
    pub roms_directory: String,
    pub using_default_roms_directory: bool,
    pub free_disk_bytes: Option<u64>,
    pub active_rom_downloads: usize,
    pub tracked_rom_count: usize,
    pub tracked_rom_bytes: u64,
    pub migratable_rom_count: usize,
    pub migratable_rom_bytes: u64,
    pub locations: Vec<StorageLocation>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RomMigrationResult {
    pub old_directory: String,
    pub new_directory: String,
    pub moved: usize,
    pub missing: usize,
    pub conflicts: usize,
    pub outside_old_directory: usize,
    pub failed: usize,
    pub source_cleanup_failed: usize,
}

#[tauri::command]
pub fn get_storage_overview() -> Result<StorageOverview, String> {
    let config = AppConfig::load().map_err(|e| e.to_string())?;
    let db = Database::open().map_err(|e| e.to_string())?;
    let roms_directory = config.roms_dir();
    let games = db
        .get_all_games_including_hidden()
        .map_err(|e| e.to_string())?;

    let mut tracked_rom_count = 0usize;
    let mut tracked_rom_bytes = 0u64;
    let mut migratable_rom_count = 0usize;
    let mut migratable_rom_bytes = 0u64;
    let mut sized_paths = HashSet::new();

    for path in games
        .iter()
        .filter_map(|game| game.local_file_path.as_deref())
    {
        let path = Path::new(path);
        if !path.exists() {
            continue;
        }
        let key = path_key(path);
        let bytes = if sized_paths.insert(key) {
            path_size(path)
        } else {
            0
        };
        tracked_rom_count += 1;
        tracked_rom_bytes = tracked_rom_bytes.saturating_add(bytes);
        if relative_to_root(path, &roms_directory).is_some() {
            migratable_rom_count += 1;
            migratable_rom_bytes = migratable_rom_bytes.saturating_add(bytes);
        }
    }

    let locations = vec![
        location_with_size("roms", "ROMs", roms_directory.clone(), tracked_rom_bytes),
        location("bios", "BIOS & firmware", config.bios_dir()),
        location(
            "saves",
            "Save sync workspace",
            AppConfig::saves_dir().map_err(|e| e.to_string())?,
        ),
        location(
            "emulators",
            "Managed emulators",
            AppConfig::emulators_dir().map_err(|e| e.to_string())?,
        ),
        location(
            "cache",
            "Cache & artwork",
            AppConfig::cache_dir().map_err(|e| e.to_string())?,
        ),
        location(
            "logs",
            "Logs",
            AppConfig::logs_dir().map_err(|e| e.to_string())?,
        ),
    ];

    Ok(StorageOverview {
        roms_directory: roms_directory.to_string_lossy().into_owned(),
        using_default_roms_directory: config.library.roms_directory.is_none(),
        free_disk_bytes: free_disk_bytes(&roms_directory),
        active_rom_downloads: ACTIVE_ROM_DOWNLOADS.load(Ordering::SeqCst),
        tracked_rom_count,
        tracked_rom_bytes,
        migratable_rom_count,
        migratable_rom_bytes,
        locations,
    })
}

#[cfg(windows)]
fn free_disk_bytes(path: &Path) -> Option<u64> {
    use std::os::windows::ffi::OsStrExt;

    let existing_path = existing_path(path);
    let wide_path: Vec<u16> = existing_path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let mut available_bytes = 0u64;

    // Safety: `wide_path` is a valid NUL-terminated UTF-16 path and the output pointer points
    // to initialized storage for the duration of the Win32 call.
    let succeeded = unsafe {
        get_disk_free_space_ex_w(
            wide_path.as_ptr(),
            &mut available_bytes,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        ) != 0
    };

    succeeded.then_some(available_bytes)
}

#[cfg(windows)]
fn existing_path(path: &Path) -> PathBuf {
    let mut current = path;
    while !current.exists() {
        let Some(parent) = current.parent() else {
            return PathBuf::from(".");
        };
        current = parent;
    }
    current.to_path_buf()
}

#[cfg(not(windows))]
fn free_disk_bytes(_path: &Path) -> Option<u64> {
    None
}

#[cfg(windows)]
#[link(name = "kernel32")]
unsafe extern "system" {
    #[link_name = "GetDiskFreeSpaceExW"]
    fn get_disk_free_space_ex_w(
        directory_name: *const u16,
        free_bytes_available: *mut u64,
        total_number_of_bytes: *mut u64,
        total_number_of_free_bytes: *mut u64,
    ) -> i32;
}

/// Changes the ROM root. With `migrate_existing`, only database-linked files below the old root
/// are copied. The database is updated before the source is removed, so a failed migration never
/// destroys the only usable copy. Existing destination files are never overwritten.
#[tauri::command]
pub fn change_roms_directory(
    new_directory: String,
    migrate_existing: bool,
) -> Result<RomMigrationResult, String> {
    let new_directory = PathBuf::from(new_directory);
    if new_directory.as_os_str().is_empty() {
        return Err("Choose a ROM storage directory first.".to_string());
    }

    let _gate = lock_storage_changes()?;
    let active = ACTIVE_ROM_DOWNLOADS.load(Ordering::SeqCst);
    if active > 0 {
        return Err(format!(
            "Wait for {active} active ROM download{} to finish before changing storage.",
            if active == 1 { "" } else { "s" }
        ));
    }

    fs::create_dir_all(&new_directory)
        .map_err(|e| format!("Could not create the new ROM directory: {e}"))?;

    let mut config = AppConfig::load().map_err(|e| e.to_string())?;
    let old_directory = config.roms_dir();
    let mut result = RomMigrationResult {
        old_directory: old_directory.to_string_lossy().into_owned(),
        new_directory: new_directory.to_string_lossy().into_owned(),
        moved: 0,
        missing: 0,
        conflicts: 0,
        outside_old_directory: 0,
        failed: 0,
        source_cleanup_failed: 0,
    };

    let migration = if migrate_existing && !same_path(&old_directory, &new_directory) {
        let db = Database::open().map_err(|e| e.to_string())?;
        let games = db
            .get_all_games_including_hidden()
            .map_err(|e| e.to_string())?;
        Some((db, games))
    } else {
        None
    };

    // Commit the destination before copying. If the app is interrupted mid-migration, future
    // downloads use the new root while every not-yet-moved game still has a valid absolute path.
    config.library.roms_directory = Some(new_directory.clone());
    config.save().map_err(|e| e.to_string())?;

    if let Some((db, games)) = migration {
        let games_by_path = group_games_by_local_path(games);

        for linked_games in games_by_path.into_values() {
            let source = PathBuf::from(
                linked_games[0]
                    .local_file_path
                    .as_deref()
                    .expect("grouped games have a local path"),
            );
            if !source.exists() {
                result.missing += linked_games.len();
                continue;
            }
            let Some(relative) = relative_to_root(&source, &old_directory) else {
                result.outside_old_directory += linked_games.len();
                continue;
            };
            let destination = new_directory.join(relative);
            if destination.exists() {
                result.conflicts += linked_games.len();
                continue;
            }

            match copy_for_migration(&source, &destination) {
                Ok(()) => {
                    let mut updated_games = Vec::new();
                    let destination_string = destination.to_string_lossy().into_owned();
                    let mut update_failed = false;
                    for mut game in linked_games.iter().cloned() {
                        game.local_file_path = Some(destination_string.clone());
                        if let Err(error) = db.update_game(&game) {
                            tracing::error!(
                                "[Storage] Failed to update migrated path for game {}: {}",
                                game.id,
                                error
                            );
                            update_failed = true;
                            break;
                        }
                        updated_games.push(game);
                    }

                    if update_failed {
                        for original in &linked_games[..updated_games.len()] {
                            if let Err(error) = db.update_game(original) {
                                tracing::error!(
                                    "[Storage] Failed to roll back path for game {}: {}",
                                    original.id,
                                    error
                                );
                            }
                        }
                        let _ = remove_path(&destination);
                        result.failed += linked_games.len();
                        continue;
                    }
                    if remove_path(&source).is_err() {
                        result.source_cleanup_failed += 1;
                    }
                    result.moved += linked_games.len();
                }
                Err(error) => {
                    tracing::error!(
                        "[Storage] Failed to migrate {:?} to {:?}: {}",
                        source,
                        destination,
                        error
                    );
                    result.failed += linked_games.len();
                }
            }
        }
    }

    Ok(result)
}

fn lock_storage_changes() -> Result<MutexGuard<'static, ()>, String> {
    STORAGE_CHANGE_LOCK
        .lock()
        .map_err(|_| "The storage operation lock is unavailable.".to_string())
}

fn location(key: &str, label: &str, path: PathBuf) -> StorageLocation {
    let bytes = path_size(&path);
    location_with_size(key, label, path, bytes)
}

fn location_with_size(key: &str, label: &str, path: PathBuf, bytes: u64) -> StorageLocation {
    StorageLocation {
        key: key.to_string(),
        label: label.to_string(),
        path: path.to_string_lossy().into_owned(),
        exists: path.exists(),
        bytes,
    }
}

fn path_size(path: &Path) -> u64 {
    if path.is_file() {
        return path.metadata().map(|m| m.len()).unwrap_or(0);
    }
    walkdir::WalkDir::new(path)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| entry.metadata().ok())
        .filter(|metadata| metadata.is_file())
        .fold(0u64, |total, metadata| total.saturating_add(metadata.len()))
}

fn same_path(left: &Path, right: &Path) -> bool {
    let left = fs::canonicalize(left).unwrap_or_else(|_| left.to_path_buf());
    let right = fs::canonicalize(right).unwrap_or_else(|_| right.to_path_buf());
    if cfg!(windows) {
        left.to_string_lossy()
            .eq_ignore_ascii_case(&right.to_string_lossy())
    } else {
        left == right
    }
}

fn path_key(path: &Path) -> String {
    let value = fs::canonicalize(path)
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .into_owned();
    if cfg!(windows) {
        value.to_lowercase()
    } else {
        value
    }
}

fn relative_to_root(path: &Path, root: &Path) -> Option<PathBuf> {
    let canonical_path = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let canonical_root = fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    canonical_path
        .strip_prefix(canonical_root)
        .ok()
        .map(Path::to_path_buf)
}

fn group_games_by_local_path(games: Vec<Game>) -> HashMap<String, Vec<Game>> {
    let mut grouped = HashMap::<String, Vec<Game>>::new();
    for game in games {
        if let Some(local_path) = game.local_file_path.as_deref() {
            grouped
                .entry(path_key(Path::new(local_path)))
                .or_default()
                .push(game);
        }
    }
    grouped
}

fn copy_for_migration(source: &Path, destination: &Path) -> Result<(), String> {
    if destination.exists() {
        return Err("Destination already exists; it was not overwritten.".to_string());
    }
    let parent = destination
        .parent()
        .ok_or_else(|| "Destination has no parent directory.".to_string())?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;

    let file_name = destination
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("rom");
    let temporary = parent.join(format!(".{file_name}.wingosy-migrating"));
    let _ = remove_path(&temporary);

    if source.is_dir() {
        copy_directory(source, &temporary)?;
    } else {
        fs::copy(source, &temporary).map_err(|e| e.to_string())?;
    }
    fs::rename(&temporary, destination).map_err(|e| {
        let _ = remove_path(&temporary);
        e.to_string()
    })
}

fn copy_directory(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination).map_err(|e| e.to_string())?;
    for entry in walkdir::WalkDir::new(source) {
        let entry = entry.map_err(|e| e.to_string())?;
        let relative = entry
            .path()
            .strip_prefix(source)
            .map_err(|e| e.to_string())?;
        let target = destination.join(relative);
        if entry.file_type().is_dir() {
            fs::create_dir_all(&target).map_err(|e| e.to_string())?;
        } else if entry.file_type().is_file() {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::copy(entry.path(), target).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn remove_path(path: &Path) -> std::io::Result<()> {
    if !path.exists() {
        return Ok(());
    }
    if path.is_dir() {
        fs::remove_dir_all(path)
    } else {
        fs::remove_file(path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn migration_copy_keeps_source_until_cleanup() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("old").join("switch").join("game.nsp");
        let destination = temp.path().join("new").join("switch").join("game.nsp");
        fs::create_dir_all(source.parent().unwrap()).unwrap();
        fs::write(&source, b"rom-data").unwrap();

        copy_for_migration(&source, &destination).unwrap();

        assert_eq!(fs::read(&source).unwrap(), b"rom-data");
        assert_eq!(fs::read(&destination).unwrap(), b"rom-data");
    }

    #[test]
    fn migration_copy_does_not_overwrite_destination() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("old.rom");
        let destination = temp.path().join("new.rom");
        fs::write(&source, b"old").unwrap();
        fs::write(&destination, b"new").unwrap();

        assert!(copy_for_migration(&source, &destination).is_err());
        assert_eq!(fs::read(&destination).unwrap(), b"new");
    }

    #[test]
    fn duplicate_game_paths_are_grouped_for_one_file_move() {
        let temp = tempdir().unwrap();
        let path = temp.path().join("switch").join("game.nsp");
        let mut first = Game::new(
            "Game".to_string(),
            path.to_string_lossy().into_owned(),
            "switch".to_string(),
        );
        first.local_file_path = Some(path.to_string_lossy().into_owned());
        let mut duplicate = first.clone();
        duplicate.id = 2;

        let grouped = group_games_by_local_path(vec![first, duplicate]);

        assert_eq!(grouped.len(), 1);
        assert_eq!(grouped.values().next().unwrap().len(), 2);
    }
}
