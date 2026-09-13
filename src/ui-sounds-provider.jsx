import { useCallback, useEffect, useMemo, useRef } from "react";

import { UiSoundsContext } from "./ui-sounds-context";
import { handleUiSoundPointerDown, playUiSound } from "./ui-sounds-logic";
import { useUiSoundSettings } from "./use-ui-sound-settings";

/** @typedef {import('./ui-sounds-context').ArgosySoundId} ArgosySoundId */
/** @typedef {import('./ui-sounds-context').UiSoundsConfig} UiSoundsConfig */

/** @param {{children: import('react').ReactNode, immersiveActive?: boolean}} props Provider props. */
export const UiSoundsProvider = ({ children, immersiveActive = false }) => {
  const lastTapAt = useRef(0);
  const {
    refreshFromConfig,
    setUiSoundsEnabled,
    setUiSoundsVolume,
    uiSoundsEnabled,
    uiSoundsVolume,
  } = useUiSoundSettings();

  const play = useCallback(
    /** @param {ArgosySoundId} id Sound identifier. */
    (id, allowDesktop = false) => {
      playUiSound({
        allowDesktop,
        id,
        immersiveActive,
        lastTapAt,
        uiSoundsEnabled,
        uiSoundsVolume,
      });
    },
    [immersiveActive, uiSoundsEnabled, uiSoundsVolume]
  );

  const preview = useCallback(
    /** @param {ArgosySoundId} id Sound identifier. */
    (id) => {
      play(id, true);
    },
    [play]
  );

  useEffect(() => {
    /** @type {((event: PointerEvent) => void)|null} */
    let onPointerDown = null;
    if (immersiveActive && uiSoundsEnabled) {
      onPointerDown = (event) => {
        handleUiSoundPointerDown(event, play);
      };
      document.addEventListener("pointerdown", onPointerDown, true);
    }
    return () => {
      if (onPointerDown) {
        document.removeEventListener("pointerdown", onPointerDown, true);
      }
    };
  }, [immersiveActive, uiSoundsEnabled, play]);

  const value = useMemo(
    () => ({
      playArgosySound: play,
      previewArgosySound: preview,
      refreshUiSoundsFromConfig: refreshFromConfig,
      setUiSoundsEnabled,
      setUiSoundsVolume,
      uiSoundsEnabled,
      uiSoundsVolume,
    }),
    [
      play,
      preview,
      refreshFromConfig,
      uiSoundsEnabled,
      uiSoundsVolume,
      setUiSoundsEnabled,
      setUiSoundsVolume,
    ]
  );

  return (
    <UiSoundsContext.Provider value={value}>
      {children}
    </UiSoundsContext.Provider>
  );
};
