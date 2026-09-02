import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { ARGOSY_SOUND_URLS } from "./argosySounds";

const UiSoundsContext = createContext(null);

/** @typedef {'tap'|'click'|'success'|'error'|'back'|'open'|'close'} ArgosySoundId */

export function useUiSounds() {
  const v = useContext(UiSoundsContext);
  if (!v) {
    throw new Error("useUiSounds must be used within UiSoundsProvider");
  }
  return v;
}

/**
 * Argosy-style UI clicks: only active in Immersive mode (`immersiveActive`) and when enabled in config.
 */
export function UiSoundsProvider({ children, immersiveActive = false }) {
  const [uiSoundsEnabled, setUiSoundsEnabledState] = useState(false);
  const [uiSoundsVolume, setUiSoundsVolumeState] = useState(80);
  const lastTapAt = useRef(0);

  const refreshFromConfig = useCallback((cfg) => {
    if (!cfg) return;
    setUiSoundsEnabledState(Boolean(cfg.display?.ui_sounds_enabled));
    const v = cfg.audio?.ui_sounds_volume;
    setUiSoundsVolumeState(
      typeof v === "number" ? Math.min(100, Math.max(0, v)) : 80
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await invoke("get_config");
        if (!cancelled) refreshFromConfig(cfg);
      } catch {
        if (!cancelled) {
          setUiSoundsEnabledState(false);
          setUiSoundsVolumeState(80);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshFromConfig]);

  const play = useCallback(
    /** @param {ArgosySoundId} id */
    (id, allowDesktop = false) => {
      if ((!immersiveActive && !allowDesktop) || !uiSoundsEnabled) return;
      const url = ARGOSY_SOUND_URLS[id];
      if (!url) return;
      if (id === "tap") {
        const now = Date.now();
        if (now - lastTapAt.current < 70) return;
        lastTapAt.current = now;
      }
      const master = (uiSoundsVolume / 100) * 0.55;
      const gain = id === "success" || id === "error" ? 1.15 : 1;
      try {
        const audio = new Audio(url);
        audio.volume = Math.min(1, master * gain);
        void audio.play().catch(() => {});
      } catch {
        // ignore
      }
    },
    [immersiveActive, uiSoundsEnabled, uiSoundsVolume]
  );

  const preview = useCallback(
    /** @param {ArgosySoundId} id */
    (id) => play(id, true),
    [play]
  );

  const setUiSoundsEnabled = useCallback((next) => {
    setUiSoundsEnabledState(Boolean(next));
  }, []);

  const setUiSoundsVolume = useCallback((next) => {
    setUiSoundsVolumeState(Math.min(100, Math.max(0, Math.round(next))));
  }, []);

  useEffect(() => {
    if (!immersiveActive || !uiSoundsEnabled) return;

    function onPointerDown(e) {
      if (e.button !== 0) return;
      const onDragChrome =
        e.target.closest?.("[data-tauri-drag-region]") && !e.target.closest?.("[data-tauri-no-drag]");
      if (onDragChrome) return;
      if (e.target.closest?.("[data-ui-sound-none]")) return;

      const explicit = e.target.closest?.("[data-argosy-sound]");
      if (explicit) {
        const key = explicit.getAttribute("data-argosy-sound");
        if (key && ARGOSY_SOUND_URLS[key]) {
          play(/** @type {ArgosySoundId} */ (key));
          return;
        }
      }
      if (e.target.closest?.("textarea, .MuiInputBase-root input, .MuiSelect-select")) {
        return;
      }
      const interactive = e.target.closest?.(
        "button, a[href], [role='button']:not([data-ui-sound-none]), .MuiButtonBase-root, .MuiListItemButton-root, .MuiChip-clickable, .MuiCardActionArea-root, .MuiTab-root, [role='menuitem'], [role='option']"
      );
      if (!interactive) return;
      play("tap");
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [immersiveActive, uiSoundsEnabled, play]);

  const value = useMemo(
    () => ({
      uiSoundsEnabled,
      uiSoundsVolume,
      setUiSoundsEnabled,
      setUiSoundsVolume,
      refreshUiSoundsFromConfig: refreshFromConfig,
      playArgosySound: play,
      previewArgosySound: preview,
    }),
    [
      uiSoundsEnabled,
      uiSoundsVolume,
      setUiSoundsEnabled,
      setUiSoundsVolume,
      refreshFromConfig,
      play,
      preview,
    ]
  );

  return <UiSoundsContext.Provider value={value}>{children}</UiSoundsContext.Provider>;
}
