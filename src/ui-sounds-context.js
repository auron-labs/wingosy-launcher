import { createContext, useContext } from "react";

/** @typedef {'tap'|'click'|'success'|'error'|'back'|'open'|'close'} ArgosySoundId */
/** @typedef {{display?: {ui_sounds_enabled?: boolean}, audio?: {ui_sounds_volume?: number}}} UiSoundsConfig */
/** @typedef {{uiSoundsEnabled: boolean, uiSoundsVolume: number, setUiSoundsEnabled: (next: boolean) => void, setUiSoundsVolume: (next: number) => void, refreshUiSoundsFromConfig: (cfg: UiSoundsConfig) => void, playArgosySound: (id: ArgosySoundId, allowDesktop?: boolean) => void, previewArgosySound: (id: ArgosySoundId) => void}} UiSoundsContextValue */

/** @type {import('react').Context<UiSoundsContextValue|null>} */
export const UiSoundsContext = createContext(null);

export const useUiSounds = () => {
  const value = useContext(UiSoundsContext);
  if (!value) {
    throw new Error("useUiSounds must be used within UiSoundsProvider");
  }
  return value;
};
