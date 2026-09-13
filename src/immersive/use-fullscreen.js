import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useSyncExternalStore } from "react";

import { isTauri } from "../utils/is-tauri";
import { setFullscreenReliable } from "../window-fullscreen";

const appWindow = isTauri() ? getCurrentWindow() : null;
let fullscreenSnapshot = false;
/** @type {Set<() => void>} */
const fullscreenSubscribers = new Set();

/** @returns {boolean} Current fullscreen snapshot. */
const getFullscreenSnapshot = () => fullscreenSnapshot;

/** @returns {boolean} Current server fullscreen snapshot. */
const getServerFullscreenSnapshot = () => false;

/** @param {() => void} subscriber Snapshot subscriber. @returns {() => void} Unsubscribe callback. */
const subscribeToFullscreen = (subscriber) => {
  fullscreenSubscribers.add(subscriber);
  return () => {
    fullscreenSubscribers.delete(subscriber);
  };
};

/** @param {boolean} value New fullscreen snapshot. */
const updateFullscreenSnapshot = (value) => {
  fullscreenSnapshot = value;
  for (const subscriber of fullscreenSubscribers) {
    subscriber();
  }
};

/** @returns {Promise<void>} Synchronize with the native window. */
const syncNativeFullscreen = async () => {
  if (!appWindow) {
    return;
  }
  try {
    updateFullscreenSnapshot(await appWindow.isFullscreen());
  } catch (error) {
    void error;
  }
};

/**
 * @param {{ enabled?: boolean, onChange?: (enabled: boolean) => void }} [options] Fullscreen options.
 */
export const useFullscreen = (options = {}) => {
  const { enabled, onChange } = options;
  const isFullscreen = useSyncExternalStore(
    subscribeToFullscreen,
    getFullscreenSnapshot,
    getServerFullscreenSnapshot
  );

  const sync = useCallback(async () => {
    await syncNativeFullscreen();
  }, []);
  const setFullscreen = useCallback(
    async (next) => {
      const value = Boolean(next);
      try {
        await setFullscreenReliable(value);
      } catch {
        // Continue with the native state query or requested fallback below.
      }
      try {
        if (appWindow) {
          const nativeValue = await appWindow.isFullscreen();
          updateFullscreenSnapshot(nativeValue);
          onChange?.(nativeValue);
          return;
        }
      } catch {
        updateFullscreenSnapshot(value);
        onChange?.(value);
        return;
      }
      updateFullscreenSnapshot(value);
      onChange?.(value);
    },
    [onChange]
  );

  const toggleFullscreen = useCallback(async () => {
    await setFullscreen(!isFullscreen);
  }, [isFullscreen, setFullscreen]);

  useEffect(() => {
    void sync();
  }, [sync]);
  useEffect(() => {
    if (enabled !== undefined) {
      void setFullscreen(enabled);
    }
  }, [enabled, setFullscreen]);

  return { isFullscreen, setFullscreen, sync, toggleFullscreen };
};
