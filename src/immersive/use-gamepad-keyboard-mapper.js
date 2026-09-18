import { useEffect, useRef, useState } from "react";

import { debugLog, isVerboseDebugEnabled } from "../utils/debug-log";
import { attachControllerAction } from "./controller-debug";
import { DEFAULT_GAMEPAD_DEADZONE, emptyDigital } from "./gamepad-input";
import {
  dispatchPadActions,
  getConnectedPads,
  getStandardPads,
  getUnmappedInputDiagnostics,
  logControllerChanges,
} from "./gamepad-polling";

export {
  DEFAULT_GAMEPAD_DEADZONE,
  GAMEPAD_DEADZONE_MAX,
  GAMEPAD_DEADZONE_MIN,
  gamepadSummary,
  emptyDigital,
  normalizeGamepadDeadzone,
  readStandardPad,
} from "./gamepad-input";

/**
 * @typedef {{back: boolean, confirmOpen: boolean, down: boolean, left: boolean, menu: boolean, nextSection: boolean, previousSection: boolean, right: boolean, up: boolean, view: boolean}} DigitalState
 * @typedef {{key: number, pad: Gamepad, input: {digital: DigitalState, hasInput: boolean, activeAxes: string[], hasUnmappedInput: boolean, pressedButtons: number[]}}} StandardPad
 * @typedef {{actionId: number, controllerIndex: number, deferred: boolean, elapsedSincePreviousMs: number|null, key: string, phase: string}} ControllerAction
 * @typedef {(key: string, action: ControllerAction|null) => void} ControllerActionCallback
 * @typedef {{at: number, repeating: boolean}} RepeatState
 * @typedef {{elapsedSincePreviousMs: number|null, phase: string}|null} RepeatTiming
 */

/** Maps logical keys to `code` for closer-to-real keyboard events (WebView / MUI). */
/** @type {Record<string, string>} */
const KEY_TO_CODE = {
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  ArrowUp: "ArrowUp",
  Enter: "Enter",
  Escape: "Escape",
  H: "KeyH",
  PageDown: "PageDown",
  PageUp: "PageUp",
  S: "KeyS",
  h: "KeyH",
  s: "KeyS",
};

/** @param {string} key @param {ControllerAction|null} [action] */
export const buildControllerKeydown = (key, action = null) => {
  const code = KEY_TO_CODE[key] ?? "";
  /** @type {KeyboardEventInit & {code?: string}} */
  const options = { bubbles: true, cancelable: true, key };
  if (code !== "") {
    options.code = code;
  }
  return attachControllerAction(new KeyboardEvent("keydown", options), action);
};

/**
 * @param {string} key - Logical key to dispatch.
 * @param {boolean} [deferUntilNextFrame] - Defer action delivery until the next frame.
 * @param {ControllerAction|null} [action] - Debug action metadata.
 * @param {{current: ControllerActionCallback|null}|null} [onControllerActionRef] - App action callback reference.
 */
const dispatchKey = (
  key,
  deferUntilNextFrame = false,
  action = null,
  onControllerActionRef = null
) => {
  if (deferUntilNextFrame) {
    requestAnimationFrame(() => {
      dispatchKey(key, false, action, onControllerActionRef);
    });
    return;
  }
  if (action) {
    debugLog("controller", "recognized input/action", { ...action });
  }
  const onControllerAction = onControllerActionRef?.current;
  if (onControllerAction) {
    onControllerAction(key, action);
    return;
  }
  try {
    window.dispatchEvent(buildControllerKeydown(key, action));
  } catch {
    // Ignore a detached DOM target during teardown.
  }
};

/**
 * @typedef {{activePadKey: {current: number|null}, actionSequence: {current: number}, blockedPadKey: {current: number|null}, connectedPads: {current: ReturnType<typeof import("./gamepad-input").gamepadSummary>[]|null}, lastDigital: {current: ReturnType<typeof emptyDigital>}, raf: {current: number}, repeatState: {current: Map<string, RepeatState>}, unmappedInput: {current: string}, unsupportedGamepad: {current: boolean}}} MapperRefs
 */

