use std::path::{Path, PathBuf};

#[cfg(windows)]
use std::env;

use crate::emulators::cores::get_cores_dir;

pub fn detect_installed_emulators() -> Vec<DetectedEmulator> {
    tracing::info!("[Emulators] Starting emulator detection scan...");
    let mut detected: Vec<DetectedEmulator> = Vec::new();

    #[cfg(windows)]
    {
        detected.extend(detect_windows_emulators());
    }

    // Deduplicate by id, keeping the first found (which is usually the preferred location)
    let mut seen_ids = std::collections::HashSet::new();
    detected.retain(|emu| seen_ids.insert(emu.id.clone()));

    if detected.is_empty() {
        tracing::warn!("[Emulators] No emulators detected on system");
    } else {
        tracing::info!("[Emulators] Detected {} emulator(s):", detected.len());
        for emu in &detected {
            tracing::info!(
                "[Emulators]   - {} v{} at {:?}",
                emu.name,
                emu.version.as_deref().unwrap_or("unknown"),
                emu.path
            );
        }
    }

    detected
}

#[derive(Debug, Clone)]
pub struct DetectedEmulator {
    pub id: String,
    pub name: String,
    pub path: PathBuf,
    pub version: Option<String>,
    pub install_type: InstallType,
}

#[derive(Debug, Clone, PartialEq)]
pub enum InstallType {
    /// Installed via Steam
    Steam,
    /// System-wide installation (Program Files)
    System,
    /// Portable installation (no registry, standalone folder)
    Portable,
    /// Installed via our app
    Managed,
    /// User-specified custom location
    Custom,
}

impl InstallType {
    pub fn as_str(&self) -> &'static str {
        match self {
            InstallType::Steam => "steam",
            InstallType::System => "system",
            InstallType::Portable => "portable",
            InstallType::Managed => "managed",
            InstallType::Custom => "custom",
        }
    }
}

#[cfg(windows)]
fn detect_windows_emulators() -> Vec<DetectedEmulator> {
    let mut detected = Vec::new();

    // 1. Check Windows Registry for installed emulators
    detected.extend(detect_from_registry());

    // 2. Check Steam installations
    detected.extend(detect_steam_emulators());

    // 3. Check our managed installation directory
    detected.extend(detect_managed_emulators());

    // 4. Check common file system paths
    detected.extend(detect_from_filesystem());

    detected
}

