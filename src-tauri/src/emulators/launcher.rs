use anyhow::{Context, Result, bail};
use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;
use std::process::Command;
use std::time::Instant;

use crate::config::AppConfig;
use crate::database::Database;
use crate::models::{Emulator, Game, GameSource, retroarch_cores};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchCommand {
    pub executable: String,
    pub args: Vec<String>,
    pub full_command: String,
    pub emulator_id: String,
    pub emulator_name: String,
    pub core_name: Option<String>,
    pub game_name: String,
    pub rom_path: String,
}

pub struct EmulatorLauncher {
    config: AppConfig,
    db: Database,
}

impl EmulatorLauncher {
    pub fn new(config: AppConfig, db: Database) -> Self {
        Self { config, db }
    }

    pub(crate) fn resolve_rom_path(game: &Game) -> Result<String> {
        if let Some(path) = game.local_file_path.as_deref() {
            if Path::new(path).is_file() {
                return Ok(path.to_string());
            }
        }

        if game.source == GameSource::Local && Path::new(&game.file_path).is_file() {
            return Ok(game.file_path.clone());
        }

        let checked = match (game.source, game.local_file_path.as_deref()) {
            (GameSource::RomM, Some(path)) => format!("cached path '{}'", path),
            (GameSource::RomM, None) => "a cached local path".to_string(),
            (GameSource::Local, Some(path)) => {
                format!("local path '{}' and file path '{}'", path, game.file_path)
            }
            (GameSource::Local, None) => format!("file path '{}'", game.file_path),
        };
        bail!("ROM file for '{}' was not found locally (checked {})", game.name, checked)
    }

    pub fn build_command(&self, game: &Game) -> Result<LaunchCommand> {
        let emulator = self.resolve_emulator(game)?;
        let rom_path = game
            .local_file_path
            .as_ref()
            .or(Some(&game.file_path))
            .context("No ROM path available")?;

        let (exe_path, args) = emulator
            .build_launch_command(rom_path)
            .context("Failed to build launch command")?;

        let exe_str = exe_path.to_string_lossy().to_string();
        let full_command = format!(
            "\"{}\" {}",
            exe_str,
            args.iter()
                .map(|a| if a.contains(' ') { format!("\"{}\"", a) } else { a.clone() })
                .collect::<Vec<_>>()
                .join(" ")
        );

        Ok(LaunchCommand {
            executable: exe_str,
            args: args.clone(),
            full_command,
            emulator_id: emulator.id.clone(),
            emulator_name: emulator.name.clone(),
            core_name: emulator.core_name.clone(),
            game_name: game.name.clone(),
            rom_path: rom_path.clone(),
        })
    }

    pub async fn launch(&self, game: &Game) -> Result<LaunchResult> {
        self.launch_with_running_stage(game, || {}).await
    }

    pub(crate) async fn launch_with_running_stage<F>(
        &self,
        game: &Game,
        on_running: F,
    ) -> Result<LaunchResult>
    where
        F: FnOnce() + Send + 'static,
    {
        let emulator = self.resolve_emulator(game)?;
        let rom_path = game
            .local_file_path
            .as_ref()
            .or(Some(&game.file_path))
            .context("No ROM path available")?;

        if !Path::new(rom_path).exists() {
            return Ok(LaunchResult::FileNotFound(rom_path.clone()));
        }

        let (exe_path, args) = emulator
            .build_launch_command(rom_path)
            .context("Failed to build launch command")?;

        if !exe_path.exists() {
            return Ok(LaunchResult::EmulatorNotInstalled {
                name: emulator.name.clone(),
                id: emulator.id.clone(),
            });
        }

        let command = self.build_command(game)?;

        tracing::info!(
            "[Launch] {} via {} | platform={} | rom={}",
            game.name,
            emulator.name,
            game.platform_id,
            rom_path
        );

        self.log_launch_to_file(&command);

        let start_time = Instant::now();

        let mut child = Command::new(&exe_path)
            .args(&args)
            .spawn()
            .context("Failed to launch emulator")?;

        on_running();
        let status = child.wait().context("Failed to wait for emulator")?;

        let duration = start_time.elapsed();
        let duration_minutes = (duration.as_secs() / 60) as i32;

        if duration_minutes > 0 {
            self.db.record_play_session(game.id, duration_minutes)?;
        }

        tracing::info!(
            "[Launch Complete] {} | duration={}m | exit_code={:?}",
            game.name,
            duration_minutes,
            status.code()
        );

        Ok(LaunchResult::Success {
            duration_minutes,
            exit_code: status.code(),
            command: Some(command),
        })
    }