/** @param {MapperRefs} refs Mapper state references. */
const resetMapperState = (refs) => {
  refs.activePadKey.current = null;
  refs.blockedPadKey.current = null;
  refs.lastDigital.current = emptyDigital();
  refs.repeatState.current.clear();
};

/** @param {MapperRefs} refs Controller tracking references. */
const resetControllerTracking = (refs) => {
  refs.connectedPads.current = null;
  refs.unmappedInput.current = "";
};

/** @param {MapperRefs} refs @param {boolean} debugEnabled @param {(value: boolean) => void} setUnsupportedGamepad */
const createUnsupportedUpdater =
  (refs, debugEnabled, setUnsupportedGamepad) =>
  /** @param {boolean} value Updated unsupported-controller state. */
  (value) => {
    if (refs.unsupportedGamepad.current === value) {
      return;
    }
    refs.unsupportedGamepad.current = value;
    setUnsupportedGamepad(value);
    if (debugEnabled) {
      debugLog(
        "controller",
        value
          ? "unsupported/unmapped controller: no standard mapping available"
          : "controller mapping available or no controller connected",
        { unsupported: value }
      );
    }
  };

/** @param {MapperRefs} refs @param {number} repeatDelayMs @param {number} repeatRateMs @returns {(key: string, wasHeld: boolean) => RepeatTiming} */
const createRepeatGate = (refs, repeatDelayMs, repeatRateMs) =>
  /** @param {string} key @param {boolean} wasHeld */
  function getRepeatTiming(key, wasHeld) {
    const now = Date.now();
    const previous = refs.repeatState.current.get(key);
    if (!wasHeld || !previous) {
      refs.repeatState.current.set(key, { at: now, repeating: false });
      return { elapsedSincePreviousMs: null, phase: "edge" };
    }
    const min = previous.repeating ? repeatRateMs : repeatDelayMs;
    const elapsedSincePreviousMs = now - previous.at;
    if (elapsedSincePreviousMs < min) {
      return null;
    }
    refs.repeatState.current.set(key, { at: now, repeating: true });
    return { elapsedSincePreviousMs, phase: "repeat" };
  };

/** @param {MapperRefs} refs @param {boolean} debugEnabled @param {{current: ControllerActionCallback|null}} onControllerActionRef @returns {(key: string, controllerIndex: number, timing: RepeatTiming, deferUntilNextFrame?: boolean) => void} */
const createControllerDispatcher =
  (refs, debugEnabled, onControllerActionRef) =>
  (key, controllerIndex, timing, deferUntilNextFrame = false) => {
    const action = debugEnabled
      ? {
          actionId: (refs.actionSequence.current += 1),
          controllerIndex,
          deferred: deferUntilNextFrame,
          elapsedSincePreviousMs: timing?.elapsedSincePreviousMs ?? null,
          key,
          phase: timing?.phase ?? "edge",
        }
      : null;
    dispatchKey(key, deferUntilNextFrame, action, onControllerActionRef);
  };

