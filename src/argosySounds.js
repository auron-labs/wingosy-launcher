/**
 * Argosy UI sounds — same filenames as rommapp/argosy-launcher (Apache-2.0):
 * app/src/main/res/raw/*.ogg
 * Served from /public/sounds/argosy (Vite).
 */
export const ARGOSY_SOUND_URLS = {
  tap: "/sounds/argosy/tap_light.ogg",
  click: "/sounds/argosy/click_soft.ogg",
  success: "/sounds/argosy/chime_success.ogg",
  error: "/sounds/argosy/buzz_error.ogg",
  back: "/sounds/argosy/swipe_back.ogg",
  open: "/sounds/argosy/chime_open.ogg",
  close: "/sounds/argosy/pop_close.ogg",
};

export const ARGOSY_SOUND_ENTRIES = [
  { id: "tap", label: "Tap" },
  { id: "click", label: "Click" },
  { id: "success", label: "Success" },
  { id: "error", label: "Error" },
  { id: "back", label: "Back" },
  { id: "open", label: "Open" },
  { id: "close", label: "Close" },
];