    fn log_launch_to_file(&self, command: &LaunchCommand) {
        if let Ok(logs_dir) = AppConfig::logs_dir() {
            if let Err(e) = fs::create_dir_all(&logs_dir) {
                tracing::warn!("Failed to create logs directory: {}", e);
                return;
            }

            let log_file = logs_dir.join("launches.log");
            let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S");

            let log_entry = format!(
                "[{}] {} via {}\n  ROM: {}\n  Command: {}\n\n",
                timestamp,
                command.game_name,
                command.emulator_name,
                command.rom_path,
                command.full_command
            );

            match OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_file)
            {
                Ok(mut file) => {
                    if let Err(e) = file.write_all(log_entry.as_bytes()) {
                        tracing::warn!("Failed to write to launch log: {}", e);
                    }
                }
                Err(e) => {
                    tracing::warn!("Failed to open launch log file: {}", e);
                }
            }
        }
    }

    fn resolve_emulator(&self, game: &Game) -> Result<Emulator> {
        // 1. Check per-game emulator config
        if let Ok(Some(config)) = self.db.get_emulator_for_game(game.id, &game.platform_id) {
            let emulators = crate::models::default_emulators();
            
            if let Some(mut emu) = emulators.into_iter().find(|e| e.id == config.emulator_id) {
                emu.executable_path = self.get_emulator_path(&emu.id);
                emu.core_name = config.core_name;
                return Ok(emu);
            }
        }

        // 2. Check platform default emulator from config
        if let Some(default_emu_id) = self.config.emulators.platform_defaults.get(&game.platform_id) {
            let emulators = crate::models::default_emulators();
            
            if let Some(mut emu) = emulators.into_iter().find(|e| &e.id == default_emu_id) {
                emu.executable_path = self.get_emulator_path(&emu.id);
                
                if emu.is_retroarch {
                    if let Some(core) = retroarch_cores().get(&game.platform_id) {
                        emu.core_name = Some(core.to_string());
                    }
                }
                
                if emu.executable_path.is_some() {
                    tracing::info!("[Launch] Using platform default emulator: {} for {}", emu.name, game.platform_id);
                    return Ok(emu);
                }
            }
        }

        // 3. Auto-detect: find first available emulator for this platform
        let mut emulators = crate::models::default_emulators();
        
        for emu in &mut emulators {
            if emu.supported_platforms.contains(&game.platform_id)
                || emu.supported_platforms.contains(&"*".to_string())
            {
                emu.executable_path = self.get_emulator_path(&emu.id);
                
                if emu.is_retroarch {
                    if let Some(core) = retroarch_cores().get(&game.platform_id) {
                        emu.core_name = Some(core.to_string());
                    }
                }
                
                if emu.executable_path.is_some() {
                    return Ok(emu.clone());
                }
            }
        }

        // 4. Fallback to RetroArch if available
        if let Some(retroarch) = emulators.iter_mut().find(|e| e.id == "retroarch") {
            retroarch.executable_path = self.get_emulator_path("retroarch");
            if let Some(core) = retroarch_cores().get(&game.platform_id) {
                retroarch.core_name = Some(core.to_string());
            }
            if retroarch.executable_path.is_some() {
                return Ok(retroarch.clone());
            }
        }

        bail!(
            "No emulator configured for platform: {}",
            game.platform_id
        )
    }

    fn get_emulator_path(&self, emulator_id: &str) -> Option<std::path::PathBuf> {
        match emulator_id {
            "retroarch" => self.config.emulators.retroarch.clone(),
            "dolphin" => self.config.emulators.dolphin.clone(),
            "pcsx2" => self.config.emulators.pcsx2.clone(),
            "rpcs3" => self.config.emulators.rpcs3.clone(),
            "ppsspp" => self.config.emulators.ppsspp.clone(),
            "duckstation" => self.config.emulators.duckstation.clone(),
            "cemu" => self.config.emulators.cemu.clone(),
            "eden" => self.config.emulators.eden.clone(),
            "citra" => self.config.emulators.citra.clone(),
            "melonds" => self.config.emulators.melonds.clone(),
            "mgba" => self.config.emulators.mgba.clone(),
            "flycast" => self.config.emulators.flycast.clone(),
            "xemu" => self.config.emulators.xemu.clone(),
            "xenia" => self.config.emulators.xenia.clone(),
            "mame" => self.config.emulators.mame.clone(),
            _ => None,
        }
    }

    pub fn get_available_emulators_for_platform(&self, platform_id: &str) -> Vec<Emulator> {
        let emulators = crate::models::default_emulators();
        
        emulators
            .into_iter()
            .filter(|e| {
                e.supported_platforms.contains(&platform_id.to_string())
                    || e.supported_platforms.contains(&"*".to_string())
            })
            .map(|mut e| {
                e.executable_path = self.get_emulator_path(&e.id);
                e.is_installed = e.executable_path.as_ref().map(|p| p.exists()).unwrap_or(false);
                e
            })
            .collect()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LaunchResult {
    Success {
        duration_minutes: i32,
        exit_code: Option<i32>,
        command: Option<LaunchCommand>,
    },
    DryRun {
        command: LaunchCommand,
    },
    FileNotFound(String),
    EmulatorNotInstalled {
        name: String,
        id: String,
    },
    EmulatorNotConfigured {
        platform: String,
    },
}

impl LaunchResult {
    pub fn is_success(&self) -> bool {
        matches!(self, LaunchResult::Success { .. } | LaunchResult::DryRun { .. })
    }

    pub fn command(&self) -> Option<&LaunchCommand> {
        match self {
            LaunchResult::Success { command, .. } => command.as_ref(),
            LaunchResult::DryRun { command } => Some(command),
            _ => None,
        }
    }

    pub fn error_message(&self) -> Option<String> {
        match self {
            LaunchResult::Success { .. } => None,
            LaunchResult::DryRun { .. } => None,
            LaunchResult::FileNotFound(path) => Some(format!("ROM file not found: {}", path)),
            LaunchResult::EmulatorNotInstalled { name, .. } => {
                Some(format!("{} is not installed", name))
            }
            LaunchResult::EmulatorNotConfigured { platform } => {
                Some(format!("No emulator configured for {}", platform))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    };

    fn test_launcher() -> EmulatorLauncher {
        let mut config = AppConfig::default();
        config.emulators.mgba = Some(std::env::current_exe().unwrap());
        config
            .emulators
            .platform_defaults
            .insert("gba".to_string(), "mgba".to_string());
        EmulatorLauncher::new(config, Database::open_in_memory().unwrap())
    }

    #[test]
    fn resolve_rom_path_uses_local_game_file_path() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("local.gba");
        fs::write(&path, b"rom").unwrap();

        let game = Game::new(
            "Local Game".to_string(),
            path.to_string_lossy().into_owned(),
            "gba".to_string(),
        );
        assert_eq!(
            EmulatorLauncher::resolve_rom_path(&game).unwrap(),
            path.to_string_lossy().to_string()
        );
    }

    #[test]
    fn resolve_rom_path_uses_cached_romm_file_without_remote_path() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("cached.gba");
        fs::write(&path, b"rom").unwrap();

        let mut game = Game::new(
            "Cached Game".to_string(),
            "https://romm.example/api/roms/7/content/cached.gba".to_string(),
            "gba".to_string(),
        );
        game.source = GameSource::RomM;
        game.local_file_path = Some(path.to_string_lossy().into_owned());

        assert_eq!(
            EmulatorLauncher::resolve_rom_path(&game).unwrap(),
            path.to_string_lossy().to_string()
        );
    }

    #[test]
    fn resolve_rom_path_rejects_missing_romm_file() {
        let mut game = Game::new(
            "Missing Game".to_string(),
            "https://romm.example/api/roms/7/content/missing.gba".to_string(),
            "gba".to_string(),
        );
        game.source = GameSource::RomM;
        game.local_file_path = Some("missing.gba".to_string());

        let error = EmulatorLauncher::resolve_rom_path(&game).unwrap_err().to_string();
        assert!(error.contains("Missing Game"));
        assert!(error.contains("missing.gba"));
    }

    #[tokio::test]
    async fn launch_local_game_spawns_and_waits_for_test_binary() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("local.gba");
        fs::write(&path, b"rom").unwrap();
        let game = Game::new(
            "Local Game".to_string(),
            path.to_string_lossy().into_owned(),
            "gba".to_string(),
        );
        let running = Arc::new(AtomicBool::new(false));
        let callback_running = Arc::clone(&running);

        let result = test_launcher()
            .launch_with_running_stage(&game, move || {
                callback_running.store(true, Ordering::SeqCst);
            })
            .await
            .unwrap();

        assert!(matches!(result, LaunchResult::Success { .. }));
        assert!(running.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn launch_cached_romm_game_spawns_from_local_cache() {
        let dir = tempfile::tempdir().unwrap();
        let cache_path = dir.path().join("cached.gba");
        fs::write(&cache_path, b"rom").unwrap();
        let mut game = Game::new(
            "Cached Game".to_string(),
            "https://romm.example/api/roms/7/content/cached.gba".to_string(),
            "gba".to_string(),
        );
        game.source = GameSource::RomM;
        game.local_file_path = Some(cache_path.to_string_lossy().into_owned());
        let running = Arc::new(AtomicBool::new(false));
        let callback_running = Arc::clone(&running);

        let result = test_launcher()
            .launch_with_running_stage(&game, move || {
                callback_running.store(true, Ordering::SeqCst);
            })
            .await
            .unwrap();

        assert!(matches!(result, LaunchResult::Success { .. }));
        assert!(running.load(Ordering::SeqCst));
    }
}
