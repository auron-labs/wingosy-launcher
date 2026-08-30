import { useEffect, useRef, useState } from "react";
import { debugLog, isVerboseDebugEnabled } from "../utils/debugLog";
import {
  attachControllerAction,
  describeControllerElement,
} from "./controllerDebug";

export const DEFAULT_GAMEPAD_DEADZONE = 0.35;
export const GAMEPAD_DEADZONE_MIN = 0.1;
export const GAMEPAD_DEADZONE_MAX = 0.8;
const MAPPED_GAMEPAD_BUTTONS = new Set([0, 1, 4, 5, 8, 9, 12, 13, 14, 15]);
const LIBRARY_ACTION_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
  "PageUp",
  "PageDown",
  "s",
  "S",
]);
const DETAILS_ACTION_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
  "Escape",
]);
const SHELL_ACTION_KEYS = new Set(["Escape", "h", "H"]);

export function normalizeGamepadDeadzone(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_GAMEPAD_DEADZONE;
  return Math.max(GAMEPAD_DEADZONE_MIN, Math.min(GAMEPAD_DEADZONE_MAX, numeric));
}

function axisToDir(value, deadzone) {
  const v = Math.max(-1, Math.min(1, Number(value) || 0));
  if (v <= -deadzone) return -1;
  if (v >= deadzone) return 1;
  return 0;
}

function emptyDigital() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    confirmOpen: false,
    back: false,
    previousSection: false,
    nextSection: false,
    menu: false,
    view: false,
  };
}

function readStandardPad(pad, deadzone, includeDiagnostics = false) {
  const buttons = pad.buttons || [];
  const axes = pad.axes || [];
  const digital = {
    up: Boolean(buttons[12]?.pressed) || axisToDir(axes[1], deadzone) === -1,
    down: Boolean(buttons[13]?.pressed) || axisToDir(axes[1], deadzone) === 1,
    left: Boolean(buttons[14]?.pressed) || axisToDir(axes[0], deadzone) === -1,
    right: Boolean(buttons[15]?.pressed) || axisToDir(axes[0], deadzone) === 1,
    confirmOpen: Boolean(buttons[0]?.pressed),
    back: Boolean(buttons[1]?.pressed),
    previousSection: Boolean(buttons[4]?.pressed),
    nextSection: Boolean(buttons[5]?.pressed),
    view: Boolean(buttons[8]?.pressed),
    menu: Boolean(buttons[9]?.pressed),
  };
  const result = {
    digital,
    hasInput: Object.values(digital).some(Boolean),
  };

  if (!includeDiagnostics) return result;

  const pressedButtons = Array.from(buttons)
    .map((button, index) => (button?.pressed ? index : null))
    .filter((index) => index !== null);
  const activeAxisValues = Array.from(axes)
    .map((value, index) => {
      const numeric = Number(value) || 0;
      return Math.abs(numeric) >= deadzone ? { index, numeric } : null;
    })
    .filter(Boolean);
  // Keep the diagnostic signature stable while an unsupported axis is held.
  const activeAxes = activeAxisValues.map(
    ({ index, numeric }) => `${index}:${numeric < 0 ? "-" : "+"}`,
  );

  return {
    ...result,
    hasUnmappedInput:
      pressedButtons.some((index) => !MAPPED_GAMEPAD_BUTTONS.has(index)) ||
      activeAxisValues.some(({ index }) => index > 1),
    pressedButtons,
    activeAxes,
  };
}

function gamepadSummary({ key, pad }) {
  return {
    index: key,
    id: typeof pad.id === "string" && pad.id ? pad.id.slice(0, 120) : "(unnamed)",
    mapping: pad.mapping || "unmapped",
    buttons: pad.buttons?.length || 0,
    axes: pad.axes?.length || 0,
  };
}

/** Maps logical keys to `code` for closer-to-real keyboard events (WebView / MUI). */
const KEY_TO_CODE = {
  Escape: "Escape",
  Enter: "Enter",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  PageUp: "PageUp",
  PageDown: "PageDown",
  s: "KeyS",
  S: "KeyS",
  h: "KeyH",
  H: "KeyH",
};

