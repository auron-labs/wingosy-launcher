import {
  describeControllerElement,
  getControllerAction,
  logControllerOutcome,
} from "./controller-debug";

const FOCUSABLE_SELECTOR = [
  "button:not(:disabled)",
  "a[href]",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="tab"]',
  '[role="link"]',
  '[role="slider"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/** @param {Element|null} element Element to inspect. @param {Element} boundary Inclusive ancestor boundary. @returns {boolean} Whether the element is hidden by itself or an ancestor. */
const isHiddenByAncestor = (element, boundary) => {
  /** @type {Element|null} */
  let current = element;
  while (current !== null) {
    if (
      (current instanceof HTMLElement && current.hidden === true) ||
      current.getAttribute("aria-hidden") === "true"
    ) {
      return true;
    }
    if (current instanceof HTMLElement) {
      const style = window.getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden") {
        return true;
      }
    }
    if (current === boundary) {
      return false;
    }
    current = current.parentElement;
  }
  return false;
};

/** @param {Element} container Container to scan. @returns {HTMLElement[]} Visible, keyboard-reachable elements inside the container. */
export const getVisibleFocusableElements = (container) => {
  /** @type {HTMLElement[]} */
  const elements = [];
  for (const element of container.querySelectorAll(FOCUSABLE_SELECTOR)) {
    if (
      element instanceof HTMLElement &&
      !isHiddenByAncestor(element, container)
    ) {
      elements.push(element);
    }
  }
  return elements;
};

/** @param {DOMRect} rect Rectangle to measure. @returns {{x: number, y: number}} Rectangle center. */
const rectCenter = (rect) => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
});

/** @param {string} key Arrow key. @returns {"left"|"right"|"up"|"down"|null} Spatial direction. */
export const getSpatialDirection = (key) => {
  switch (key) {
    case "ArrowLeft": {
      return "left";
    }
    case "ArrowRight": {
      return "right";
    }
    case "ArrowUp": {
      return "up";
    }
    case "ArrowDown": {
      return "down";
    }
    default: {
      return null;
    }
  }
};

/** @param {{x: number, y: number}} from Source center. @param {{x: number, y: number}} to Candidate center. @param {"left"|"right"|"up"|"down"} direction Direction. @returns {number|null} Directional score, or null when not in that direction. */
const scoreCandidate = (from, to, direction) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  switch (direction) {
    case "left": {
      return dx < -1 ? -dx + Math.abs(dy) * 4 : null;
    }
    case "right": {
      return dx > 1 ? dx + Math.abs(dy) * 4 : null;
    }
    case "up": {
      return dy < -1 ? -dy + Math.abs(dx) * 4 : null;
    }
    case "down": {
      return dy > 1 ? dy + Math.abs(dx) * 4 : null;
    }
    default: {
      return null;
    }
  }
};

/** @param {HTMLElement|null} element Element to focus. */
export const focusElement = (element) => {
  element?.focus();
  try {
    element?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  } catch {
    // Ignore unavailable scrolling in test DOMs.
  }
};

/** @param {{container: Element, direction: "left"|"right"|"up"|"down", candidates?: HTMLElement[]}} options Movement options. @returns {boolean} Whether focus moved. */
export const moveSpatialFocus = ({ candidates, container, direction }) => {
  const elements = candidates ?? getVisibleFocusableElements(container);
  if (elements.length === 0) {
    return false;
  }
  const { activeElement } = document;
  if (
    !(activeElement instanceof HTMLElement) ||
    !container.contains(activeElement)
  ) {
    focusElement(elements[0]);
    return document.activeElement === elements[0];
  }
  const from = rectCenter(activeElement.getBoundingClientRect());
  /** @type {{element: HTMLElement|null, score: number}} */
  const best = { element: null, score: Number.POSITIVE_INFINITY };
  for (const element of elements) {
    if (element === activeElement) {
      continue;
    }
    const score = scoreCandidate(
      from,
      rectCenter(element.getBoundingClientRect()),
      direction
    );
    if (score !== null && score < best.score) {
      best.element = element;
      best.score = score;
    }
  }
  if (best.element === null) {
    return false;
  }
  focusElement(best.element);
  return document.activeElement === best.element;
};

/** @param {{container: Element}} options Activation options. @returns {boolean} Whether a focused control inside the container was clicked. */
export const clickFocusedElement = ({ container }) => {
  const { activeElement } = document;
  if (
    !(activeElement instanceof HTMLElement) ||
    !container.contains(activeElement)
  ) {
    return false;
  }
  if (!activeElement.matches(FOCUSABLE_SELECTOR)) {
    return false;
  }
  activeElement.click();
  return true;
};

/** @param {KeyboardEvent} event Keyboard event. @param {string} receiver Debug receiver name. @param {boolean} handled Whether the receiver acted on the event. @param {string} reason Outcome reason. */
export const logSpatialOutcome = (event, receiver, handled, reason) => {
  logControllerOutcome(
    getControllerAction(event),
    receiver,
    handled ? "handled" : "ignored",
    {
      afterFocus: describeControllerElement(document.activeElement),
      reason,
    }
  );
};
