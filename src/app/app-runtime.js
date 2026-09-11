import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";
import { getCurrentWindow as tauriGetCurrentWindow } from "@tauri-apps/api/window";
import { open as tauriOpenUrl } from "@tauri-apps/plugin-shell";

/** @typedef {{getCurrentWindow: () => {isFullscreen: () => Promise<boolean>, onResized: (handler: () => void) => Promise<() => void>, startDragging: () => Promise<void>}, invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>, listen: (event: string, handler: (event: {payload?: unknown}) => void) => Promise<() => void>, openUrl: (url: string) => Promise<unknown>}} AppRuntime */

/** @type {AppRuntime} */
export const appRuntime = {
  getCurrentWindow: tauriGetCurrentWindow,
  invoke: tauriInvoke,
  listen: tauriListen,
  openUrl: tauriOpenUrl,
};
