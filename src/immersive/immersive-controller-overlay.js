const CONTROLLER_OVERLAY_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

/** @param {Element} element Overlay candidate. @returns {boolean} Whether the candidate is visible. */
export const isVisibleControllerOverlay = (element) => {
  /** @type {Element|null} */
  let current = element;
  while (current !== null) {
    if (
      (current instanceof HTMLElement && current.hidden === true) ||
      current.getAttribute("aria-hidden") === "true"
    ) {
      return false;
    }
    const style = window.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    current = current.parentElement;
  }
  return true;
};

/** @param {string} [selector] Overlay selector. @returns {Element|null} The visible controller overlay, if one is open. */
export const getVisibleControllerOverlay = (
  selector = CONTROLLER_OVERLAY_SELECTOR
) =>
  [...document.querySelectorAll(selector)].find(isVisibleControllerOverlay) ??
  null;
