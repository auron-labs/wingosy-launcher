/**
 * Argosy UI sounds — same filenames as rommapp/argosy-launcher (Apache-2.0):
 * app/src/main/res/raw/*.ogg
 * Served from /public/sounds/argosy (Vite).
 */
export const ARGOSY_SOUND_URLS = {
  back: "/sounds/argosy/swipe_back.ogg",
  click: "/sounds/argosy/click_soft.ogg",
  close: "/sounds/argosy/pop_close.ogg",
  error: "/sounds/argosy/buzz_error.ogg",
  open: "/sounds/argosy/chime_open.ogg",
  success: "/sounds/argosy/chime_success.ogg",
  tap: "/sounds/argosy/tap_light.ogg",
};

/** @typedef {"tap"|"click"|"success"|"error"|"back"|"open"|"close"} ArgosySoundId */
/** @type {Array<{id: ArgosySoundId, label: string}>} */
export const ARGOSY_SOUND_ENTRIES = [
  { id: "tap", label: "Tap" },
  { id: "click", label: "Click" },
  { id: "success", label: "Success" },
  { id: "error", label: "Error" },
  { id: "back", label: "Back" },
  { id: "open", label: "Open" },
  { id: "close", label: "Close" },
];
