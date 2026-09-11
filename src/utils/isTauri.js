/**
 * True when running inside the Tauri webview (not Vite browser dev).
 * Tauri 2 uses `window.__TAURI_INTERNALS__` for IPC; `window.__TAURI__` exists only when
 * `app.withGlobalTauri` is enabled in `tauri.conf.json`. Detect both so frameless chrome
 * and drag regions work in default Tauri 2 builds.
 */
import { hasTauriIpc } from "./value-guards";

export const isTauri = () => {
  if (globalThis.window === undefined) {
    return false;
  }
  // Matches `@tauri-apps/api/core` `isTauri()` when the runtime sets this flag.
  return (
    Boolean(window.__TAURI__) ||
    hasTauriIpc(window) ||
    Boolean(globalThis.isTauri)
  );
};

/** Use with `data-tauri-drag-region` on the same element (Tauri frameless windows). */
export const tauriDragRegionSx = { WebkitAppRegion: "drag" };

/** Buttons, inputs, and links must opt out so clicks work. */
export const tauriNoDragSx = { WebkitAppRegion: "no-drag" };

export const tauriDragRegionProps = () => {
  if (!isTauri()) {
    return {};
  }
  return { "data-tauri-drag-region": true };
};

export const tauriNoDragProps = () => {
  if (!isTauri()) {
    return {};
  }
  return { "data-tauri-no-drag": true };
};

/**
 * `mousedown` / `pointerdown` `target` can be a `Text` node (e.g. title bar label).
 * `Element.closest` only exists on `Element`, so normalize before calling `closest`.
 * @param {EventTarget|null} [target] Original pointer-event target.
 */
export const mousedownTargetElement = (target) => {
  if (
    target === null ||
    target === undefined ||
    globalThis.Node === undefined
  ) {
    return null;
  }
  if (target instanceof Element) {
    return target;
  }
  if (target instanceof Text && target.parentElement) {
    return target.parentElement;
  }
  return null;
};