function buildKeydown(key, action = null) {
  const code = KEY_TO_CODE[key] || "";
  return attachControllerAction(new KeyboardEvent("keydown", {
    key,
    ...(code ? { code } : {}),
    bubbles: true,
    cancelable: true,
  }), action);
}

function expectedTargetFor(key, hasLibrary, hasDetails) {
  if (hasDetails && DETAILS_ACTION_KEYS.has(key)) return "details-window";
  if (hasLibrary && LIBRARY_ACTION_KEYS.has(key)) return "library-root";
  if (LIBRARY_ACTION_KEYS.has(key)) return "library-root";
  if (SHELL_ACTION_KEYS.has(key)) return "window";
  return null;
}

function dispatchKey(key, deferUntilNextFrame = false, debugEnabled = false, action = null) {
  if (deferUntilNextFrame) {
    requestAnimationFrame(() => dispatchKey(key, false, debugEnabled, action));
    return;
  }

  if (action) {
    debugLog("controller", "recognized input/action", {
      ...action,
    });
  }

  try {
    const menu = document.querySelector('[role="menu"]');
    if (menu) {
      // MUI's menu keyboard handling is attached to the focused menu item/list, not window.
      const activeElement = document.activeElement;
      const target = activeElement && menu.contains(activeElement) ? activeElement : menu;
      const dispatchResult = target.dispatchEvent(buildKeydown(key, action));
      if (action) {
        debugLog("controller", "action routed", {
          ...action,
          expectedTarget: "menu",
          expectedTargetMissing: false,
          destinations: [{
            type: target === menu ? "menu" : "menu-item",
            element: describeControllerElement(target),
          }],
          defaultPrevented: !dispatchResult,
        });
      }
      return;
    }

    const details = document.querySelector('[data-testid="immersive-game-details"]');
    const destinations = action ? [{ type: "window" }] : null;
    const evt = buildKeydown(key, action);
    // Shell routing (Escape, hints, launch) listens on `window` in `ImmersiveModeApp`.
    const windowDispatchResult = window.dispatchEvent(evt);
    // Library grid listens on its root `[data-testid="immersive-library"]`, not on `window`.
    const lib = document.querySelector('[data-testid="immersive-library"]');
    if (
      lib &&
      LIBRARY_ACTION_KEYS.has(key)
    ) {
      const libraryDispatchResult = lib.dispatchEvent(buildKeydown(key, action));
      if (destinations) {
        destinations.push({ type: "library-root", element: describeControllerElement(lib) });
        destinations[destinations.length - 1].defaultPrevented = !libraryDispatchResult;
      }
    }
    if (action) {
      const expectedTarget = expectedTargetFor(key, Boolean(lib), Boolean(details));
      const expectedTargetMissing =
        expectedTarget === "library-root"
          ? !lib
          : expectedTarget === "details-window"
            ? !details
            : expectedTarget === null;
      debugLog("controller", "action routed", {
        ...action,
        expectedTarget,
        expectedTargetMissing,
        destinations: destinations.map((destination) => ({
          ...destination,
          defaultPrevented:
            destination.type === "window" ? !windowDispatchResult : destination.defaultPrevented,
        })),
      });
    }
  } catch {
    // ignore
  }
}

/**
 * Minimal "Big Picture" style controller mapping by translating gamepad input to existing keyboard handlers.
 *
 * Standard-layout intents:
 * - Directional navigation: D-pad / left stick -> Arrow keys
 * - Confirm/Open: South -> Enter
 * - Back: East -> Escape
 * - Sections: LB/RB -> PageUp/PageDown
 * - Menu: Start -> "s" (open settings in library)
 * - View: Back/View -> "h" (toggle on-screen help/hints)
 */