/** @param {{deadzone: number, debugEnabled: boolean, refs: MapperRefs, updateUnsupported: (value: boolean) => void, canFire: (key: string, wasHeld: boolean) => RepeatTiming, dispatchControllerAction: (key: string, controllerIndex: number, timing: RepeatTiming, deferUntilNextFrame?: boolean) => void}} options @returns {() => void} A scheduled gamepad polling callback. */
const createGamepadTick = ({
  deadzone,
  debugEnabled,
  refs,
  updateUnsupported,
  canFire,
  dispatchControllerAction,
}) => {
  const tick = () => {
    const connectedPads = getConnectedPads();
    if (debugEnabled) {
      refs.connectedPads.current = logControllerChanges(
        connectedPads,
        refs.connectedPads.current
      );
    }
    const standardPads = getStandardPads(connectedPads, deadzone, debugEnabled);
    updateUnsupported(connectedPads.length > 0 && standardPads.length === 0);
    const unmappedDiagnostics = getUnmappedInputDiagnostics(
      standardPads,
      refs.unmappedInput.current,
      debugEnabled
    );
    refs.unmappedInput.current = unmappedDiagnostics.signature;

    const active =
      standardPads.find(({ key }) => key === refs.activePadKey.current) ?? null;
    const disconnectedPadKey = refs.activePadKey.current;
    if (active === null && disconnectedPadKey !== null) {
      resetMapperState(refs);
      refs.blockedPadKey.current = disconnectedPadKey;
    }
    const blocked = standardPads.find(
      ({ key }) => key === refs.blockedPadKey.current
    );
    if (blocked !== undefined && !blocked.input.hasInput) {
      refs.blockedPadKey.current = null;
    }
    const producing = standardPads.filter(
      ({ key, input }) => input.hasInput && key !== refs.blockedPadKey.current
    );
    /** @type {StandardPad|null} */
    const selected = active ?? producing.at(-1) ?? null;
    if (selected === null) {
      refs.raf.current = requestAnimationFrame(tick);
      return;
    }
    if (debugEnabled && refs.activePadKey.current !== selected.key) {
      debugLog("controller", "controller input owner selected", {
        index: selected.key,
      });
    }
    refs.activePadKey.current = selected.key;
    dispatchPadActions(
      selected.input.digital,
      refs.lastDigital.current,
      selected.key,
      canFire,
      dispatchControllerAction
    );
    refs.lastDigital.current = selected.input.digital;
    refs.raf.current = requestAnimationFrame(tick);
  };
  return tick;
};

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
/**
 * @param {{enabled?: boolean, repeatDelayMs?: number, repeatRateMs?: number, deadzone?: number, onControllerAction?: ControllerActionCallback|null}} [options] - Mapper options.
 */
export const useGamepadKeyboardMapper = ({
  enabled = true,
  repeatDelayMs = 240,
  repeatRateMs = 110,
  deadzone = DEFAULT_GAMEPAD_DEADZONE,
  onControllerAction = null,
} = {}) => {
  const rafRef = useRef(0);
  /** @type {Map<string, RepeatState>} */
  const initialRepeatState = new Map();
  /** @type {number|null} */
  const initialActivePadKey = null;
  /** @type {number|null} */
  const initialBlockedPadKey = null;
  /** @type {ReturnType<typeof import("./gamepad-input").gamepadSummary>[]|null} */
  const initialConnectedPads = null;
  const repeatState = useRef(initialRepeatState);
  const activePadKey = useRef(initialActivePadKey);
  const blockedPadKey = useRef(initialBlockedPadKey);
  const unsupportedGamepadRef = useRef(false);
  const [unsupportedGamepad, setUnsupportedGamepad] = useState(false);
  const lastDigital = useRef(emptyDigital());
  const connectedPadsRef = useRef(initialConnectedPads);
  const unmappedInputRef = useRef("");
  const actionSequenceRef = useRef(0);
  /** @type {{current: ControllerActionCallback|null}} */
  const onControllerActionRef = useRef(onControllerAction);
  useEffect(() => {
    onControllerActionRef.current = onControllerAction;
  }, [onControllerAction]);

  useEffect(() => {
    /** @type {MapperRefs} */
    const refs = {
      actionSequence: actionSequenceRef,
      activePadKey,
      blockedPadKey,
      connectedPads: connectedPadsRef,
      lastDigital,
      raf: rafRef,
      repeatState,
      unmappedInput: unmappedInputRef,
      unsupportedGamepad: unsupportedGamepadRef,
    };
    if (!enabled) {
      resetMapperState(refs);
      resetControllerTracking(refs);
      if (unsupportedGamepadRef.current) {
        unsupportedGamepadRef.current = false;
        setUnsupportedGamepad(false);
      }
      return () => {
        resetMapperState(refs);
      };
    }
    const debugEnabled = isVerboseDebugEnabled();
    const updateUnsupported = createUnsupportedUpdater(
      refs,
      debugEnabled,
      setUnsupportedGamepad
    );
    const canFire = createRepeatGate(refs, repeatDelayMs, repeatRateMs);
    const dispatchControllerAction = createControllerDispatcher(
      refs,
      debugEnabled,
      onControllerActionRef
    );
    const tick = createGamepadTick({
      canFire,
      deadzone,
      debugEnabled,
      dispatchControllerAction,
      refs,
      updateUnsupported,
    });
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      resetMapperState(refs);
    };
  }, [deadzone, enabled, repeatDelayMs, repeatRateMs]);

  return { unsupportedGamepad };
};
