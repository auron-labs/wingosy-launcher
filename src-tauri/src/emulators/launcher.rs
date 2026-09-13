use anyhow::{bail, Context, Result};
use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;
use std::process::Command;
use std::time::Instant;

use crate::config::AppConfig;
use crate::database::Database;
use crate::emulators::cores::resolve_core_path;
use crate::models::{retroarch_cores, Emulator, Game, GameSource};

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

impl LaunchCommand {
    pub(crate) fn append_argument(&mut self, argument: impl Into<String>) {
        self.args.push(argument.into());
        self.full_command = format_full_command(&self.executable, &self.args);
    }
}

fn format_full_command(executable: &str, args: &[String]) -> String {
    format!(
        "\"{}\" {}",
        executable,
        args.iter()
            .map(|arg| {
                if arg.contains(' ') {
                    format!("\"{}\"", arg)
                } else {
                    arg.clone()
                }
            })
            .collect::<Vec<_>>()
            .join(" ")
    )
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
        bail!(
            "ROM file for '{}' was not found locally (checked {})",
            game.name,
            checked
        )
    }

    pub fn build_command(&self, game: &Game) -> Result<LaunchCommand> {
        let emulator = self.resolve_emulator(game)?;
        self.build_command_with_emulator(game, emulator)
    }

    fn build_command_with_emulator(
        &self,
        game: &Game,
        mut emulator: Emulator,
    ) -> Result<LaunchCommand> {
        let managed_install_validated = if emulator.is_retroarch {
            let configured_executable = emulator
                .executable_path
                .as_ref()
                .context("RetroArch executable is not configured")?;
            let executable = if configured_executable.is_absolute() {
                configured_executable.clone()
            } else {
                std::env::current_dir()
                    .context("Failed to determine the working directory")?
                    .join(configured_executable)
            };
            emulator.executable_path = Some(executable.clone());
            if self.config.emulators.retroarch_install_kind
                == crate::config::RetroArchInstallKind::Managed
            {
                emulator.core_name = Some(
                    crate::emulators::retroarch::managed_core_path(
                        &self.config,
                        &executable,
                        &game.platform_id,
                        crate::emulators::retroarch::certified_managed_core_manifest(),
                    )?
                    .to_string_lossy()
                    .into_owned(),
                );
                true
            } else {
                false
            }
        } else {
            false
        };

        self.build_command_after_validation(game, emulator, managed_install_validated)
    }

    fn build_command_after_validation(
        &self,
        game: &Game,
        mut emulator: Emulator,
        managed_install_validated: bool,
    ) -> Result<LaunchCommand> {
        let rom_path = match game.local_file_path.as_deref() {
            Some(path) if Path::new(path).is_file() => path,
            _ if Path::new(&game.file_path).is_file() => game.file_path.as_str(),
            _ => game
                .local_file_path
                .as_deref()
                .unwrap_or(game.file_path.as_str()),
        };

        if emulator.is_retroarch {
            let executable = emulator
                .executable_path
                .as_ref()
                .context("RetroArch executable is not configured")?;
            let use_beta_profile = managed_install_validated
                || crate::emulators::retroarch::managed_profile_enabled(&self.config, executable)
                || (self.config.emulators.retroarch_install_kind
                    == crate::config::RetroArchInstallKind::External
                    && self.config.emulators.retroarch_use_beta_profile);
            if use_beta_profile {
                let profile = if managed_install_validated {
                    crate::emulators::retroarch::ensure_managed_profile(executable)
                } else {
                    crate::emulators::retroarch::ensure_profile()
                }
                .context("Failed to prepare Wingosy RetroArch profile")?;
                emulator
                    .launch_args
                    .push(format!("--appendconfig={}", profile.to_string_lossy()));
            }
            if !managed_install_validated {
                let core_name = emulator
                    .core_name
                    .as_deref()
                    .context("No RetroArch core is configured")?;
                emulator.core_name = Some(
                    resolve_core_path(executable, core_name)?
                        .to_string_lossy()
                        .into_owned(),
                );
            } else {
                emulator.core_name = Some(
                    crate::emulators::retroarch::promised_core_path(executable, &game.platform_id)?
                        .to_string_lossy()
                        .into_owned(),
                );
            }
        }

        let (exe_path, args) = emulator
            .build_launch_command(rom_path)
            .context("Failed to build launch command")?;

        let exe_str = exe_path.to_string_lossy().to_string();
        let full_command = format_full_command(&exe_str, &args);

        Ok(LaunchCommand {
            executable: exe_str,
            args: args.clone(),
            full_command,
            emulator_id: emulator.id.clone(),
            emulator_name: emulator.name.clone(),
            core_name: emulator.core_name.clone(),
            game_name: game.name.clone(),
            rom_path: rom_path.to_string(),
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
        if emulator.executable_path.is_none() {
            return Ok(LaunchResult::EmulatorNotInstalled {
                name: emulator.name,
                id: emulator.id,
            });
        }

        let command = self.build_command_with_emulator(game, emulator)?;
        self.launch_command_with_running_stage(game, command, on_running)
            .await
    }

    pub(crate) async fn launch_command_with_running_stage<F>(
        &self,
        game: &Game,
        command: LaunchCommand,
        on_running: F,
    ) -> Result<LaunchResult>
    where
        F: FnOnce() + Send + 'static,
    {
        self.launch_command_with_lifecycle(game, command, on_running, || {})
            .await
    }

    pub(crate) async fn launch_command_with_lifecycle<F, G>(
        &self,
        game: &Game,
        command: LaunchCommand,
        on_running: F,
        on_complete: G,
    ) -> Result<LaunchResult>
    where
        F: FnOnce() + Send + 'static,
        G: FnOnce() + Send + 'static,
    {
        let rom_path = &command.rom_path;

        if !Path::new(rom_path).is_file() {
            on_complete();
            return Ok(LaunchResult::FileNotFound(rom_path.to_string()));
        }

        let exe_path = Path::new(&command.executable);

        if !exe_path.is_file() {
            on_complete();
            return Ok(LaunchResult::EmulatorNotInstalled {
                name: command.emulator_name.clone(),
                id: command.emulator_id.clone(),
            });
        }

        if command.emulator_id == "retroarch" {
            if let Some(core_path) = command.core_name.as_deref() {
                if !Path::new(core_path).is_file() {
                    let core_name = Path::new(core_path)
                        .file_name()
                        .and_then(|name| name.to_str())
                        .unwrap_or(core_path)
                        .to_string();
                    on_complete();
                    return Ok(LaunchResult::CoreNotInstalled {
                        name: core_name,
                        path: core_path.to_string(),
                    });
                }
            }
        }

        tracing::info!(
            "[Launch] {} via {} | platform={} | rom={}",
            game.name,
            command.emulator_name,
            game.platform_id,
            rom_path
        );

        self.log_launch_to_file(&command);

        let start_time = Instant::now();

        tracing::info!("[Launch] Spawning command: {}", command.full_command);
        let mut child = match Command::new(exe_path).args(&command.args).spawn() {
            Ok(child) => child,
            Err(error) => {
                tracing::error!(
                    "[Launch] Failed to start emulator: game_id={} game={} emulator_id={} emulator={} executable={} reason={}",
                    game.id,
                    game.name,
                    command.emulator_id,
                    command.emulator_name,
                    command.executable,
                    error
                );
                on_complete();
                return Ok(LaunchResult::EmulatorStartFailed {
                    name: command.emulator_name.clone(),
                    id: command.emulator_id.clone(),
                    reason: error.to_string(),
                });
            }
        };

        on_running();
        let status = match child.wait() {
            Ok(status) => status,
            Err(error) => {
                on_complete();
                return Err(error).context("Failed to wait for emulator");
            }
        };
        on_complete();

        if !status.success() {
            tracing::error!(
                "[Launch] Emulator exited unsuccessfully: game_id={} game={} emulator_id={} emulator={} executable={} exit_code={:?} status={:?}",
                game.id,
                game.name,
                command.emulator_id,
                command.emulator_name,
                command.executable,
                status.code(),
                status
            );
            return Ok(LaunchResult::EmulatorExitedUnsuccessfully {
                name: command.emulator_name.clone(),
                id: command.emulator_id.clone(),
                exit_code: status.code(),
                command,
            });
        }

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

            match OpenOptions::new().create(true).append(true).open(&log_file) {
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
                if emu.is_retroarch && emu.core_name.is_none() {
                    emu.core_name = retroarch_cores()
                        .get(&game.platform_id)
                        .map(|core| core.to_string());
                }
                return Ok(emu);
            }
        }

        // 2. Check platform default emulator from config
        if let Some(default_emu_id) = self
            .config
            .emulators
            .platform_defaults
            .get(&game.platform_id)
        {
            let emulators = crate::models::default_emulators();

            if let Some(mut emu) = emulators.into_iter().find(|e| &e.id == default_emu_id) {
                emu.executable_path = self.get_emulator_path(&emu.id);

                if emu.is_retroarch {
                    if let Some(core) = retroarch_cores().get(&game.platform_id) {
                        emu.core_name = Some(core.to_string());
                    }
                }

                if emu.executable_path.is_some() {
                    tracing::info!(
                        "[Launch] Using platform default emulator: {} for {}",
                        emu.name,
                        game.platform_id
                    );
                }
                return Ok(emu);
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

        bail!("No emulator configured for platform: {}", game.platform_id)
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
                e.is_installed = e
                    .executable_path
                    .as_ref()
                    .map(|p| p.is_file())
                    .unwrap_or(false);
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
    EmulatorStartFailed {
        name: String,
        id: String,
        reason: String,
    },
    EmulatorExitedUnsuccessfully {
        name: String,
        id: String,
        exit_code: Option<i32>,
        command: LaunchCommand,
    },
    EmulatorNotConfigured {
        platform: String,
    },
    CoreNotInstalled {
        name: String,
        path: String,
    },
}

impl LaunchResult {
    pub fn is_success(&self) -> bool {
        matches!(
            self,
            LaunchResult::Success { .. } | LaunchResult::DryRun { .. }
        )
    }

    pub fn command(&self) -> Option<&LaunchCommand> {
        match self {
            LaunchResult::Success { command, .. } => command.as_ref(),
            LaunchResult::DryRun { command } => Some(command),
            LaunchResult::EmulatorExitedUnsuccessfully { command, .. } => Some(command),
            _ => None,
        }
    }

    pub fn error_message(&self) -> Option<String> {
        match self {
            LaunchResult::Success { .. } => None,
            LaunchResult::DryRun { .. } => None,
            LaunchResult::FileNotFound(path) => Some(format!("ROM file not found: {}", path)),
            LaunchResult::EmulatorNotInstalled { name, .. } => {
                Some(format!(
                    "{} executable is unavailable at its configured path. Install {} or choose a valid executable path in Settings.",
                    name, name
                ))
            }
            LaunchResult::EmulatorStartFailed { name, reason, .. } => Some(format!(
                "Failed to start {}. Verify its configured executable is a valid {} executable and try again. Details: {}",
                name, name, reason
            )),
            LaunchResult::EmulatorExitedUnsuccessfully {
                name,
                id,
                exit_code,
                command,
            } => {
                let termination = match exit_code {
                    Some(code) => format!("exit code {code}"),
                    None => "signal termination".to_string(),
                };
                Some(format!(
                    "{} ({}) exited unsuccessfully with {} while launching {}. Check the emulator executable and ROM, then try again.",
                    name, id, termination, command.executable
                ))
            }
            LaunchResult::EmulatorNotConfigured { platform } => {
                Some(format!("No emulator configured for {}", platform))
            }
            LaunchResult::CoreNotInstalled { name, path } => Some(format!(
                "RetroArch core {} was not found at {}. Install the core and try again.",
                name, path
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    };
    use std::time::Duration;

    static PROFILE_TEST_LOCK: Mutex<()> = Mutex::new(());

    fn test_launcher() -> EmulatorLauncher {
        let mut config = AppConfig::default();
        config.emulators.mgba = Some(std::env::current_exe().unwrap());
        config
            .emulators
            .platform_defaults
            .insert("gba".to_string(), "mgba".to_string());
        EmulatorLauncher::new(config, Database::open_in_memory().unwrap())
    }

    #[cfg(unix)]
    fn process_test_executable(dir: &tempfile::TempDir, exit_code: i32) -> std::path::PathBuf {
        use std::os::unix::fs::PermissionsExt;

        let path = dir.path().join(format!("exit-{exit_code}.sh"));
        fs::write(&path, format!("#!/bin/sh\nexit {exit_code}\n")).unwrap();
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&path, permissions).unwrap();
        path
    }

    #[cfg(windows)]
    fn process_test_executable(dir: &tempfile::TempDir, exit_code: i32) -> std::path::PathBuf {
        let path = dir.path().join(format!("exit-{exit_code}.cmd"));
        fs::write(&path, format!("@exit /b {exit_code}\r\n")).unwrap();
        path
    }

    fn process_test_launcher(dir: &tempfile::TempDir, exit_code: i32) -> EmulatorLauncher {
        let executable = process_test_executable(dir, exit_code);
        process_test_launcher_with_executable(executable)
    }

    fn process_test_launcher_with_executable(executable: std::path::PathBuf) -> EmulatorLauncher {
        let mut config = AppConfig::default();
        let emulator_id = "melonds";
        config.emulators.melonds = Some(executable);
        config
            .emulators
            .platform_defaults
            .insert("gba".to_string(), emulator_id.to_string());
        EmulatorLauncher::new(config, Database::open_in_memory().unwrap())
    }

    #[cfg(unix)]
    fn lifecycle_test_executable(
        dir: &tempfile::TempDir,
        exit_code: i32,
    ) -> (std::path::PathBuf, std::path::PathBuf) {
        use std::os::unix::fs::PermissionsExt;

        let executable = dir.path().join(format!("lifecycle-{exit_code}.sh"));
        let marker = dir.path().join(format!("lifecycle-{exit_code}.running"));
        fs::write(
            &executable,
            format!("#!/bin/sh\ntouch \"$1\"\nsleep 0.2\nrm -f \"$1\"\nexit {exit_code}\n"),
        )
        .unwrap();
        let mut permissions = fs::metadata(&executable).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&executable, permissions).unwrap();
        (executable, marker)
    }

    #[cfg(windows)]
    fn lifecycle_test_executable(
        dir: &tempfile::TempDir,
        exit_code: i32,
    ) -> (std::path::PathBuf, std::path::PathBuf) {
        let executable = dir.path().join(format!("lifecycle-{exit_code}.cmd"));
        let marker = dir.path().join(format!("lifecycle-{exit_code}.running"));
        fs::write(
            &executable,
            format!(
                "@echo off\r\ntype nul > \"%~1\"\r\nping -n 2 127.0.0.1 > nul\r\ndel \"%~1\"\r\nexit /b {exit_code}\r\n"
            ),
        )
        .unwrap();
        (executable, marker)
    }

    fn wait_for_lifecycle_marker(marker: &std::path::Path) {
        for _ in 0..200 {
            if marker.is_file() {
                return;
            }
            std::thread::sleep(Duration::from_millis(5));
        }
        panic!(
            "lifecycle test process did not create marker: {}",
            marker.display()
        );
    }

    fn persist_game_for_override(db: &Database, game: &mut Game) {
        db.insert_platform(&crate::models::Platform::new(
            game.platform_id.clone(),
            game.platform_id.clone(),
            vec![],
        ))
        .unwrap();
        let id = db.insert_game(game).unwrap();
        game.id = id;
    }

    #[test]
    fn build_retroarch_nes_command_uses_external_install_absolute_core_fullscreen_and_safe_rom_arg()
    {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("retroarch.exe");
        let core = dir.path().join("cores").join("fceumm_libretro.dll");
        let rom = dir.path().join("Super Mario Bros 世界.nes");
        fs::create_dir_all(core.parent().unwrap()).unwrap();
        fs::write(&executable, b"retroarch").unwrap();
        fs::write(&core, b"core").unwrap();
        fs::write(&rom, b"rom").unwrap();

        let mut config = AppConfig::default();
        config.emulators.retroarch = Some(executable.clone());
        config
            .emulators
            .platform_defaults
            .insert("nes".to_string(), "retroarch".to_string());
        let launcher = EmulatorLauncher::new(config, Database::open_in_memory().unwrap());
        let game = Game::new(
            "Super Mario Bros".to_string(),
            rom.to_string_lossy().into_owned(),
            "nes".to_string(),
        );

        let command = launcher.build_command(&game).unwrap();

        assert_eq!(
            command.executable,
            executable.to_string_lossy().into_owned()
        );
        assert_eq!(
            command.args,
            vec![
                "--fullscreen".to_string(),
                "-L".to_string(),
                core.to_string_lossy().into_owned(),
                rom.to_string_lossy().into_owned(),
            ]
        );
        assert_eq!(command.core_name.as_deref(), core.to_str());
        assert!(command.full_command.contains("--fullscreen"));
    }

    #[test]
    fn opted_in_external_retroarch_appends_wingosy_profile() {
        let _profile_lock = PROFILE_TEST_LOCK.lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("retroarch.exe");
        let core = dir.path().join("cores").join("fceumm_libretro.dll");
        let rom = dir.path().join("game.nes");
        fs::create_dir_all(core.parent().unwrap()).unwrap();
        fs::write(&executable, b"retroarch").unwrap();
        fs::write(&core, b"core").unwrap();
        fs::write(&rom, b"rom").unwrap();

        let mut config = AppConfig::default();
        config.emulators.retroarch = Some(executable);
        config.emulators.retroarch_use_beta_profile = true;
        config
            .emulators
            .platform_defaults
            .insert("nes".to_string(), "retroarch".to_string());
        let launcher = EmulatorLauncher::new(config, Database::open_in_memory().unwrap());
        let game = Game::new(
            "NES Game".to_string(),
            rom.to_string_lossy().into_owned(),
            "nes".to_string(),
        );

        let command = launcher.build_command(&game).unwrap();
        let profile = crate::emulators::retroarch::delta_path().unwrap();
        assert_eq!(
            command.args,
            vec![
                "--fullscreen".to_string(),
                format!("--appendconfig={}", profile.to_string_lossy()),
                "-L".to_string(),
                core.to_string_lossy().into_owned(),
                rom.to_string_lossy().into_owned(),
            ]
        );
    }

    #[test]
    fn build_retroarch_mapped_platforms_use_external_layout_and_platform_defaults() {
        let cases = [
            ("snes", "snes9x_libretro.dll", "Super Metroid 世界.sfc"),
            (
                "genesis",
                "genesis_plus_gx_libretro.dll",
                "Sonic the Hedgehog 世界.md",
            ),
            ("gb", "gambatte_libretro.dll", "Pokemon Red 世界.gb"),
            ("gbc", "gambatte_libretro.dll", "Zelda DX 世界.gbc"),
            ("gba", "mgba_libretro.dll", "Metroid Fusion 世界.gba"),
        ];

        for (platform, core_name, rom_name) in cases {
            let dir = tempfile::tempdir().unwrap();
            let executable = dir.path().join("retroarch.exe");
            let core = dir.path().join("cores").join(core_name);
            let rom = dir.path().join(rom_name);
            fs::create_dir_all(core.parent().unwrap()).unwrap();
            fs::write(&executable, b"retroarch").unwrap();
            fs::write(&core, b"core").unwrap();
            fs::write(&rom, b"rom").unwrap();

            let mut config = AppConfig::default();
            config.emulators.retroarch = Some(executable.clone());
            config
                .emulators
                .platform_defaults
                .insert(platform.to_string(), "retroarch".to_string());
            let launcher = EmulatorLauncher::new(config, Database::open_in_memory().unwrap());
            let game = Game::new(
                format!("{platform} game"),
                rom.to_string_lossy().into_owned(),
                platform.to_string(),
            );

            let command = launcher.build_command(&game).unwrap();
            let executable = executable.to_string_lossy().into_owned();
            let core = core.to_string_lossy().into_owned();
            let rom = rom.to_string_lossy().into_owned();

            assert_eq!(command.executable, executable);
            assert_eq!(command.emulator_id, "retroarch");
            assert_eq!(command.core_name.as_deref(), Some(core.as_str()));
            assert!(Path::new(&core).is_absolute());
            assert_eq!(
                command.args,
                vec!["--fullscreen".to_string(), "-L".to_string(), core, rom]
            );
        }
    }

    #[test]
    fn build_retroarch_command_normalizes_relative_external_install() {
        let dir = tempfile::tempdir_in(".").unwrap();
        let executable = dir.path().join("retroarch.exe");
        let core = dir.path().join("cores").join("fceumm_libretro.dll");
        let rom = dir.path().join("game.nes");
        fs::create_dir_all(core.parent().unwrap()).unwrap();
        fs::write(&executable, b"retroarch").unwrap();
        fs::write(&core, b"core").unwrap();
        fs::write(&rom, b"rom").unwrap();

        let mut config = AppConfig::default();
        config.emulators.retroarch = Some(executable.clone());
        config
            .emulators
            .platform_defaults
            .insert("nes".to_string(), "retroarch".to_string());
        let launcher = EmulatorLauncher::new(config, Database::open_in_memory().unwrap());
        let game = Game::new(
            "NES Game".to_string(),
            rom.to_string_lossy().into_owned(),
            "nes".to_string(),
        );

        let command = launcher.build_command(&game).unwrap();
        let expected_executable = std::env::current_dir().unwrap().join(&executable);
        let expected_core = expected_executable
            .parent()
            .unwrap()
            .join("cores")
            .join("fceumm_libretro.dll");

        assert_eq!(
            command.executable,
            expected_executable.to_string_lossy().into_owned()
        );
        assert_eq!(command.core_name.as_deref(), expected_core.to_str());
    }

    #[test]
    fn build_command_prefers_valid_file_path_over_stale_local_path() {
        let dir = tempfile::tempdir().unwrap();
        let valid_rom = dir.path().join("Super Mario Bros 世界.gba");
        let stale_path = dir.path().join("stale.gba");
        fs::write(&valid_rom, b"rom").unwrap();

        let mut game = Game::new(
            "Super Mario Bros".to_string(),
            valid_rom.to_string_lossy().into_owned(),
            "gba".to_string(),
        );
        game.local_file_path = Some(stale_path.to_string_lossy().into_owned());

        let command = test_launcher().build_command(&game).unwrap();

        assert_eq!(command.rom_path, valid_rom.to_string_lossy().into_owned());
        assert_eq!(command.args.last().map(String::as_str), valid_rom.to_str());
    }

    #[test]
    fn build_mgba_game_boy_family_commands_use_selected_install_and_fullscreen() {
        let cases = [
            ("gb", "Pokemon Red 世界.gb", false),
            ("gbc", "Zelda DX 世界.gbc", false),
            ("gba", "Metroid Fusion 世界.gba", false),
            ("gb", "Pokemon Blue 世界.gb", true),
            ("gbc", "Oracle of Ages 世界.gbc", true),
            ("gba", "Advance Wars 世界.gba", true),
        ];

        for (platform, rom_name, per_game) in cases {
            let dir = tempfile::tempdir().unwrap();
            let executable = if per_game {
                dir.path().join("emulators").join("mgba").join("mGBA.exe")
            } else {
                dir.path().join("external mGBA").join("mGBA.exe")
            };
            let rom = dir.path().join(rom_name);
            fs::create_dir_all(executable.parent().unwrap()).unwrap();
            fs::write(&executable, b"mgba").unwrap();
            fs::write(&rom, b"rom").unwrap();

            let mut config = AppConfig::default();
            config.emulators.mgba = Some(executable.clone());
            let db = Database::open_in_memory().unwrap();
            let mut game = Game::new(
                format!("{platform} game"),
                rom.to_string_lossy().into_owned(),
                platform.to_string(),
            );
            if per_game {
                let retroarch = dir.path().join("retroarch.exe");
                fs::write(&retroarch, b"retroarch").unwrap();
                config.emulators.retroarch = Some(retroarch);
                config
                    .emulators
                    .platform_defaults
                    .insert(platform.to_string(), "retroarch".to_string());
                persist_game_for_override(&db, &mut game);
                db.set_emulator_for_game(game.id, "mgba", None).unwrap();
            } else {
                config
                    .emulators
                    .platform_defaults
                    .insert(platform.to_string(), "mgba".to_string());
            }

            let command = EmulatorLauncher::new(config, db)
                .build_command(&game)
                .unwrap();

            assert_eq!(command.emulator_id, "mgba");
            assert_eq!(
                command.executable,
                executable.to_string_lossy().into_owned()
            );
            assert_eq!(
                command.args,
                vec!["-f".to_string(), rom.to_string_lossy().into_owned()]
            );
            assert_eq!(command.rom_path, rom.to_string_lossy().into_owned());
        }
    }

    #[test]
    fn build_mgba_preserves_windows_style_rom_path_as_one_argument() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("mGBA.exe");
        fs::write(&executable, b"mgba").unwrap();

        let mut config = AppConfig::default();
        config.emulators.mgba = Some(executable);
        config
            .emulators
            .platform_defaults
            .insert("gbc".to_string(), "mgba".to_string());
        let rom_path = r"C:\Games\Pokemon Blue 世界.gbc".to_string();
        let game = Game::new(
            "Pokemon Blue".to_string(),
            rom_path.clone(),
            "gbc".to_string(),
        );

        let command = EmulatorLauncher::new(config, Database::open_in_memory().unwrap())
            .build_command(&game)
            .unwrap();

        assert_eq!(command.rom_path, rom_path);
        assert_eq!(
            command.args,
            vec!["-f".to_string(), command.rom_path.clone()]
        );
    }

    #[test]
    fn build_managed_retroarch_rejects_modified_artifacts_before_profile_generation() {
        let _profile_lock = PROFILE_TEST_LOCK.lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        let executable = dir
            .path()
            .join("emulators")
            .join("retroarch")
            .join("RetroArch")
            .join("retroarch.exe");
        let core = executable
            .parent()
            .unwrap()
            .join("cores")
            .join("fceumm_libretro.dll");
        let rom = dir.path().join("game.nes");
        fs::create_dir_all(core.parent().unwrap()).unwrap();
        fs::create_dir_all(executable.parent().unwrap()).unwrap();
        fs::write(&executable, b"retroarch").unwrap();
        crate::emulators::retroarch::write_manifest_marker(&executable).unwrap();
        for filename in crate::emulators::retroarch::certified_core_filenames() {
            fs::write(core.parent().unwrap().join(filename), b"core").unwrap();
        }
        fs::write(&rom, b"rom").unwrap();

        let mut config = AppConfig::default();
        config.emulators.retroarch = Some(executable.clone());
        config.emulators.retroarch_install_kind = crate::config::RetroArchInstallKind::Managed;
        config.emulators.retroarch_manifest_version =
            Some(crate::emulators::retroarch::MANIFEST_VERSION.to_string());
        let db = Database::open_in_memory().unwrap();
        let mut game = Game::new(
            "NES Game".to_string(),
            rom.to_string_lossy().into_owned(),
            "nes".to_string(),
        );
        persist_game_for_override(&db, &mut game);
        db.set_emulator_for_game(game.id, "retroarch", None)
            .unwrap();

        let profile = crate::emulators::retroarch::delta_path().unwrap();
        let profile_before = fs::read(&profile).ok();
        let error = EmulatorLauncher::new(config, db)
            .build_command(&game)
            .unwrap_err();

        assert!(error.to_string().contains("could not be verified"));
        assert_eq!(fs::read(&profile).ok(), profile_before);
    }

    #[test]
    fn build_managed_retroarch_resolves_promised_core_and_appends_profile() {
        let _profile_lock = PROFILE_TEST_LOCK.lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("retroarch.exe");
        let core = dir.path().join("cores").join("fceumm_libretro.dll");
        let rom = dir.path().join("game.nes");
        fs::create_dir_all(core.parent().unwrap()).unwrap();
        fs::write(&executable, b"retroarch").unwrap();
        fs::write(&core, b"core").unwrap();
        fs::write(&rom, b"rom").unwrap();

        let mut config = AppConfig::default();
        config.emulators.retroarch = Some(executable.clone());
        config.emulators.retroarch_install_kind = crate::config::RetroArchInstallKind::Managed;
        config
            .emulators
            .platform_defaults
            .insert("nes".to_string(), "retroarch".to_string());
        let launcher = EmulatorLauncher::new(config, Database::open_in_memory().unwrap());
        let game = Game::new(
            "NES Game".to_string(),
            rom.to_string_lossy().into_owned(),
            "nes".to_string(),
        );
        let emulator = launcher.resolve_emulator(&game).unwrap();

        let command = launcher
            .build_command_after_validation(&game, emulator, true)
            .unwrap();
        let profile = crate::emulators::retroarch::managed_delta_path().unwrap();

        assert_eq!(
            command.args,
            vec![
                "--fullscreen".to_string(),
                format!("--appendconfig={}", profile.to_string_lossy()),
                "-L".to_string(),
                core.to_string_lossy().into_owned(),
                rom.to_string_lossy().into_owned(),
            ]
        );
    }

    #[test]
    fn build_retroarch_mapped_platforms_use_opted_in_external_profile() {
        let _profile_lock = PROFILE_TEST_LOCK.lock().unwrap();
        let cases = [
            ("snes", "snes9x_libretro.dll", "Chrono Trigger 世界.sfc"),
            (
                "genesis",
                "genesis_plus_gx_libretro.dll",
                "Streets of Rage 世界.md",
            ),
            ("gb", "gambatte_libretro.dll", "Pokemon Blue 世界.gb"),
            ("gbc", "gambatte_libretro.dll", "Oracle of Ages 世界.gbc"),
            ("gba", "mgba_libretro.dll", "Advance Wars 世界.gba"),
        ];

        for (platform, core_name, rom_name) in cases {
            let dir = tempfile::tempdir().unwrap();
            let executable = dir
                .path()
                .join("emulators")
                .join("retroarch")
                .join("RetroArch")
                .join("retroarch.exe");
            let core = executable.parent().unwrap().join("cores").join(core_name);
            let rom = dir.path().join(rom_name);
            fs::create_dir_all(core.parent().unwrap()).unwrap();
            fs::create_dir_all(executable.parent().unwrap()).unwrap();
            fs::write(&executable, b"retroarch").unwrap();
            crate::emulators::retroarch::write_manifest_marker(&executable).unwrap();
            for filename in crate::emulators::retroarch::certified_core_filenames() {
                fs::write(core.parent().unwrap().join(filename), b"core").unwrap();
            }
            fs::write(&rom, b"rom").unwrap();

            let mut config = AppConfig::default();
            config.emulators.retroarch = Some(executable.clone());
            config.emulators.retroarch_use_beta_profile = true;
            let db = Database::open_in_memory().unwrap();
            let mut game = Game::new(
                format!("{platform} game"),
                rom.to_string_lossy().into_owned(),
                platform.to_string(),
            );
            persist_game_for_override(&db, &mut game);
            db.set_emulator_for_game(game.id, "retroarch", None)
                .unwrap();

            let command = EmulatorLauncher::new(config, db)
                .build_command(&game)
                .unwrap();
            let core = core.to_string_lossy().into_owned();
            let rom = rom.to_string_lossy().into_owned();

            assert_eq!(command.emulator_id, "retroarch");
            assert_eq!(command.core_name.as_deref(), Some(core.as_str()));
            assert!(Path::new(&core).is_absolute());
            assert_eq!(
                command.args,
                vec![
                    "--fullscreen".to_string(),
                    format!(
                        "--appendconfig={}",
                        crate::emulators::retroarch::delta_path()
                            .unwrap()
                            .to_string_lossy()
                    ),
                    "-L".to_string(),
                    core,
                    rom,
                ]
            );
        }
    }

    #[tokio::test]
    async fn launch_revalidates_managed_artifacts_before_running() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("retroarch.exe");
        let core = executable
            .parent()
            .unwrap()
            .join("cores")
            .join("fceumm_libretro.dll");
        let rom = dir.path().join("game.nes");
        fs::create_dir_all(core.parent().unwrap()).unwrap();
        fs::write(&executable, b"modified executable").unwrap();
        fs::write(&core, b"modified core").unwrap();
        fs::write(&rom, b"rom").unwrap();
        crate::emulators::retroarch::write_manifest_marker(&executable).unwrap();
        for filename in crate::emulators::retroarch::certified_core_filenames() {
            fs::write(core.parent().unwrap().join(filename), b"modified core").unwrap();
        }

        let mut config = AppConfig::default();
        config.emulators.retroarch = Some(executable);
        config.emulators.retroarch_install_kind = crate::config::RetroArchInstallKind::Managed;
        config.emulators.retroarch_manifest_version =
            Some(crate::emulators::retroarch::MANIFEST_VERSION.to_string());
        config
            .emulators
            .platform_defaults
            .insert("nes".to_string(), "retroarch".to_string());
        let launcher = EmulatorLauncher::new(config, Database::open_in_memory().unwrap());
        let game = Game::new(
            "NES Game".to_string(),
            rom.to_string_lossy().into_owned(),
            "nes".to_string(),
        );
        let running = Arc::new(AtomicBool::new(false));
        let callback_running = Arc::clone(&running);

        let error = launcher
            .launch_with_running_stage(&game, move || {
                callback_running.store(true, Ordering::SeqCst);
            })
            .await
            .unwrap_err();

        assert!(error.to_string().contains("could not be verified"));
        assert!(!running.load(Ordering::SeqCst));
    }

    #[test]
    fn build_retroarch_core_selection_cannot_escape_cores_directory() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("retroarch.exe");
        let rom = dir.path().join("game.nes");
        fs::write(&executable, b"retroarch").unwrap();
        fs::write(&rom, b"rom").unwrap();

        let mut config = AppConfig::default();
        config.emulators.retroarch = Some(executable.clone());
        let db = Database::open_in_memory().unwrap();
        let mut game = Game::new(
            "NES Game".to_string(),
            rom.to_string_lossy().into_owned(),
            "nes".to_string(),
        );
        persist_game_for_override(&db, &mut game);
        db.set_emulator_for_game(game.id, "retroarch", Some("../../outside.dll"))
            .unwrap();

        let command = EmulatorLauncher::new(config, db)
            .build_command(&game)
            .unwrap();
        let expected = dir.path().join("cores").join("outside.dll");

        assert_eq!(command.core_name.as_deref(), expected.to_str());
    }

    #[tokio::test]
    async fn missing_retroarch_core_returns_without_running_callback() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("retroarch.exe");
        let rom = dir.path().join("game.nes");
        fs::write(&executable, b"retroarch").unwrap();
        fs::write(&rom, b"rom").unwrap();

        let mut config = AppConfig::default();
        config.emulators.retroarch = Some(executable.clone());
        config
            .emulators
            .platform_defaults
            .insert("nes".to_string(), "retroarch".to_string());
        let launcher = EmulatorLauncher::new(config, Database::open_in_memory().unwrap());
        let game = Game::new(
            "NES Game".to_string(),
            rom.to_string_lossy().into_owned(),
            "nes".to_string(),
        );
        let running = Arc::new(AtomicBool::new(false));
        let callback_running = Arc::clone(&running);

        let result = launcher
            .launch_with_running_stage(&game, move || {
                callback_running.store(true, Ordering::SeqCst);
            })
            .await
            .unwrap();

        assert!(matches!(&result, LaunchResult::CoreNotInstalled { .. }));
        assert!(!running.load(Ordering::SeqCst));
        assert!(result.error_message().unwrap().contains("Install the core"));
    }

    #[tokio::test]
    async fn missing_retroarch_mapped_platforms_return_structured_core_errors_before_running() {
        let cases = [
            ("snes", "snes9x_libretro.dll", "Super Metroid 世界.sfc"),
            (
                "genesis",
                "genesis_plus_gx_libretro.dll",
                "Sonic the Hedgehog 世界.md",
            ),
            ("gb", "gambatte_libretro.dll", "Pokemon Red 世界.gb"),
            ("gbc", "gambatte_libretro.dll", "Zelda DX 世界.gbc"),
            ("gba", "mgba_libretro.dll", "Metroid Fusion 世界.gba"),
        ];

        for (platform, core_name, rom_name) in cases {
            let dir = tempfile::tempdir().unwrap();
            let executable = dir.path().join("retroarch.exe");
            let expected_core = dir.path().join("cores").join(core_name);
            let rom = dir.path().join(rom_name);
            fs::write(&executable, b"retroarch").unwrap();
            fs::write(&rom, b"rom").unwrap();
            let expected_core = expected_core.to_string_lossy().into_owned();

            let mut config = AppConfig::default();
            config.emulators.retroarch = Some(executable);
            config
                .emulators
                .platform_defaults
                .insert(platform.to_string(), "retroarch".to_string());
            let launcher = EmulatorLauncher::new(config, Database::open_in_memory().unwrap());
            let game = Game::new(
                format!("{platform} game"),
                rom.to_string_lossy().into_owned(),
                platform.to_string(),
            );
            let running = Arc::new(AtomicBool::new(false));
            let callback_running = Arc::clone(&running);

            let result = launcher
                .launch_with_running_stage(&game, move || {
                    callback_running.store(true, Ordering::SeqCst);
                })
                .await
                .unwrap();

            match &result {
                LaunchResult::CoreNotInstalled { name, path } => {
                    assert_eq!(name, core_name);
                    assert_eq!(path, &expected_core);
                }
                other => panic!("expected missing core, got {other:?}"),
            }
            assert!(result.command().is_none());
            assert!(!running.load(Ordering::SeqCst));
            assert!(result.error_message().unwrap().contains("Install the core"));
        }
    }

    #[tokio::test]
    async fn non_file_retroarch_executable_returns_without_running_callback() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("retroarch");
        let core = dir.path().join("cores").join("fceumm_libretro.dll");
        let rom = dir.path().join("game.nes");
        fs::create_dir_all(&executable).unwrap();
        fs::create_dir_all(core.parent().unwrap()).unwrap();
        fs::write(&core, b"core").unwrap();
        fs::write(&rom, b"rom").unwrap();

        let mut config = AppConfig::default();
        config.emulators.retroarch = Some(executable);
        config
            .emulators
            .platform_defaults
            .insert("nes".to_string(), "retroarch".to_string());
        let launcher = EmulatorLauncher::new(config, Database::open_in_memory().unwrap());
        let game = Game::new(
            "NES Game".to_string(),
            rom.to_string_lossy().into_owned(),
            "nes".to_string(),
        );
        let running = Arc::new(AtomicBool::new(false));
        let callback_running = Arc::clone(&running);

        let result = launcher
            .launch_with_running_stage(&game, move || {
                callback_running.store(true, Ordering::SeqCst);
            })
            .await
            .unwrap();

        assert!(matches!(&result, LaunchResult::EmulatorNotInstalled { .. }));
        assert!(!running.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn non_file_mgba_executable_returns_actionable_error_before_running() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("mGBA");
        let rom = dir.path().join("Pokemon Red 世界.gb");
        fs::create_dir_all(&executable).unwrap();
        fs::write(&rom, b"rom").unwrap();

        let mut config = AppConfig::default();
        config.emulators.mgba = Some(executable);
        config
            .emulators
            .platform_defaults
            .insert("gb".to_string(), "mgba".to_string());
        let launcher = EmulatorLauncher::new(config, Database::open_in_memory().unwrap());
        let game = Game::new(
            "Pokemon Red".to_string(),
            rom.to_string_lossy().into_owned(),
            "gb".to_string(),
        );
        let running = Arc::new(AtomicBool::new(false));
        let callback_running = Arc::clone(&running);

        let result = launcher
            .launch_with_running_stage(&game, move || {
                callback_running.store(true, Ordering::SeqCst);
            })
            .await
            .unwrap();

        assert!(matches!(
            &result,
            LaunchResult::EmulatorNotInstalled { name, id }
                if name == "mGBA" && id == "mgba"
        ));
        assert!(!running.load(Ordering::SeqCst));
        assert!(result
            .error_message()
            .unwrap()
            .contains("unavailable at its configured path"));
    }

    #[tokio::test]
    async fn invalid_mgba_executable_returns_structured_start_failure_before_running() {
        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("mGBA.exe");
        let rom = dir.path().join("Pokemon Red 世界.gb");
        fs::write(&executable, b"not an executable").unwrap();
        fs::write(&rom, b"rom").unwrap();

        let mut config = AppConfig::default();
        config.emulators.mgba = Some(executable);
        config
            .emulators
            .platform_defaults
            .insert("gb".to_string(), "mgba".to_string());
        let launcher = EmulatorLauncher::new(config, Database::open_in_memory().unwrap());
        let game = Game::new(
            "Pokemon Red".to_string(),
            rom.to_string_lossy().into_owned(),
            "gb".to_string(),
        );
        let running = Arc::new(AtomicBool::new(false));
        let callback_running = Arc::clone(&running);

        let result = launcher
            .launch_with_running_stage(&game, move || {
                callback_running.store(true, Ordering::SeqCst);
            })
            .await
            .unwrap();

        assert!(matches!(
            &result,
            LaunchResult::EmulatorStartFailed { name, id, reason }
                if name == "mGBA" && id == "mgba" && !reason.is_empty()
        ));
        assert!(!running.load(Ordering::SeqCst));
        let error = result.error_message().unwrap();
        assert!(error.contains("valid mGBA executable"));
        assert!(error.contains("Details:"));
    }

    #[tokio::test]
    async fn explicitly_selected_emulator_without_executable_returns_before_running() {
        let dir = tempfile::tempdir().unwrap();
        let rom = dir.path().join("Pokemon Red 世界.gb");
        fs::write(&rom, b"rom").unwrap();

        let mut config = AppConfig::default();
        config.emulators.mgba = None;
        config
            .emulators
            .platform_defaults
            .insert("gb".to_string(), "mgba".to_string());
        let launcher = EmulatorLauncher::new(config, Database::open_in_memory().unwrap());
        let game = Game::new(
            "Pokemon Red".to_string(),
            rom.to_string_lossy().into_owned(),
            "gb".to_string(),
        );
        let running = Arc::new(AtomicBool::new(false));
        let callback_running = Arc::clone(&running);

        let result = launcher
            .launch_with_running_stage(&game, move || {
                callback_running.store(true, Ordering::SeqCst);
            })
            .await
            .unwrap();

        assert!(matches!(
            &result,
            LaunchResult::EmulatorNotInstalled { name, id }
                if name == "mGBA" && id == "mgba"
        ));
        assert!(!running.load(Ordering::SeqCst));
        assert!(result
            .error_message()
            .unwrap()
            .contains("unavailable at its configured path"));
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

        let error = EmulatorLauncher::resolve_rom_path(&game)
            .unwrap_err()
            .to_string();
        assert!(error.contains("Missing Game"));
        assert!(error.contains("missing.gba"));
    }

    #[tokio::test]
    async fn launch_local_game_spawns_and_waits_for_test_executable() {
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

        let result = process_test_launcher(&dir, 0)
            .launch_with_running_stage(&game, move || {
                callback_running.store(true, Ordering::SeqCst);
            })
            .await
            .unwrap();

        assert!(matches!(result, LaunchResult::Success { .. }));
        assert!(running.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn launch_process_exit_failure_returns_structured_failure() {
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

        let result = process_test_launcher(&dir, 7)
            .launch_with_running_stage(&game, move || {
                callback_running.store(true, Ordering::SeqCst);
            })
            .await
            .unwrap();

        match &result {
            LaunchResult::EmulatorExitedUnsuccessfully {
                id,
                exit_code,
                command,
                ..
            } => {
                assert_eq!(id, "melonds");
                assert_eq!(*exit_code, Some(7));
                assert_eq!(command.emulator_id, "melonds");
            }
            other => panic!("expected unsuccessful exit, got {other:?}"),
        }
        assert!(!result.is_success());
        assert!(running.load(Ordering::SeqCst));
        let error = result.error_message().unwrap();
        assert!(error.contains("exited unsuccessfully"));
        assert!(error.contains("exit code"));
    }

    #[tokio::test]
    async fn launch_lifecycle_completes_after_successful_and_failed_process_exit() {
        for exit_code in [0, 7] {
            let dir = tempfile::tempdir().unwrap();
            let path = dir.path().join("local.gba");
            fs::write(&path, b"rom").unwrap();
            let game = Game::new(
                "Local Game".to_string(),
                path.to_string_lossy().into_owned(),
                "gba".to_string(),
            );
            let (executable, marker) = lifecycle_test_executable(&dir, exit_code);
            let marker_argument = marker.to_string_lossy().into_owned();
            let events = Arc::new(Mutex::new(Vec::new()));
            let actions = Arc::new(Mutex::new(Vec::new()));
            let running_events = Arc::clone(&events);
            let complete_events = Arc::clone(&events);
            let running_actions = Arc::clone(&actions);
            let complete_actions = Arc::clone(&actions);
            let running_marker = marker.clone();
            let complete_marker = marker.clone();
            let launcher = process_test_launcher_with_executable(executable);
            let mut command = launcher.build_command(&game).unwrap();
            command.args = vec![marker_argument];

            let result = launcher
                .launch_command_with_lifecycle(
                    &game,
                    command,
                    move || {
                        wait_for_lifecycle_marker(&running_marker);
                        assert!(running_actions.lock().unwrap().is_empty());
                        running_events.lock().unwrap().push("running");
                    },
                    move || {
                        assert!(!complete_marker.exists());
                        complete_events.lock().unwrap().push("complete");
                        crate::commands::for_each_window_restoration_action(Some(true), |action| {
                            complete_actions.lock().unwrap().push(action)
                        });
                    },
                )
                .await
                .unwrap();

            assert_eq!(*events.lock().unwrap(), vec!["running", "complete"]);
            assert_eq!(
                *actions.lock().unwrap(),
                vec![
                    crate::commands::WindowRestorationAction::Show,
                    crate::commands::WindowRestorationAction::Unminimize,
                    crate::commands::WindowRestorationAction::Focus,
                    crate::commands::WindowRestorationAction::SetFullscreen(false),
                    crate::commands::WindowRestorationAction::SetFullscreen(true),
                    crate::commands::WindowRestorationAction::Focus,
                ]
            );
            assert_eq!(result.is_success(), exit_code == 0);
        }
    }

    #[tokio::test]
    async fn launch_lifecycle_completes_preflight_failure_without_running_process() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("local.gba");
        fs::write(&path, b"rom").unwrap();
        let game = Game::new(
            "Local Game".to_string(),
            path.to_string_lossy().into_owned(),
            "gba".to_string(),
        );
        let launcher = process_test_launcher(&dir, 0);
        let mut command = launcher.build_command(&game).unwrap();
        command.executable = dir
            .path()
            .join("missing-emulator")
            .to_string_lossy()
            .into_owned();
        let events = Arc::new(Mutex::new(Vec::new()));
        let actions = Arc::new(Mutex::new(Vec::new()));
        let running_events = Arc::clone(&events);
        let complete_events = Arc::clone(&events);
        let complete_actions = Arc::clone(&actions);

        let result = launcher
            .launch_command_with_lifecycle(
                &game,
                command,
                move || running_events.lock().unwrap().push("running"),
                move || {
                    complete_events.lock().unwrap().push("complete");
                    crate::commands::for_each_window_restoration_action(Some(true), |action| {
                        complete_actions.lock().unwrap().push(action)
                    });
                },
            )
            .await
            .unwrap();

        assert!(matches!(result, LaunchResult::EmulatorNotInstalled { .. }));
        assert_eq!(*events.lock().unwrap(), vec!["complete"]);
        assert_eq!(
            *actions.lock().unwrap(),
            vec![
                crate::commands::WindowRestorationAction::Show,
                crate::commands::WindowRestorationAction::Unminimize,
                crate::commands::WindowRestorationAction::Focus,
                crate::commands::WindowRestorationAction::SetFullscreen(false),
                crate::commands::WindowRestorationAction::SetFullscreen(true),
                crate::commands::WindowRestorationAction::Focus,
            ]
        );
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

        let result = process_test_launcher(&dir, 0)
            .launch_with_running_stage(&game, move || {
                callback_running.store(true, Ordering::SeqCst);
            })
            .await
            .unwrap();

        assert!(matches!(result, LaunchResult::Success { .. }));
        assert!(running.load(Ordering::SeqCst));
    }
}