export function useGamepadKeyboardMapper({
  enabled = true,
  // used to prevent repeating navigation too fast
  repeatDelayMs = 240,
  repeatRateMs = 110,
  deadzone = DEFAULT_GAMEPAD_DEADZONE,
} = {}) {
  const rafRef = useRef(0);
  const repeatState = useRef(new Map());
  const activePadKey = useRef(null);
  const blockedPadKey = useRef(null);
  const unsupportedGamepadRef = useRef(false);
  const [unsupportedGamepad, setUnsupportedGamepad] = useState(false);
  const lastDigital = useRef(emptyDigital());
  const connectedPadsRef = useRef(null);
  const unmappedInputRef = useRef("");
  const actionSequenceRef = useRef(0);

  useEffect(() => {
    function resetInputState() {
      activePadKey.current = null;
      blockedPadKey.current = null;
      lastDigital.current = emptyDigital();
      repeatState.current.clear();
    }

    if (!enabled) {
      resetInputState();
      connectedPadsRef.current = null;
      unmappedInputRef.current = "";
      if (unsupportedGamepadRef.current) {
        unsupportedGamepadRef.current = false;
        setUnsupportedGamepad(false);
      }
      return undefined;
    }
    const debugEnabled = isVerboseDebugEnabled();

    function updateUnsupportedGamepad(value) {
      if (unsupportedGamepadRef.current === value) return;
      unsupportedGamepadRef.current = value;
      setUnsupportedGamepad(value);
      if (debugEnabled) {
        debugLog(
          "controller",
          value
            ? "unsupported/unmapped controller: no standard mapping available"
            : "controller mapping available or no controller connected",
          { unsupported: value },
        );
      }
    }

    function canFire(key, wasHeld) {
      const now = Date.now();
      const previous = repeatState.current.get(key);
      if (!wasHeld || !previous) {
        repeatState.current.set(key, { at: now, repeating: false });
        return { phase: "edge", elapsedSincePreviousMs: null };
      }
      const min = previous.repeating ? repeatRateMs : repeatDelayMs;
      const elapsedSincePreviousMs = now - previous.at;
      if (elapsedSincePreviousMs < min) return null;
      repeatState.current.set(key, { at: now, repeating: true });
      return { phase: "repeat", elapsedSincePreviousMs };
    }

    function dispatchControllerAction(key, controllerIndex, timing, deferUntilNextFrame = false) {
      const action = debugEnabled
        ? {
            actionId: ++actionSequenceRef.current,
            key,
            controllerIndex,
            phase: timing?.phase || "edge",
            elapsedSincePreviousMs: timing?.elapsedSincePreviousMs ?? null,
            deferred: deferUntilNextFrame,
          }
        : null;
      dispatchKey(key, deferUntilNextFrame, debugEnabled, action);
    }

    function tick() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const connectedPads = Array.from(pads || [])
        .map((pad, slot) => (pad ? { key: pad.index ?? slot, pad } : null))
        .filter(Boolean);
      if (debugEnabled) {
        const currentSummaries = connectedPads.map(gamepadSummary);
        const previousSummaries = connectedPadsRef.current;
        if (previousSummaries === null) {
          if (currentSummaries.length === 0) {
            debugLog("controller", "no controller detected");
          } else {
            for (const summary of currentSummaries) {
              debugLog("controller", "controller connected", summary);
            }
          }
        } else if (JSON.stringify(currentSummaries) !== JSON.stringify(previousSummaries)) {
          const previousByIndex = new Map(previousSummaries.map((summary) => [summary.index, summary]));
          const currentByIndex = new Map(currentSummaries.map((summary) => [summary.index, summary]));
          for (const summary of currentSummaries) {
            const previous = previousByIndex.get(summary.index);
            if (!previous) {
              debugLog("controller", "controller connected", summary);
            } else if (JSON.stringify(previous) !== JSON.stringify(summary)) {
              debugLog("controller", "controller changed at same index", {
                index: summary.index,
                previous,
                current: summary,
              });
            }
          }
          for (const summary of previousSummaries) {
            if (!currentByIndex.has(summary.index)) {
              debugLog("controller", "controller disconnected", summary);
            }
          }
          if (currentSummaries.length === 0) {
            debugLog("controller", "no controller detected");
          }
        }
        connectedPadsRef.current = currentSummaries;
      }

      const standardPads = connectedPads
        .filter(({ pad }) => pad.mapping === "standard")
        .map((entry) => ({
          ...entry,
          input: readStandardPad(entry.pad, normalizeGamepadDeadzone(deadzone), debugEnabled),
        }));
      updateUnsupportedGamepad(connectedPads.length > 0 && standardPads.length === 0);

      if (debugEnabled) {
        const unmappedInputs = standardPads
          .filter(({ input }) => input.hasUnmappedInput)
          .map(({ key, input }) => ({
            index: key,
            pressedButtons: input.pressedButtons,
            activeAxes: input.activeAxes,
          }));
        const unmappedSignature = JSON.stringify(unmappedInputs);
        if (unmappedSignature !== unmappedInputRef.current) {
          unmappedInputRef.current = unmappedSignature;
          if (unmappedInputs.length > 0) {
            debugLog("controller", "unsupported/unmapped input", { pads: unmappedInputs });
          }
        }
      }

      const active = standardPads.find(({ key }) => key === activePadKey.current) || null;
      const disconnectedPadKey = activePadKey.current;
      if (!active && disconnectedPadKey !== null) {
        resetInputState();
        blockedPadKey.current = disconnectedPadKey;
      }

      const blocked = standardPads.find(({ key }) => key === blockedPadKey.current);
      if (blocked && !blocked.input.hasInput) blockedPadKey.current = null;

      // Poll all standard pads, but route one owner's input so two pads cannot duplicate actions.
      const producing = standardPads.filter(
        ({ key, input }) => input.hasInput && key !== blockedPadKey.current,
      );
      const selected = active || producing.at(-1) || null;
      if (!selected) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (debugEnabled && activePadKey.current !== selected.key) {
        debugLog("controller", "controller input owner selected", { index: selected.key });
      }
      activePadKey.current = selected.key;
      const digital = selected.input.digital;

      const prev = lastDigital.current;
      const confirmPressed = digital.confirmOpen && !prev.confirmOpen;

      // Edge-triggered intents
      if (confirmPressed) dispatchControllerAction("Enter", selected.key, null);
      if (digital.back && !prev.back) dispatchControllerAction("Escape", selected.key, null);
      if (digital.previousSection && !prev.previousSection) {
        dispatchControllerAction("PageUp", selected.key, null);
      }
      if (digital.nextSection && !prev.nextSection) {
        dispatchControllerAction("PageDown", selected.key, null);
      }
      if (digital.menu && !prev.menu) dispatchControllerAction("s", selected.key, null);
      if (digital.view && !prev.view) dispatchControllerAction("h", selected.key, null);

      // Held navigation (dpad/stick)
      // Let a route opened by Confirm mount before delivering same-frame navigation.
      if (digital.up) {
        const timing = canFire("ArrowUp", prev.up);
        if (timing) dispatchControllerAction("ArrowUp", selected.key, timing, confirmPressed);
      }
      if (digital.down) {
        const timing = canFire("ArrowDown", prev.down);
        if (timing) dispatchControllerAction("ArrowDown", selected.key, timing, confirmPressed);
      }
      if (digital.left) {
        const timing = canFire("ArrowLeft", prev.left);
        if (timing) dispatchControllerAction("ArrowLeft", selected.key, timing, confirmPressed);
      }
      if (digital.right) {
        const timing = canFire("ArrowRight", prev.right);
        if (timing) dispatchControllerAction("ArrowRight", selected.key, timing, confirmPressed);
      }

      lastDigital.current = digital;
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      resetInputState();
    };
  }, [deadzone, enabled, repeatDelayMs, repeatRateMs]);

  return { unsupportedGamepad };
}