#[cfg(windows)]
fn detect_from_registry() -> Vec<DetectedEmulator> {
    use winreg::enums::*;
    use winreg::RegKey;

    let mut detected = Vec::new();

    // Check both HKEY_LOCAL_MACHINE and HKEY_CURRENT_USER
    let registry_paths = [
        (
            HKEY_LOCAL_MACHINE,
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
        (
            HKEY_LOCAL_MACHINE,
            r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
        (
            HKEY_CURRENT_USER,
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        ),
    ];

    let emulator_patterns = get_emulator_patterns();

    for (hive, path) in registry_paths {
        let hklm = match RegKey::predef(hive).open_subkey(path) {
            Ok(key) => key,
            Err(_) => continue,
        };

        for subkey_name in hklm.enum_keys().filter_map(|k| k.ok()) {
            let subkey = match hklm.open_subkey(&subkey_name) {
                Ok(key) => key,
                Err(_) => continue,
            };

            let display_name: String = match subkey.get_value("DisplayName") {
                Ok(name) => name,
                Err(_) => continue,
            };

            let install_location: Option<String> = subkey.get_value("InstallLocation").ok();
            let display_version: Option<String> = subkey.get_value("DisplayVersion").ok();

            // Check if this matches any of our emulator patterns
            for (id, name, executables) in &emulator_patterns {
                if display_name.to_lowercase().contains(&name.to_lowercase()) {
                    if let Some(ref loc) = install_location {
                        let loc_path = PathBuf::from(loc);
                        for exe in *executables {
                            let exe_path = loc_path.join(exe);
                            if exe_path.is_file() {
                                tracing::debug!(
                                    "[Emulators] Found {} via registry at {:?}",
                                    name,
                                    exe_path
                                );
                                detected.push(DetectedEmulator {
                                    id: id.to_string(),
                                    name: name.to_string(),
                                    path: exe_path,
                                    version: display_version.clone(),
                                    install_type: InstallType::System,
                                });
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    detected
}

#[cfg(windows)]
fn detect_steam_emulators() -> Vec<DetectedEmulator> {
    use winreg::enums::*;
    use winreg::RegKey;

    let mut detected = Vec::new();

    // Find Steam installation path from registry
    let steam_path = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\WOW6432Node\Valve\Steam")
        .or_else(|_| RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(r"SOFTWARE\Valve\Steam"))
        .or_else(|_| RegKey::predef(HKEY_CURRENT_USER).open_subkey(r"SOFTWARE\Valve\Steam"))
        .ok()
        .and_then(|key| key.get_value::<String, _>("InstallPath").ok())
        .map(PathBuf::from);

    let steam_path = match steam_path {
        Some(p) => p,
        None => return detected,
    };

    tracing::debug!("[Emulators] Found Steam at {:?}", steam_path);

    // Get all Steam library folders
    let mut library_folders = vec![steam_path.join("steamapps")];

    // Parse libraryfolders.vdf to find additional library locations
    let library_file = steam_path.join("steamapps").join("libraryfolders.vdf");
    if let Ok(content) = std::fs::read_to_string(&library_file) {
        for line in content.lines() {
            if line.contains("\"path\"") {
                if let Some(path_start) = line.rfind('"') {
                    let path_end = line[..path_start].rfind('"').unwrap_or(0);
                    let folder_path = &line[path_end + 1..path_start];
                    let steamapps = PathBuf::from(folder_path).join("steamapps");
                    if steamapps.exists() {
                        library_folders.push(steamapps);
                    }
                }
            }
        }
    }

    // Steam App IDs for emulators
    let steam_emulators = [
        ("1118310", "retroarch", "RetroArch", "retroarch.exe"),
        ("1147940", "dolphin", "Dolphin", "Dolphin.exe"),
        // Add more Steam emulators as needed
    ];

    for library in &library_folders {
        let common = library.join("common");
        if !common.exists() {
            continue;
        }

        for (app_id, id, name, exe) in &steam_emulators {
            // Check if the app is installed via appmanifest
            let manifest = library.join(format!("appmanifest_{}.acf", app_id));
            if !manifest.exists() {
                continue;
            }

            // Parse manifest to get install directory name
            if let Ok(content) = std::fs::read_to_string(&manifest) {
                let mut install_dir = None;
                for line in content.lines() {
                    if line.contains("\"installdir\"") {
                        if let Some(start) = line.rfind('"') {
                            let end = line[..start].rfind('"').unwrap_or(0);
                            install_dir = Some(line[end + 1..start].to_string());
                            break;
                        }
                    }
                }

                if let Some(dir) = install_dir {
                    let exe_path = common.join(&dir).join(exe);
                    if exe_path.is_file() {
                        tracing::debug!("[Emulators] Found {} via Steam at {:?}", name, exe_path);
                        detected.push(DetectedEmulator {
                            id: id.to_string(),
                            name: name.to_string(),
                            path: exe_path,
                            version: None,
                            install_type: InstallType::Steam,
                        });
                    }
                }
            }
        }
    }

    detected
}

#[cfg(windows)]
fn detect_managed_emulators() -> Vec<DetectedEmulator> {
    use crate::config::AppConfig;

    let mut detected = Vec::new();

    let emulators_dir = match AppConfig::emulators_dir() {
        Ok(dir) => dir,
        Err(_) => return detected,
    };

    if !emulators_dir.exists() {
        return detected;
    }

    let emulator_patterns = get_emulator_patterns();

    for (id, name, executables) in &emulator_patterns {
        let emu_dir = emulators_dir.join(id);
        if !emu_dir.exists() {
            continue;
        }

        // Search recursively up to 2 levels deep for the executable
        'exe_search: for exe in *executables {
            // Direct path
            let exe_path = emu_dir.join(exe);
            if exe_path.is_file() {
                tracing::debug!("[Emulators] Found managed {} at {:?}", name, exe_path);
                detected.push(DetectedEmulator {
                    id: id.to_string(),
                    name: name.to_string(),
                    path: exe_path,
                    version: None,
                    install_type: InstallType::Managed,
                });
                break 'exe_search;
            }

            // Search subdirectories (one level deep - common for extracted archives)
            if let Ok(entries) = std::fs::read_dir(&emu_dir) {
                for entry in entries.filter_map(|e| e.ok()) {
                    let entry_path = entry.path();
                    if entry_path.is_dir() {
                        let nested_exe = entry_path.join(exe);
                        if nested_exe.is_file() {
                            tracing::debug!(
                                "[Emulators] Found managed {} at {:?}",
                                name,
                                nested_exe
                            );
                            detected.push(DetectedEmulator {
                                id: id.to_string(),
                                name: name.to_string(),
                                path: nested_exe,
                                version: None,
                                install_type: InstallType::Managed,
                            });
                            break 'exe_search;
                        }
                    }
                }
            }
        }
    }

    detected
}

#[cfg(windows)]
fn detect_from_filesystem() -> Vec<DetectedEmulator> {
    let mut detected = Vec::new();

    let common_paths = get_common_install_paths();
    let emulator_patterns = get_emulator_patterns();

    for base_path in &common_paths {
        if !base_path.exists() {
            continue;
        }

        for (id, name, executables) in &emulator_patterns {
            for exe in *executables {
                let potential_paths = [
                    base_path.join(exe),
                    base_path.join(name).join(exe),
                    base_path.join(name.to_lowercase()).join(exe),
                    base_path.join(format!("{}-Win64", name)).join(exe),
                    base_path.join(format!("{}_Windows", name)).join(exe),
                ];

                for path in potential_paths {
                    if path.is_file() {
                        tracing::debug!("[Emulators] Found {} on filesystem at {:?}", name, path);
                        detected.push(DetectedEmulator {
                            id: id.to_string(),
                            name: name.to_string(),
                            path,
                            version: None,
                            install_type: InstallType::Portable,
                        });
                        break;
                    }
                }
            }
        }
    }

    detected
}

#[cfg(windows)]
fn get_emulator_patterns() -> Vec<(&'static str, &'static str, &'static [&'static str])> {
    vec![
        (
            "retroarch",
            "RetroArch",
            &["retroarch.exe", "RetroArch.exe"][..],
        ),
        ("dolphin", "Dolphin", &["Dolphin.exe"][..]),
        (
            "pcsx2",
            "PCSX2",
            &["pcsx2.exe", "pcsx2-qt.exe", "pcsx2-qtx64.exe"][..],
        ),
        ("rpcs3", "RPCS3", &["rpcs3.exe"][..]),
        (
            "ppsspp",
            "PPSSPP",
            &["PPSSPPWindows.exe", "PPSSPPWindows64.exe"][..],
        ),
        (
            "duckstation",
            "DuckStation",
            &[
                "duckstation-qt-x64-ReleaseLTCG.exe",
                "duckstation-nogui-x64-ReleaseLTCG.exe",
                "duckstation-qt.exe",
            ][..],
        ),
        ("cemu", "Cemu", &["Cemu.exe"][..]),
        ("eden", "Eden", &["eden.exe", "Eden.exe"][..]),
        ("citra", "Citra", &["citra-qt.exe", "lime3ds.exe"][..]),
        ("melonds", "melonDS", &["melonDS.exe"][..]),
        ("mgba", "mGBA", &["mGBA.exe", "mgba.exe"][..]),
        ("flycast", "Flycast", &["flycast.exe"][..]),
        ("xemu", "xemu", &["xemu.exe"][..]),
        ("xenia", "Xenia", &["xenia_canary.exe", "xenia.exe"][..]),
        ("mame", "MAME", &["mame.exe", "mame64.exe"][..]),
        ("snes9x", "Snes9x", &["snes9x-x64.exe", "snes9x.exe"][..]),
    ]
}

#[cfg(windows)]
fn get_common_install_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    // Program Files directories
    if let Ok(program_files) = env::var("ProgramFiles") {
        paths.push(PathBuf::from(&program_files));
        paths.push(PathBuf::from(&program_files).join("Emulators"));
        paths.push(PathBuf::from(&program_files).join("RetroArch"));
        paths.push(PathBuf::from(&program_files).join("RetroArch-Win64"));
    }

    if let Ok(program_files_x86) = env::var("ProgramFiles(x86)") {
        paths.push(PathBuf::from(&program_files_x86));
        paths.push(PathBuf::from(&program_files_x86).join("Emulators"));
        paths.push(PathBuf::from(&program_files_x86).join("RetroArch"));
    }

    // AppData locations
    if let Ok(local_app_data) = env::var("LOCALAPPDATA") {
        paths.push(PathBuf::from(&local_app_data));
        paths.push(PathBuf::from(&local_app_data).join("Programs"));
        paths.push(PathBuf::from(&local_app_data).join("RetroArch"));
    }

    if let Ok(app_data) = env::var("APPDATA") {
        paths.push(PathBuf::from(&app_data));
        paths.push(PathBuf::from(&app_data).join("RetroArch"));
    }

    // User profile locations
    if let Ok(user_profile) = env::var("USERPROFILE") {
        let user_path = PathBuf::from(&user_profile);
        paths.push(user_path.join("Emulators"));
        paths.push(user_path.join("Games").join("Emulators"));
        paths.push(user_path.join("Downloads"));
        paths.push(user_path.join("Downloads").join("RetroArch-Win64"));
        paths.push(user_path.join("Desktop"));
        paths.push(user_path.join("scoop").join("apps"));
    }

    // Common drive locations
    for drive in &['C', 'D', 'E', 'F'] {
        let drive_path = PathBuf::from(format!("{}:", drive));
        if drive_path.exists() {
            paths.push(drive_path.join("Emulators"));
            paths.push(drive_path.join("Games").join("Emulators"));
            paths.push(drive_path.join("RetroArch"));
            paths.push(drive_path.join("RetroArch-Win64"));
        }
    }

    paths
}

#[cfg(not(windows))]
fn get_common_install_paths() -> Vec<PathBuf> {
    Vec::new()
}

pub fn find_retroarch_cores(retroarch_path: &PathBuf) -> Vec<RetroArchCore> {
    tracing::debug!("[RetroArch] Scanning for cores near {:?}", retroarch_path);
    let mut cores = Vec::new();

    let cores_dir = get_cores_dir(retroarch_path);

    if cores_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&cores_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.extension().map(|e| e == "dll").unwrap_or(false) {
                    if let Some(name) = path.file_stem().and_then(|n| n.to_str()) {
                        cores.push(RetroArchCore {
                            name: name.to_string(),
                            path,
                        });
                    }
                }
            }
        }
        tracing::info!("[RetroArch] Found {} cores in {:?}", cores.len(), cores_dir);
    } else {
        tracing::warn!("[RetroArch] Cores directory not found: {:?}", cores_dir);
    }

    cores
}

#[derive(Debug, Clone)]
pub struct RetroArchCore {
    pub name: String,
    pub path: PathBuf,
}

/// Open file explorer to the emulator's directory
pub fn open_emulator_location(path: &Path) -> Result<(), String> {
    #[cfg(windows)]
    if let Some(parent) = path.parent() {
        std::process::Command::new("explorer")
            .arg(parent)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .args(["-R", &path.to_string_lossy()])
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(path.parent().ok_or("Invalid emulator path")?)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(any(windows, target_os = "macos", target_os = "linux"))]
    {
        Ok(())
    }

    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    {
        Err("Opening emulator location is unsupported on this platform".to_string())
    }
}

/// Launch the emulator standalone (without a ROM)
pub fn launch_emulator(path: &Path) -> Result<(), String> {
    std::process::Command::new(path)
        .spawn()
        .map_err(|e| format!("Failed to launch emulator: {}", e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_install_type_as_str() {
        assert_eq!(InstallType::Steam.as_str(), "steam");
        assert_eq!(InstallType::System.as_str(), "system");
        assert_eq!(InstallType::Portable.as_str(), "portable");
        assert_eq!(InstallType::Managed.as_str(), "managed");
        assert_eq!(InstallType::Custom.as_str(), "custom");
    }

    #[test]
    fn test_detected_emulator_struct() {
        let emu = DetectedEmulator {
            id: "retroarch".to_string(),
            name: "RetroArch".to_string(),
            path: PathBuf::from("C:/RetroArch/retroarch.exe"),
            version: Some("1.16.0".to_string()),
            install_type: InstallType::Portable,
        };

        assert_eq!(emu.id, "retroarch");
        assert_eq!(emu.name, "RetroArch");
        assert!(emu.path.to_string_lossy().contains("retroarch.exe"));
        assert_eq!(emu.version, Some("1.16.0".to_string()));
        assert_eq!(emu.install_type, InstallType::Portable);
    }

    #[test]
    fn test_retroarch_core_struct() {
        let core = RetroArchCore {
            name: "snes9x_libretro".to_string(),
            path: PathBuf::from("C:/RetroArch/cores/snes9x_libretro.dll"),
        };

        assert_eq!(core.name, "snes9x_libretro");
        assert!(core.path.to_string_lossy().contains("snes9x_libretro.dll"));
    }

    #[test]
    fn test_install_type_clone() {
        let original = InstallType::Steam;
        let cloned = original.clone();
        assert_eq!(original, cloned);
    }

    #[test]
    fn test_detected_emulator_clone() {
        let emu = DetectedEmulator {
            id: "test".to_string(),
            name: "Test Emu".to_string(),
            path: PathBuf::from("C:/test.exe"),
            version: None,
            install_type: InstallType::Custom,
        };

        let cloned = emu.clone();
        assert_eq!(emu.id, cloned.id);
        assert_eq!(emu.name, cloned.name);
        assert_eq!(emu.path, cloned.path);
    }

    #[cfg(windows)]
    #[test]
    fn test_get_emulator_patterns_not_empty() {
        let patterns = get_emulator_patterns();
        assert!(!patterns.is_empty());

        // Should include common emulators
        let ids: Vec<&str> = patterns.iter().map(|(id, _, _)| *id).collect();
        assert!(ids.contains(&"retroarch"));
        assert!(ids.contains(&"dolphin"));
        assert!(ids.contains(&"pcsx2"));
    }

    #[cfg(windows)]
    #[test]
    fn test_mgba_pattern_includes_official_executable_aliases() {
        let (_, name, executables) = get_emulator_patterns()
            .into_iter()
            .find(|(id, _, _)| *id == "mgba")
            .expect("mGBA detection pattern should exist");

        assert_eq!(name, "mGBA");
        assert!(executables.contains(&"mGBA.exe"));
        assert!(executables.contains(&"mgba.exe"));
    }

    #[cfg(windows)]
    #[test]
    fn test_emulator_patterns_have_executables() {
        let patterns = get_emulator_patterns();

        for (id, name, executables) in &patterns {
            assert!(!id.is_empty(), "ID should not be empty");
            assert!(!name.is_empty(), "Name should not be empty");
            assert!(
                !executables.is_empty(),
                "{} should have at least one executable",
                name
            );

            for exe in *executables {
                assert!(
                    exe.ends_with(".exe"),
                    "{} executable {} should end with .exe",
                    name,
                    exe
                );
            }
        }
    }

    #[cfg(windows)]
    #[test]
    fn test_get_common_install_paths_not_empty() {
        let paths = get_common_install_paths();
        // Should find at least some paths on any Windows system
        assert!(!paths.is_empty());
    }

    #[test]
    fn test_find_retroarch_cores_nonexistent_path() {
        let fake_path = PathBuf::from("C:/NonExistent/Path/retroarch.exe");
        let cores = find_retroarch_cores(&fake_path);
        assert!(cores.is_empty());
    }

    #[test]
    fn test_find_retroarch_cores_uses_executable_parent_cores_directory() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("RetroArch").join("retroarch.exe");
        let core = executable
            .parent()
            .unwrap()
            .join("cores")
            .join("fceumm_libretro.dll");
        std::fs::create_dir_all(core.parent().unwrap()).unwrap();
        std::fs::write(&executable, b"retroarch").unwrap();
        std::fs::write(&core, b"core").unwrap();

        let cores = find_retroarch_cores(&executable);

        assert_eq!(cores.len(), 1);
        assert_eq!(cores[0].path, core);
    }
}
