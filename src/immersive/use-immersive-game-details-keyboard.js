import { useEffect } from "react";

import {
  describeControllerElement,
  getControllerAction,
  logControllerOutcome,
} from "./controller-debug";

const DETAILS_ACTION_SELECTOR = "button:not(:disabled)";
const INPUT_OVERLAY_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

/** @param {HTMLElement|null} root Details container. @returns {HTMLButtonElement[]} Visible action buttons. */
const getVisibleDetailsActions = (root) => {
  const actions = [
    ...(root?.querySelectorAll(DETAILS_ACTION_SELECTOR) ?? []),
  ].filter((element) => element instanceof HTMLButtonElement);
  return actions.filter((element) => {
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
      if (current === root) {
        break;
      }
      current = current.parentElement;
    }
    return true;
  });
};

/** @param {string} key Keyboard key. @returns {number} Arrow movement direction. */
const getArrowDirection = (key) =>
  key === "ArrowLeft" || key === "ArrowUp" ? -1 : 1;

/** @param {{focusedIndex: number, anchorIndex: number, direction: number, canPlay: boolean, actionCount: number}} options Arrow-navigation state. @returns {number} Starting action index. */
const getArrowStartIndex = ({
  focusedIndex,
  anchorIndex,
  direction,
  canPlay,
  actionCount,
}) => {
  if (focusedIndex !== -1) {
    return focusedIndex;
  }
  if (anchorIndex !== -1) {
    return anchorIndex + (canPlay || direction < 0 ? 0 : -1);
  }
  return direction > 0 ? -1 : actionCount;
};

/** @param {boolean} focused Whether focus reached the requested target. @param {number} nextIndex Requested action index. @param {number} startIndex Starting action index. @returns {string} Focus outcome. */
const getFocusOutcome = (focused, nextIndex, startIndex) => {
  if (!focused) {
    return "focus-target-not-focused";
  }
  return nextIndex === startIndex ? "focus-boundary" : "focus-moved";
};

/** @param {{event: KeyboardEvent, action: ReturnType<typeof getControllerAction>, actions: HTMLButtonElement[], canPlay: boolean, primaryActionRef: {current: HTMLButtonElement|null}}} options Arrow-navigation dependencies. */
const handleArrowKey = ({
  event,
  action,
  actions,
  canPlay,
  primaryActionRef,
}) => {
  const overlay = document.querySelector(INPUT_OVERLAY_SELECTOR);
  if (overlay !== null) {
    logControllerOutcome(action, "details", "suppressed", {
      reason: `${overlay.getAttribute("role") ?? "overlay"} open`,
    });
    return;
  }
  if (actions.length === 0) {
    logControllerOutcome(action, "details", "ignored", {
      reason: "no-visible-actions",
    });
    return;
  }
  const direction = getArrowDirection(event.key);
  const { activeElement } = document;
  const focusedIndex =
    activeElement instanceof HTMLButtonElement
      ? actions.indexOf(activeElement)
      : -1;
  const anchorIndex =
    primaryActionRef.current === null
      ? -1
      : actions.indexOf(primaryActionRef.current);
  const startIndex = getArrowStartIndex({
    actionCount: actions.length,
    anchorIndex,
    canPlay,
    direction,
    focusedIndex,
  });
  const nextIndex = Math.max(
    0,
    Math.min(actions.length - 1, startIndex + direction)
  );
  const beforeFocus = describeControllerElement(document.activeElement);
  event.preventDefault();
  const target = actions[nextIndex] ?? null;
  target?.focus();
  const afterFocus = describeControllerElement(document.activeElement);
  if (target === null) {
    logControllerOutcome(action, "details", "ignored", {
      afterFocus,
      beforeFocus,
      reason: "focus-target-missing",
      targetIndex: nextIndex,
    });
    return;
  }
  const focused = document.activeElement === target;
  logControllerOutcome(action, "details", focused ? "handled" : "ignored", {
    afterFocus,
    beforeFocus,
    reason: getFocusOutcome(focused, nextIndex, startIndex),
    targetFocus: describeControllerElement(target),
  });
};

/** @param {{event: KeyboardEvent, action: ReturnType<typeof getControllerAction>, retryableLaunchFailure: boolean, handleLaunchGame: () => Promise<void>, onOpenSettings: () => void}} options Failed launch action dependencies. */
const handleLaunchFailure = ({
  event,
  action,
  retryableLaunchFailure,
  handleLaunchGame,
  onOpenSettings,
}) => {
  event.preventDefault();
  if (retryableLaunchFailure) {
    void handleLaunchGame();
    logControllerOutcome(action, "details", "handled", {
      reason: "retry-launch",
    });
    return;
  }
  onOpenSettings();
  logControllerOutcome(action, "details", "handled", {
    reason: "open-settings",
  });
};

