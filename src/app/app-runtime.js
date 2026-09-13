import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";
import { getCurrentWindow as tauriGetCurrentWindow } from "@tauri-apps/api/window";
import { open as tauriOpenUrl } from "@tauri-apps/plugin-shell";

/** @typedef {import("../components/game/game-details-types").GameDetailsGame} AppGame */
/** @typedef {{games: AppGame[], total: number}} AppGamePage */
/** @typedef {{success?: boolean, error?: string|{message?: string}, dry_run?: boolean, save_sync_messages?: string[], save_sync_warnings?: string[]}} AppLaunchResult */
/** @typedef {{id: string, name: string}} AppPlatform */
/** @typedef {{server_url?: string, auth_token?: string}} AppRommConfig */
/** @typedef {{big_picture?: boolean, fullscreen?: boolean, controller_deadzone?: number, theme?: string, retroachievements_enabled?: boolean}} AppDisplayConfig */
/** @typedef {{auto_update_enabled?: boolean, channel?: string, check_on_startup?: boolean}} AppUpdaterConfig */
/** @typedef {{romm?: AppRommConfig, display?: AppDisplayConfig, library?: {roms_directory?: string}, updater?: AppUpdaterConfig}} AppConfig */
/** @typedef {{is_update_available?: boolean, signed_update_manifest_url?: string, release_url?: string, latest_version?: string, message?: string}} AppUpdateResult */
/** @typedef {{"signed-updater-progress": {downloaded?: number, total?: number}}} AppEventPayloads */
/** @typedef {{get_games_filtered: AppGame[], get_games_page: AppGamePage, toggle_favorite: boolean, prepare_and_launch_game: AppLaunchResult, get_game_details: AppGame, restore_romm_session: {server_url?: string, access_token?: string}, check_for_app_update: AppUpdateResult, install_signed_app_update: unknown, is_first_run: boolean, get_platforms_with_games: [AppPlatform, number][], get_config: AppConfig}} AppInvokeResults */
/** @typedef {{getCurrentWindow: () => {isFullscreen: () => Promise<boolean>, onResized: (handler: () => void) => Promise<() => void>, startDragging: () => Promise<void>}, invoke: <K extends keyof AppInvokeResults>(command: K, args?: Record<string, unknown>) => Promise<AppInvokeResults[K]>, listen: <K extends keyof AppEventPayloads>(event: K, handler: (event: {payload: AppEventPayloads[K]}) => void) => Promise<() => void>, openUrl: (url: string) => Promise<unknown>}} AppRuntime */

/** @type {AppRuntime} */
export const appRuntime = {
  getCurrentWindow: tauriGetCurrentWindow,
  invoke: tauriInvoke,
  listen: tauriListen,
  openUrl: tauriOpenUrl,
};
