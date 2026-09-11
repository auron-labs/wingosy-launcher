import { invoke } from "@tauri-apps/api/core";

/** @typedef {{display?: {ui_sounds_enabled?: boolean}, audio?: {ui_sounds_volume?: number}}} UiSoundsConfig */

/** @returns {Promise<UiSoundsConfig>} Persisted UI sound settings. */
export const loadUiSoundsConfig = async () => await invoke("get_config");
