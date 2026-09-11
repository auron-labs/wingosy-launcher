import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";

import { isTauri } from "../utils/isTauri";
import { setFullscreenReliable } from "../windowFullscreen";

const appWindow = isTauri() ? getCurrentWindow() : null;

/**
 * @param {{ enabled?: boolean, onChange?: (enabled: boolean) => void }} [options]
 */
export function useFullscreen(options = {}) {
  const { enabled, onChange } = options;
  const [isFullscreen, setIsFullscreen] = useState(false);

  const sync = useCallback(async () => {
    try {
      if (!appWindow) {
        return;
      }
      const v = await appWindow.isFullscreen();
      setIsFullscreen(Boolean(v));
    } catch {
      // ignore (e.g. in non-tauri web preview)
    }
  }, []);

  const setFullscreen = useCallback(
    async (next) => {
      const value = Boolean(next);
      try {
        await setFullscreenReliable(value);
      } catch {
        // ignore
      }
      try {
        if (appWindow) {
          const v = await appWindow.isFullscreen();
          setIsFullscreen(Boolean(v));
          if (onChange) {
            onChange(Boolean(v));
          }
          return;
        }
      } catch {
        // Fall back to the requested state if the native window cannot be queried.
      }
      setIsFullscreen(value);
      if (onChange) {
        onChange(value);
      }
    },
    [onChange]
  );

  const toggleFullscreen = useCallback(async () => {
    const next = !isFullscreen;
    await setFullscreen(next);
  }, [isFullscreen, setFullscreen]);

  useEffect(() => {
    sync();
  }, [sync]);

  useEffect(() => {
    if (typeof enabled === "boolean") {
      setFullscreen(enabled);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { isFullscreen, setFullscreen, sync, toggleFullscreen };
}
