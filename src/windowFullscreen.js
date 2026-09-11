import { getCurrentWindow } from "@tauri-apps/api/window";

import { isTauri } from "./utils/isTauri";

const appWindow = isTauri() ? getCurrentWindow() : null;

/**
 * Enter/leave exclusive fullscreen. On Windows, calling `setFullscreen(true)` while
 * the window is maximized is often ignored; unmaximize first so the WM can switch modes.
 */
export async function setFullscreenReliable(wantFullscreen) {
  if (!appWindow) {
    return;
  }
  if (wantFullscreen) {
    if (await appWindow.isMaximized()) {
      await appWindow.unmaximize();
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r))
      );
    }
    await appWindow.setFullscreen(true);
  } else {
    await appWindow.setFullscreen(false);
  }
}
