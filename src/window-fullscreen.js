import { getCurrentWindow } from "@tauri-apps/api/window";

import { isTauri } from "./utils/is-tauri";

const appWindow = isTauri() ? getCurrentWindow() : null;

/** @returns {Promise<void>} Resolves after two animation frames. */
const waitForAnimationFrames = async () => {
  /** @type {{promise: Promise<void>, resolve: () => void}} */
  const deferred = Promise.withResolvers();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      deferred.resolve();
    });
  });
  await deferred.promise;
};

/**
 * Enter/leave exclusive fullscreen. On Windows, calling `setFullscreen(true)` while
 * the window is maximized is often ignored; unmaximize first so the WM can switch modes.
 */
/** @param {boolean} wantFullscreen Whether exclusive fullscreen is wanted. */
export const setFullscreenReliable = async (wantFullscreen) => {
  if (!appWindow) {
    return;
  }
  if (wantFullscreen) {
    if (await appWindow.isMaximized()) {
      await appWindow.unmaximize();
      await waitForAnimationFrames();
    }
    await appWindow.setFullscreen(true);
  } else {
    await appWindow.setFullscreen(false);
  }
};
