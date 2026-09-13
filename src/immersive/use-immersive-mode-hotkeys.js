import { useEffect } from "react";

import {
  getControllerAction,
  isTextInputTarget,
  logControllerOutcome,
} from "./controller-debug";

const OVERLAY_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

/** @param {KeyboardEvent} event Keyboard event. @returns {string|null} Suppression reason. */
const getSuppressionReason = (event) => {
  const overlay = document.querySelector(OVERLAY_SELECTOR);
  if (overlay !== null) {
    return `${overlay.getAttribute("role") ?? "overlay"} open`;
  }
  if (event.target instanceof Element) {
    const targetOverlay = event.target.closest(OVERLAY_SELECTOR);
    if (targetOverlay !== null) {
      return `${targetOverlay.getAttribute("role") ?? "overlay"} open`;
    }
  }
  return null;
};

/** @param {{event: KeyboardEvent, view: string, setView: (view: string) => void, loadData: () => Promise<unknown>, handleExit: () => Promise<void>}} options Escape handling options. */
const handleEscape = ({ event, view, setView, loadData, handleExit }) => {
  if (event.repeat) {
    logControllerOutcome(getControllerAction(event), "shell", "suppressed", {
      reason: "keyboard-repeat",
    });
    return;
  }
  event.preventDefault();
  if (view === "details") {
    setView("library");
    logControllerOutcome(getControllerAction(event), "shell", "handled", {
      reason: "return-to-library",
    });
    return;
  }
  if (view === "settings") {
    setView("library");
    void loadData();
    logControllerOutcome(getControllerAction(event), "shell", "handled", {
      reason: "return-to-library",
    });
    return;
  }
  if (view === "downloads") {
    setView("library");
    logControllerOutcome(getControllerAction(event), "shell", "handled", {
      reason: "return-to-library",
    });
    return;
  }
  void handleExit();
  logControllerOutcome(getControllerAction(event), "shell", "handled", {
    reason: "exit-immersive",
  });
};

/** @param {{event: KeyboardEvent, setShowHints: (update: boolean|((previous: boolean) => boolean)) => void, toggleFullscreen: () => Promise<void>}} options Shell action options. */
const handleShellAction = ({ event, setShowHints, toggleFullscreen }) => {
  if (event.key === "F11") {
    event.preventDefault();
    void toggleFullscreen();
    return true;
  }
  if (event.key === "h" || event.key === "H") {
    event.preventDefault();
    setShowHints((visible) => !visible);
    logControllerOutcome(getControllerAction(event), "shell", "handled", {
      reason: "toggle-hints",
    });
    return true;
  }
  return false;
};

/** @param {{event: KeyboardEvent, view: string, setView: (view: string) => void, loadData: () => Promise<unknown>, handleExit: () => Promise<void>, setShowHints: (update: boolean|((previous: boolean) => boolean)) => void, toggleFullscreen: () => Promise<void>}} options Key handling options. */
const handleShellKey = (options) => {
  const { event } = options;
  const action = getControllerAction(event);
  if (isTextInputTarget(event.target)) {
    logControllerOutcome(action, "shell", "suppressed", {
      reason: "text-input-focused",
    });
    return;
  }
  const suppressionReason = getSuppressionReason(event);
  if (suppressionReason !== null) {
    logControllerOutcome(action, "shell", "suppressed", {
      reason: suppressionReason,
    });
    return;
  }
  if (handleShellAction(options)) {
    return;
  }
  if (event.key === "Escape") {
    handleEscape(options);
    return;
  }
  if (action !== null) {
    logControllerOutcome(action, "shell", "ignored", {
      reason: "not-shell-action",
    });
  }
};

/** @param {{view: string, setView: (view: string) => void, loadData: () => Promise<unknown>, handleExit: () => Promise<void>, setShowHints: (update: boolean|((previous: boolean) => boolean)) => void, toggleFullscreen: () => Promise<void>}} options Hotkey options. */
export const useImmersiveModeHotkeys = (options) => {
  useEffect(() => {
    /** @param {KeyboardEvent} event Keyboard event. */
    const onKeyDown = (event) => {
      handleShellKey({ ...options, event });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [options]);
};
