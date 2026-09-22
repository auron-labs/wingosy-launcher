#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
#![allow(dead_code)]

mod api;
mod bios;
mod commands;
mod config;
mod controller;
mod database;
mod emulators;
mod models;
mod romm_credentials;
mod scanner;
mod storage;
mod sync;

use crate::config::AppConfig;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

fn logging_directory() -> std::path::PathBuf {
    AppConfig::logs_dir().unwrap_or_else(|_| std::path::PathBuf::from("."))
}

fn setup_logging() -> Option<tracing_appender::non_blocking::WorkerGuard> {
    let log_dir = logging_directory();

    // Create log directory if it doesn't exist
    std::fs::create_dir_all(&log_dir).ok();

    // Set up a daily rolling file appender. Older files are retained until removed by the user.
    let file_appender = tracing_appender::rolling::daily(&log_dir, "wingosy.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    // Create file layer with more detailed output
    let file_layer = tracing_subscriber::fmt::layer()
        .with_writer(non_blocking)
        .with_ansi(false)
        .with_target(true)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true);

    // Console layer (only in debug builds or when RUST_LOG is set)
    let console_layer = tracing_subscriber::fmt::layer().with_target(false);

    // Set log level: debug for dev, info for release
    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        if cfg!(debug_assertions) {
            "wingosy_launcher=debug".into()
        } else {
            "wingosy_launcher=info".into()
        }
    });

    tracing_subscriber::registry()
        .with(env_filter)
        .with(file_layer)
        .with(console_layer)
        .init();

    tracing::info!("Log file: {:?}", log_dir.join("wingosy.log"));

    Some(guard)
}

fn main() {
    // Keep guard alive for entire app lifetime to ensure logs are flushed
    let _log_guard = setup_logging();

    tracing::info!("Starting Wingosy Launcher v{}", env!("CARGO_PKG_VERSION"));
    tracing::info!(
        "Build type: {}",
        if cfg!(debug_assertions) {
            "debug"
        } else {
            "release"
        }
    );

    let builder = tauri::Builder::default();

    #[cfg(debug_assertions)]
    let builder = builder.plugin(
        tauri_plugin_mcp_bridge::Builder::new()
            .bind_address("127.0.0.1")
            .build(),
    );

    builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::is_first_run,
            commands::complete_setup,
            commands::get_all_games,
            commands::get_games_filtered,
            commands::get_games_page,
            commands::get_all_platforms,
            commands::get_platforms_with_games,
            commands::get_recent_games,
            commands::get_favorite_games,
            commands::toggle_favorite,
            commands::launch_game,
            commands::prepare_and_launch_game,
            commands::get_native_controllers,
            commands::capture_native_controller,
            commands::get_launch_command,
            commands::scan_directory,
            commands::get_config,
            commands::save_config,
            commands::log_frontend,
            storage::get_storage_overview,
            storage::change_roms_directory,
            commands::list_ambient_audio_files,
            commands::connect_romm_with_token,
            commands::get_default_romm_device_name,
            commands::begin_romm_device_auth,
            commands::poll_romm_device_auth,
            commands::has_saved_romm_session,
            commands::check_romm_connection,
            commands::disconnect_romm,
            commands::restore_romm_session,
            commands::sync_romm_library,
            commands::list_romm_sync_platforms,
            commands::sync_romm_platform,
            commands::get_romm_retroachievements,
            commands::download_rom,
            commands::sync_switch_content,
            commands::get_switch_content_status,
            bios::get_bios_directory,
            bios::set_bios_directory,
            bios::list_bios_firmware,
            bios::download_bios_firmware,
            bios::download_all_bios_firmware,
            bios::distribute_bios_firmware,
            commands::get_game_saves,
            commands::get_switch_game_saves,
            commands::download_game_save,
            commands::upload_game_save,
            commands::get_switch_save_path_info,
            commands::get_switch_save_restore_protection,
            commands::upload_switch_save,
            commands::sync_current_switch_save,
            commands::download_switch_save,
            commands::resume_switch_save_normal_sync,
            commands::delete_local_rom,
            commands::toggle_game_hidden,
            commands::get_hidden_games,
            commands::unhide_game,
            commands::open_rom_location,
            commands::open_logs_folder,
            commands::refresh_game_metadata,
            commands::detect_emulators,
            commands::launch_emulator,
            commands::open_retroarch_input_setup,
            commands::set_retroarch_beta_profile,
            commands::reset_retroarch_controller_additions,
            commands::repair_retroarch_profile,
            commands::open_emulator_location,
            commands::get_game_details,
            commands::update_game_personal_fields,
            commands::get_collections,
            commands::add_game_to_collection,
            commands::search_games,
            commands::get_all_emulators,
            commands::download_emulator,
            commands::uninstall_emulator,
            commands::download_retroarch_core,
            commands::get_missing_cores,
            commands::get_platform_ids_with_installed_retroarch_core,
            commands::get_retroarch_default_core_dlls,
            commands::get_retroarch_core_inventory,
            commands::apply_detected_paths,
            commands::set_platform_default_emulator,
            commands::get_platform_default_emulators,
            commands::get_emulators_for_platform,
            commands::get_app_version,
            commands::check_for_app_update,
            commands::install_signed_app_update,
        ])
        .setup(|_app| {
            let db = database::Database::open().expect("Failed to open database");

            if db.get_all_platforms().unwrap_or_default().is_empty() {
                db.initialize_default_platforms()
                    .expect("Failed to initialize platforms");
                db.initialize_default_collections()
                    .expect("Failed to initialize collections");
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    #[test]
    fn logging_path_uses_the_public_config_logs_directory() {
        let configured =
            crate::config::AppConfig::logs_dir().expect("logs directory should be available");
        assert_eq!(super::logging_directory(), configured);
    }
}
