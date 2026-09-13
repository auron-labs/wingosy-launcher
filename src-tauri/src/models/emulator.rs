use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Emulator {
    pub id: String,
    pub name: String,
    pub executable_path: Option<PathBuf>,
    pub supported_platforms: Vec<String>,
    pub launch_args: Vec<String>,
    pub rom_arg: String,
    pub core_name: Option<String>,
    pub is_retroarch: bool,
    pub is_installed: bool,
    pub github_repo: Option<String>,
    pub asset_pattern: Option<String>,
    pub download_url: Option<String>,
    pub archive_format: Option<String>,
}

impl Emulator {
    pub fn build_launch_command(&self, rom_path: &str) -> Option<(PathBuf, Vec<String>)> {
        let exe = self.executable_path.as_ref()?;

        let mut args: Vec<String> = self.launch_args.clone();

        if self.is_retroarch {
            if let Some(core) = &self.core_name {
                args.push("-L".to_string());
                args.push(core.clone());
            }
        }

        let rom_arg = self.rom_arg.replace("{rom}", rom_path);
        if !rom_arg.is_empty() {
            args.push(rom_arg);
        } else {
            args.push(rom_path.to_string());
        }

        Some((exe.clone(), args))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmulatorConfig {
    pub platform_id: Option<String>,
    pub game_id: Option<i64>,
    pub emulator_id: String,
    pub core_name: Option<String>,
    pub is_default: bool,
}

pub fn default_emulators() -> Vec<Emulator> {
    vec![
        Emulator {
            id: "retroarch".into(),
            name: "RetroArch".into(),
            executable_path: None,
            supported_platforms: vec!["*".into()],
            launch_args: vec!["--fullscreen".into()],
            rom_arg: "{rom}".into(),
            core_name: None,
            is_retroarch: true,
            is_installed: false,
            github_repo: None,
            asset_pattern: None,
            download_url: Some(
                "https://buildbot.libretro.com/stable/1.19.1/windows/x86_64/RetroArch.7z".into(),
            ),
            archive_format: Some("7z".into()),
        },
        Emulator {
            id: "dolphin".into(),
            name: "Dolphin".into(),
            executable_path: None,
            supported_platforms: vec!["gc".into(), "wii".into()],
            launch_args: vec!["-e".into()],
            rom_arg: "{rom}".into(),
            core_name: None,
            is_retroarch: false,
            is_installed: false,
            github_repo: None,
            asset_pattern: None,
            // Special URL marker - will be resolved via Dolphin's update API
            download_url: Some("dolphin-api://latest".into()),
            archive_format: Some("7z".into()),
        },
        Emulator {
            id: "pcsx2".into(),
            name: "PCSX2".into(),
            executable_path: None,
            supported_platforms: vec!["ps2".into()],
            launch_args: vec![],
            rom_arg: "{rom}".into(),
            core_name: None,
            is_retroarch: false,
            is_installed: false,
            github_repo: Some("PCSX2/pcsx2".into()),
            // Exclude symbols files with negative lookahead pattern
            asset_pattern: Some("(?i)pcsx2.*windows.*x64.*Qt\\.7z$".into()),
            download_url: None,
            archive_format: Some("7z".into()),
        },
        Emulator {
            id: "rpcs3".into(),
            name: "RPCS3".into(),
            executable_path: None,
            supported_platforms: vec!["ps3".into()],
            launch_args: vec!["--no-gui".into()],
            rom_arg: "{rom}".into(),
            core_name: None,
            is_retroarch: false,
            is_installed: false,
            // Official Windows CI builds (`rpcs3.net/latest` triggers 403 for non-browser clients)
            github_repo: Some("RPCS3/rpcs3-binaries-win".into()),
            asset_pattern: Some("(?i)^rpcs3-.*_win64_msvc\\.7z$".into()),
            download_url: None,
            archive_format: Some("7z".into()),
        },
        Emulator {
            id: "ppsspp".into(),
            name: "PPSSPP".into(),
            executable_path: None,
            supported_platforms: vec!["psp".into()],
            launch_args: vec![],
            rom_arg: "{rom}".into(),
            core_name: None,
            is_retroarch: false,
            is_installed: false,
            github_repo: Some("hrydgard/ppsspp".into()),
            asset_pattern: Some("(?i)PPSSPP.*Windows.*x64.*\\.zip$".into()),
            download_url: None,
            archive_format: Some("zip".into()),
        },
        Emulator {
            id: "duckstation".into(),
            name: "DuckStation".into(),
            executable_path: None,
            supported_platforms: vec!["psx".into()],
            launch_args: vec![],
            rom_arg: "{rom}".into(),
            core_name: None,
            is_retroarch: false,
            is_installed: false,
            github_repo: Some("stenzek/duckstation".into()),
            asset_pattern: Some("(?i)duckstation.*windows.*x64.*\\.zip$".into()),
            download_url: None,
            archive_format: Some("zip".into()),
        },
        Emulator {
            id: "cemu".into(),
            name: "Cemu".into(),
            executable_path: None,
            supported_platforms: vec!["wiiu".into()],
            launch_args: vec!["-g".into()],
            rom_arg: "{rom}".into(),
            core_name: None,
            is_retroarch: false,
            is_installed: false,
            github_repo: Some("cemu-project/Cemu".into()),
            asset_pattern: Some("(?i)cemu.*windows.*x64.*\\.zip$".into()),
            download_url: None,
            archive_format: Some("zip".into()),
        },
        Emulator {
            id: "eden".into(),
            name: "Eden".into(),
            executable_path: None,
            supported_platforms: vec!["switch".into()],
            launch_args: vec!["-g".into()],
            rom_arg: "{rom}".into(),
            core_name: None,
            is_retroarch: false,
            is_installed: false,
            // Releases live on git.eden-emu.dev (no GitHub `releases/latest` for upstream)
            github_repo: None,
            asset_pattern: Some("(?i)^Eden-Windows-.*amd64-msvc-standard\\.zip$".into()),
            download_url: Some("forgejo://git.eden-emu.dev/eden-emu/eden".into()),
            archive_format: Some("zip".into()),
        },
        Emulator {
            id: "citra".into(),
            name: "Citra / Lime3DS".into(),
            executable_path: None,
            supported_platforms: vec!["3ds".into()],
            launch_args: vec![],
            rom_arg: "{rom}".into(),
            core_name: None,
            is_retroarch: false,
            is_installed: false,
            github_repo: Some("Lime3DS/Lime3DS".into()),
            asset_pattern: Some("(?i)(lime3ds|azahar).*windows.*msvc.*\\.zip$".into()),
            download_url: None,
            archive_format: Some("zip".into()),
        },
        Emulator {
            id: "melonds".into(),
            name: "melonDS".into(),
            executable_path: None,
            supported_platforms: vec!["nds".into()],
            launch_args: vec![],
            rom_arg: "{rom}".into(),
            core_name: None,
            is_retroarch: false,
            is_installed: false,
            github_repo: Some("melonDS-emu/melonDS".into()),
            asset_pattern: Some("(?i)melonDS.*windows.*x86_64.*\\.zip$".into()),
            download_url: None,
            archive_format: Some("zip".into()),
        },
        Emulator {
            id: "mgba".into(),
            name: "mGBA".into(),
            executable_path: None,
            supported_platforms: vec!["gb".into(), "gbc".into(), "gba".into()],
            // Qt mGBA builds support the stable short form before --fullscreen.
            launch_args: vec!["-f".into()],
            rom_arg: "{rom}".into(),
            core_name: None,
            is_retroarch: false,
            is_installed: false,
            github_repo: Some("mgba-emu/mgba".into()),
            asset_pattern: Some("(?i)mGBA.*win64.*\\.7z$".into()),
            download_url: None,
            archive_format: Some("7z".into()),
        },
        Emulator {
            id: "flycast".into(),
            name: "Flycast".into(),
            executable_path: None,
            supported_platforms: vec!["dreamcast".into()],
            launch_args: vec![],
            rom_arg: "{rom}".into(),
            core_name: None,
            is_retroarch: false,
            is_installed: false,
            github_repo: Some("flyinghead/flycast".into()),
            asset_pattern: Some("(?i)flycast.*win64.*\\.zip$".into()),
            download_url: None,
            archive_format: Some("zip".into()),
        },
        Emulator {
            id: "xemu".into(),
            name: "xemu".into(),
            executable_path: None,
            supported_platforms: vec!["xbox".into()],
            launch_args: vec!["-dvd_path".into()],
            rom_arg: "{rom}".into(),
            core_name: None,
            is_retroarch: false,
            is_installed: false,
            github_repo: Some("xemu-project/xemu".into()),
            asset_pattern: Some("(?i)xemu.*win.*\\.zip$".into()),
            download_url: None,
            archive_format: Some("zip".into()),
        },
        Emulator {
            id: "xenia".into(),
            name: "Xenia Canary".into(),
            executable_path: None,
            supported_platforms: vec!["xbox360".into()],
            launch_args: vec![],
            rom_arg: "{rom}".into(),
            core_name: None,
            is_retroarch: false,
            is_installed: false,
            github_repo: Some("xenia-canary/xenia-canary".into()),
            asset_pattern: Some("(?i)xenia_canary.*\\.zip$".into()),
            download_url: None,
            archive_format: Some("zip".into()),
        },
        Emulator {
            id: "mame".into(),
            name: "MAME".into(),
            executable_path: None,
            supported_platforms: vec!["arcade".into()],
            launch_args: vec![],
            rom_arg: "{rom}".into(),
            core_name: None,
            is_retroarch: false,
            is_installed: false,
            github_repo: Some("mamedev/mame".into()),
            // Releases use e.g. mame0287b_x64.exe (not "*64bit*"); prefer 64-bit MSVC build over arm64
            asset_pattern: Some("(?i)^mame\\d+b_x64\\.exe$".into()),
            download_url: None,
            archive_format: Some("exe".into()),
        },
    ]
}

pub fn retroarch_cores() -> HashMap<String, &'static str> {
    let mut cores = HashMap::new();
    cores.insert("nes".into(), "fceumm_libretro.dll");
    cores.insert("snes".into(), "snes9x_libretro.dll");
    cores.insert("n64".into(), "mupen64plus_next_libretro.dll");
    cores.insert("gb".into(), "gambatte_libretro.dll");
    cores.insert("gbc".into(), "gambatte_libretro.dll");
    cores.insert("gba".into(), "mgba_libretro.dll");
    cores.insert("nds".into(), "melonds_libretro.dll");
    cores.insert("genesis".into(), "genesis_plus_gx_libretro.dll");
    cores.insert("psx".into(), "pcsx_rearmed_libretro.dll");
    cores.insert("dreamcast".into(), "flycast_libretro.dll");
    cores.insert("psp".into(), "ppsspp_libretro.dll");
    cores.insert("arcade".into(), "mame_libretro.dll");
    cores
}