/** @param {{event: KeyboardEvent, action: ReturnType<typeof getControllerAction>, canPlay: boolean, handleDownloadRom: () => Promise<void>, launchFailure: boolean, launching: boolean, retryableLaunchFailure: boolean, handleLaunchGame: () => Promise<void>, onOpenSettings: () => void, detailsRef: {current: HTMLElement|null}, switchContentSyncing: boolean}} options Enter keyboard dependencies. */
const handleEnterKey = ({
  event,
  action,
  canPlay,
  handleDownloadRom,
  launchFailure,
  launching,
  retryableLaunchFailure,
  handleLaunchGame,
  onOpenSettings,
  detailsRef,
  switchContentSyncing,
}) => {
  const overlay = document.querySelector(INPUT_OVERLAY_SELECTOR);
  if (overlay !== null) {
    if (launchFailure && !launching) {
      handleLaunchFailure({
        action,
        event,
        handleLaunchGame,
        onOpenSettings,
        retryableLaunchFailure,
      });
    } else {
      logControllerOutcome(action, "details", "suppressed", {
        reason: `${overlay.getAttribute("role") ?? "overlay"} open`,
      });
    }
    return;
  }
  const focusedAction = getVisibleDetailsActions(detailsRef.current).find(
    (button) => button === document.activeElement
  );
  if (focusedAction !== undefined && !launching) {
    event.preventDefault();
    focusedAction.click();
    logControllerOutcome(action, "details", "handled", {
      reason: "activate-focused-action",
      targetFocus: describeControllerElement(focusedAction),
    });
    return;
  }
  if (launchFailure && !launching) {
    handleLaunchFailure({
      action,
      event,
      handleLaunchGame,
      onOpenSettings,
      retryableLaunchFailure,
    });
    return;
  }
  if (launching || switchContentSyncing) {
    logControllerOutcome(action, "details", "suppressed", {
      reason: "launch-in-progress",
    });
    return;
  }
  event.preventDefault();
  if (canPlay) {
    void handleLaunchGame();
    logControllerOutcome(action, "details", "handled", {
      reason: "launch-default",
    });
  } else {
    void handleDownloadRom();
    logControllerOutcome(action, "details", "handled", {
      reason: "download-default",
    });
  }
};

/** @param {{event: KeyboardEvent, action: ReturnType<typeof getControllerAction>, launchFailure: boolean, onBack: () => void}} options Escape keyboard dependencies. */
const handleEscapeKey = ({ event, action, launchFailure, onBack }) => {
  if (!launchFailure) {
    logControllerOutcome(action, "details", "ignored", {
      reason: "no-launch-failure",
    });
    return;
  }
  event.preventDefault();
  onBack();
  logControllerOutcome(action, "details", "handled", {
    reason: "return-from-launch-failure",
  });
};

/** @param {{canPlay: boolean, detailsRef: {current: HTMLElement|null}, handleDownloadRom: () => Promise<void>, handleLaunchGame: () => Promise<void>, launchFailure: boolean, launching: boolean, onBack: () => void, onOpenSettings: () => void, primaryActionRef: {current: HTMLButtonElement|null}, retryableLaunchFailure: boolean, switchContentSyncing: boolean}} options Keyboard hook options. */
export const useImmersiveGameDetailsKeyboard = ({
  canPlay,
  detailsRef,
  handleDownloadRom,
  handleLaunchGame,
  launchFailure,
  launching,
  onBack,
  onOpenSettings,
  primaryActionRef,
  retryableLaunchFailure,
  switchContentSyncing,
}) => {
  useEffect(() => {
    /** @param {KeyboardEvent} event Keyboard event. */
    const onWindowKeyDown = (event) => {
      const action = getControllerAction(event);
      const targetIsWindow =
        event.target === window || event.target === event.currentTarget;
      if (!targetIsWindow) {
        logControllerOutcome(action, "details", "ignored", {
          reason: "event-target-not-window",
        });
        return;
      }
      if (event.repeat) {
        logControllerOutcome(action, "details", "suppressed", {
          reason: "keyboard-repeat",
        });
        return;
      }
      if (event.key.startsWith("Arrow")) {
        handleArrowKey({
          action,
          actions: getVisibleDetailsActions(detailsRef.current),
          canPlay,
          event,
          primaryActionRef,
        });
        return;
      }
      if (event.key === "Enter") {
        handleEnterKey({
          action,
          canPlay,
          detailsRef,
          event,
          handleDownloadRom,
          handleLaunchGame,
          launchFailure,
          launching,
          onOpenSettings,
          retryableLaunchFailure,
          switchContentSyncing,
        });
        return;
      }
      if (event.key === "Escape") {
        handleEscapeKey({ action, event, launchFailure, onBack });
      }
    };
    window.addEventListener("keydown", onWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  }, [
    canPlay,
    detailsRef,
    handleDownloadRom,
    handleLaunchGame,
    launchFailure,
    launching,
    onBack,
    onOpenSettings,
    primaryActionRef,
    retryableLaunchFailure,
    switchContentSyncing,
  ]);
};