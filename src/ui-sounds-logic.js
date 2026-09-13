import { ARGOSY_SOUND_URLS } from "./argosy-sounds";
import { mousedownTargetElement } from "./utils/is-tauri";

/** @typedef {'tap'|'click'|'success'|'error'|'back'|'open'|'close'} ArgosySoundId */
/** @typedef {{display?: {ui_sounds_enabled?: boolean}, audio?: {ui_sounds_volume?: number}}} UiSoundsConfig */
/** @typedef {{current: number}} TapClock */
/** @typedef {{id: ArgosySoundId, allowDesktop?: boolean, immersiveActive: boolean, lastTapAt: TapClock, uiSoundsEnabled: boolean, uiSoundsVolume: number}} PlaySoundOptions */

/** @param {number} volume Requested volume percentage. */
export const clampUiSoundsVolume = (volume) =>
  Math.min(100, Math.max(0, Math.round(volume)));

/** @param {UiSoundsConfig} config Persisted UI sound settings. */
export const readUiSoundsConfig = (config) => {
  const configuredVolume = config.audio?.ui_sounds_volume;
  return {
    enabled: Boolean(config.display?.ui_sounds_enabled),
    volume:
      configuredVolume !== undefined && Number.isFinite(configuredVolume)
        ? clampUiSoundsVolume(configuredVolume)
        : 80,
  };
};

/** @param {HTMLAudioElement} audio Audio element to start. */
const playAudio = async (audio) => {
  try {
    await audio.play();
    return true;
  } catch {
    return false;
  }
};

/** @param {PlaySoundOptions} options Sound playback options. */
export const playUiSound = ({
  id,
  allowDesktop = false,
  immersiveActive,
  lastTapAt,
  uiSoundsEnabled,
  uiSoundsVolume,
}) => {
  if ((!immersiveActive && !allowDesktop) || !uiSoundsEnabled) {
    return;
  }
  const url = ARGOSY_SOUND_URLS[id];
  if (!url) {
    return;
  }
  if (id === "tap") {
    const now = Date.now();
    if (now - lastTapAt.current < 70) {
      return;
    }
    lastTapAt.current = now;
  }
  const master = (uiSoundsVolume / 100) * 0.55;
  const gain = id === "success" || id === "error" ? 1.15 : 1;
  try {
    const audio = new Audio(url);
    audio.volume = Math.min(1, master * gain);
    void playAudio(audio);
  } catch {
    // Audio is unavailable in some embedded or test environments.
  }
};

/** @param {string} value Dataset value to validate. */
export const isArgosySoundId = (value) =>
  value === "back" ||
  value === "click" ||
  value === "close" ||
  value === "error" ||
  value === "open" ||
  value === "success" ||
  value === "tap";

/** @param {PointerEvent} event Browser pointer event. @param {(id: ArgosySoundId, allowDesktop?: boolean) => void} play Sound callback. */
export const handleUiSoundPointerDown = (event, play) => {
  if (event.button !== 0) {
    return;
  }
  const target = mousedownTargetElement(event.target);
  if (!target) {
    return;
  }
  const onDragChrome = target.closest("[data-tauri-drag-region]") !== null;
  const onNoDrag = target.closest("[data-tauri-no-drag]") !== null;
  if (
    (onDragChrome && !onNoDrag) ||
    target.closest("[data-ui-sound-none]") !== null
  ) {
    return;
  }
  const explicit = target.closest("[data-argosy-sound]");
  const key =
    explicit instanceof HTMLElement ? explicit.dataset.argosySound : undefined;
  if (key !== undefined && key !== "" && isArgosySoundId(key)) {
    play(key);
    return;
  }
  if (target.closest("textarea, .MuiInputBase-root input, .MuiSelect-select")) {
    return;
  }
  const interactive = target.closest(
    "button, a[href], [role='button']:not([data-ui-sound-none]), .MuiButtonBase-root, .MuiListItemButton-root, .MuiChip-clickable, .MuiCardActionArea-root, .MuiTab-root, [role='menuitem'], [role='option']"
  );
  if (interactive) {
    play("tap");
  }
};
