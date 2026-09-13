import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";
import { open as tauriOpen } from "@tauri-apps/plugin-dialog";
import { open as tauriShellOpen } from "@tauri-apps/plugin-shell";

/** @typedef {import("./settings-types").SettingsConfig} SettingsConfig */
/** @typedef {{(command: "get_config", args?: Record<string, unknown>): Promise<SettingsConfig>, <T>(command: string, args?: Record<string, unknown>): Promise<T>}} SettingsInvoke */
/** @typedef {{invoke: SettingsInvoke, listen: typeof tauriListen, openDialog: typeof tauriOpen, shellOpen: typeof tauriShellOpen}} SettingsRuntime */

/** @type {SettingsRuntime} */
export const defaultSettingsRuntime = {
  invoke: tauriInvoke,
  listen: tauriListen,
  openDialog: tauriOpen,
  shellOpen: tauriShellOpen,
};
