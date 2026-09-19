import { debugLog } from "../utils/debug-log";

const CONTROLLER_ACTION_PROPERTY = "__wingosyControllerAction";

/**
 * @typedef {{actionId: number, controllerIndex: number, deferred: boolean, elapsedSincePreviousMs: number|null, key: string, phase: string}} ControllerAction
 * @typedef {Event & {__wingosyControllerAction?: ControllerAction, nativeEvent?: {__wingosyControllerAction?: ControllerAction}}} ControllerEvent
 */

/** @param {KeyboardEvent} event @param {ControllerAction|null} action @returns {KeyboardEvent} */
export const attachControllerAction = (event, action) => {
  if (action === null) {
    return event;
  }

  try {
    Object.defineProperty(event, CONTROLLER_ACTION_PROPERTY, {
      configurable: false,
      enumerable: false,
      value: action,
      writable: false,
    });
  } catch {
    // Some WebViews may expose non-extensible event objects. Native behavior stays intact.
  }

  return event;
};

/** @param {ControllerEvent} event - Keyboard/controller event. @returns {ControllerAction|null} */
export const getControllerAction = (event) =>
  event.__wingosyControllerAction ??
  event.nativeEvent?.__wingosyControllerAction ??
  null;

/** @param {EventTarget|null} target - Event target to inspect. */
export const isTextInputTarget = (target) =>
  target instanceof Element &&
  target.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'
  ) !== null;

/** @param {ControllerAction|null} action @param {string} receiver @param {string} outcome @param {Record<string, unknown>} [details] */
export const logControllerOutcome = (
  action,
  receiver,
  outcome,
  details = {}
) => {
  if (action === null) {
    return;
  }

  debugLog("controller", `receiver ${outcome}`, {
    ...action,
    outcome,
    receiver,
    ...details,
  });
};

/** @param {Element|null} element - Element to describe. */
export const describeControllerElement = (element) => {
  if (element === null) {
    return null;
  }

  const tag = element.tagName.toLowerCase();
  if (tag === "") {
    return null;
  }

  /** @type {string|null} */
  let implicitRole = null;
  if (tag === "button") {
    implicitRole = "button";
  } else if (tag === "a") {
    implicitRole = "link";
  }
  const descriptor = {
    role: element.getAttribute("role") ?? implicitRole,
    tag,
  };
  const dataset = element instanceof HTMLElement ? element.dataset : {};
  const testId = dataset.testid;
  const action = element.getAttribute("aria-label") ?? dataset.controllerAction;
  const index = dataset.immersiveIndex;

  if (testId !== undefined && testId !== "") {
    descriptor.testId = testId;
  }
  if (action !== null && action !== undefined && action !== "") {
    descriptor.action = action;
  }
  if (index !== undefined && index !== "") {
    descriptor.index = index;
  }

  return descriptor;
};
