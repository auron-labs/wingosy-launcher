import { useCallback, useEffect } from "react";

import {
  clickFocusedElement,
  focusElement,
  getSpatialDirection,
  getVisibleFocusableElements,
  moveSpatialFocus,
} from "./controller-spatial-navigation";

const NAV_BUTTON_SELECTOR = '[data-testid^="settings-nav-"]';

/** @returns {HTMLElement[]} Settings section buttons in DOM order. */
const getSettingsNavButtons = () =>
  [...(document.querySelectorAll(NAV_BUTTON_SELECTOR) ?? [])].filter(
    (element) => element instanceof HTMLElement
  );

/** @param {number} direction -1 for previous, 1 for next. @returns {boolean} Whether a section was activated. */
const cycleSettingsSection = (direction) => {
  const navButtons = getSettingsNavButtons();
  if (navButtons.length === 0) {
    return false;
  }
  const selectedIndex = navButtons.findIndex((button) =>
    button.classList.contains("Mui-selected")
  );
  const focusedIndex =
    document.activeElement instanceof HTMLElement
      ? navButtons.indexOf(document.activeElement)
      : -1;
  const current = selectedIndex === -1 ? focusedIndex : selectedIndex;
  const next =
    current === -1
      ? 0
      : (current + direction + navButtons.length) % navButtons.length;
  focusElement(navButtons[next]);
  navButtons[next].click();
  return true;
};

/** @param {KeyboardEvent} event Key event. @param {HTMLElement} container Settings root. @returns {boolean} Whether a focused control consumed the event. */
const redispatchArrowToFocusedControl = (event, container) => {
  const { activeElement } = document;
  if (
    !(activeElement instanceof HTMLElement) ||
    !container.contains(activeElement)
  ) {
    return false;
  }
  const dispatched = activeElement.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: event.key,
    })
  );
  if (dispatched) {
    return false;
  }
  event.preventDefault();
  return true;
};

/** @param {KeyboardEvent} event Key event. @param {HTMLElement} container Settings root. */
const handleSettingsControllerKey = (event, container) => {
  const direction = getSpatialDirection(event.key);
  if (direction !== null) {
    if (
      !redispatchArrowToFocusedControl(event, container) &&
      moveSpatialFocus({ container, direction })
    ) {
      event.preventDefault();
    }
    return;
  }
  if (
    (event.key === "PageUp" || event.key === "PageDown") &&
    cycleSettingsSection(event.key === "PageDown" ? 1 : -1)
  ) {
    event.preventDefault();
    return;
  }
  if (
    (event.key === "Enter" || event.key === " ") &&
    clickFocusedElement({ container })
  ) {
    event.preventDefault();
  }
};

/**
 * Controller-only navigation for the settings page. The hook runs on the
 * controller-routed window events (real keyboard input keeps the native
 * control behavior because the listener ignores non-window targets).
 * @param {{current: HTMLElement|null}} containerRef Settings root element.
 */
export const useImmersiveSettingsNavigation = (containerRef) => {
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const { activeElement } = document;
    if (
      activeElement instanceof HTMLElement &&
      container.contains(activeElement)
    ) {
      return;
    }
    const selected =
      container.querySelector(`${NAV_BUTTON_SELECTOR}.Mui-selected`) ??
      getVisibleFocusableElements(container)[0];
    if (selected instanceof HTMLElement) {
      focusElement(selected);
    }
  }, [containerRef]);

  const onKeyDown = useCallback(
    /** @param {KeyboardEvent} event Keyboard event. */
    (event) => {
      if (event.target !== event.currentTarget && event.target !== window) {
        return;
      }
      const container = containerRef.current;
      if (container !== null) {
        handleSettingsControllerKey(event, container);
      }
    },
    [containerRef]
  );

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onKeyDown]);
};
