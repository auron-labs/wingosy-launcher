import { debugLog } from "../utils/debugLog";
import {
  gamepadSummary,
  normalizeGamepadDeadzone,
  readStandardPad,
} from "./gamepad-input";

/**
 * @typedef {{back: boolean, confirmOpen: boolean, down: boolean, left: boolean, menu: boolean, nextSection: boolean, previousSection: boolean, right: boolean, up: boolean, view: boolean}} DigitalState
 * @typedef {{elapsedSincePreviousMs: number|null, phase: string}|null} RepeatTiming
 * @typedef {{key: number, pad: Gamepad, input: {digital: DigitalState, hasInput: boolean, activeAxes: string[], hasUnmappedInput: boolean, pressedButtons: number[]}}} StandardPad
 */

export const getConnectedPads = () => {
  const pads = navigator.getGamepads?.() ?? [];
  return [...pads].flatMap((pad, slot) =>
    pad === null ? [] : [{ key: pad.index ?? slot, pad }]
  );
};

/**
 * @param {{key: number, pad: Gamepad}[]} connectedPads - Connected native pads.
 * @param {ReturnType<typeof gamepadSummary>[]|null} previousSummaries - Previous diagnostic snapshot.
 * @returns {ReturnType<typeof gamepadSummary>[]} Current diagnostic snapshot.
 */
export const logControllerChanges = (connectedPads, previousSummaries) => {
  const currentSummaries = connectedPads.map(gamepadSummary);
  if (previousSummaries === null) {
    if (currentSummaries.length === 0) {
      debugLog("controller", "no controller detected");
    } else {
      for (const summary of currentSummaries) {
        debugLog("controller", "controller connected", summary);
      }
    }
    return currentSummaries;
  }

  if (JSON.stringify(currentSummaries) === JSON.stringify(previousSummaries)) {
    return currentSummaries;
  }

  const previousByIndex = new Map(
    previousSummaries.map((summary) => [summary.index, summary])
  );
  const currentByIndex = new Map(
    currentSummaries.map((summary) => [summary.index, summary])
  );
  for (const summary of currentSummaries) {
    const previous = previousByIndex.get(summary.index);
    if (previous === undefined) {
      debugLog("controller", "controller connected", summary);
    } else if (JSON.stringify(previous) !== JSON.stringify(summary)) {
      debugLog("controller", "controller changed at same index", {
        current: summary,
        index: summary.index,
        previous,
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
  return currentSummaries;
};

/**
 * @param {{key: number, pad: Gamepad}[]} connectedPads - Connected native pads.
 * @param {number} deadzone - Stick deadzone.
 * @param {boolean} includeDiagnostics - Whether to include unsupported-input details.
 * @returns {StandardPad[]} Standard-layout pads with decoded input.
 */
export const getStandardPads = (connectedPads, deadzone, includeDiagnostics) =>
  connectedPads
    .filter(({ pad }) => pad.mapping === "standard")
    .map((entry) => ({
      ...entry,
      input: readStandardPad(
        entry.pad,
        normalizeGamepadDeadzone(deadzone),
        includeDiagnostics
      ),
    }));

/**
 * @param {StandardPad[]} standardPads - Standard pads with current input.
 * @param {string} previousSignature - Previous diagnostic signature.
 * @param {boolean} debugEnabled - Whether to emit diagnostics.
 * @returns {{signature: string, inputs: {activeAxes: string[], index: number, pressedButtons: number[]}[]}} Diagnostic snapshot and input records.
 */
export const getUnmappedInputDiagnostics = (
  standardPads,
  previousSignature,
  debugEnabled
) => {
  if (!debugEnabled) {
    return { inputs: [], signature: previousSignature };
  }
  const inputs = standardPads
    .filter(({ input }) => input.hasUnmappedInput)
    .map(({ key, input }) => ({
      activeAxes: input.activeAxes,
      index: key,
      pressedButtons: input.pressedButtons,
    }));
  const signature = JSON.stringify(inputs);
  if (signature !== previousSignature && inputs.length > 0) {
    debugLog("controller", "unsupported/unmapped input", { pads: inputs });
  }
  return { inputs, signature };
};

/**
 * @param {DigitalState} digital - Current digital state.
 * @param {DigitalState} previous - Previous digital state.
 * @param {number} controllerIndex - Owning controller index.
 * @param {(key: string, wasHeld: boolean) => RepeatTiming} canFire - Repeat gate.
 * @param {(key: string, controllerIndex: number, timing: RepeatTiming, defer?: boolean) => void} dispatch - Action dispatcher.
 */
export const dispatchPadActions = (
  digital,
  previous,
  controllerIndex,
  canFire,
  dispatch
) => {
  /** @type {[boolean, boolean, string][]} */
  const edgeActions = [
    [digital.confirmOpen, previous.confirmOpen, "Enter"],
    [digital.back, previous.back, "Escape"],
    [digital.previousSection, previous.previousSection, "PageUp"],
    [digital.nextSection, previous.nextSection, "PageDown"],
    [digital.menu, previous.menu, "s"],
    [digital.view, previous.view, "h"],
  ];
  const confirmPressed = digital.confirmOpen && !previous.confirmOpen;
  for (const [pressed, wasPressed, key] of edgeActions) {
    if (pressed && !wasPressed) {
      dispatch(key, controllerIndex, null);
    }
  }

  /** @type {[boolean, boolean, string][]} */
  const navigationActions = [
    [digital.up, previous.up, "ArrowUp"],
    [digital.down, previous.down, "ArrowDown"],
    [digital.left, previous.left, "ArrowLeft"],
    [digital.right, previous.right, "ArrowRight"],
  ];
  for (const [pressed, wasPressed, key] of navigationActions) {
    if (pressed) {
      const timing = canFire(key, wasPressed);
      if (timing !== null) {
        dispatch(key, controllerIndex, timing, confirmPressed);
      }
    }
  }
};
