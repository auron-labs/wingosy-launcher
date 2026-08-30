import { debugLog } from "../utils/debugLog";

const CONTROLLER_ACTION_PROPERTY = "__wingosyControllerAction";

export function attachControllerAction(event, action) {
  if (!action) return event;

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
}

export function getControllerAction(event) {
  return event?.[CONTROLLER_ACTION_PROPERTY] || event?.nativeEvent?.[CONTROLLER_ACTION_PROPERTY] || null;
}

export function logControllerOutcome(action, receiver, outcome, details = {}) {
  if (!action) return;

  debugLog("controller", `receiver ${outcome}`, {
    ...action,
    receiver,
    outcome,
    ...details,
  });
}

export function describeControllerElement(element) {
  if (!element || typeof element.getAttribute !== "function") return null;

  const tag = typeof element.tagName === "string" ? element.tagName.toLowerCase() : null;
  if (!tag) return null;

  const implicitRole = tag === "button" ? "button" : tag === "a" ? "link" : null;
  const descriptor = {
    tag,
    role: element.getAttribute("role") || implicitRole,
  };
  const testId = element.getAttribute("data-testid");
  const action =
    element.getAttribute("aria-label") || element.getAttribute("data-controller-action");
  const index = element.getAttribute("data-immersive-index");

  if (testId) descriptor.testId = testId;
  if (action) descriptor.action = action;
  if (index !== null) descriptor.index = index;

  return descriptor;
}
