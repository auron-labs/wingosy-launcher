export const DEFAULT_GAMEPAD_DEADZONE = 0.35;
export const GAMEPAD_DEADZONE_MIN = 0.1;
export const GAMEPAD_DEADZONE_MAX = 0.8;

const MAPPED_GAMEPAD_BUTTONS = new Set([0, 1, 4, 5, 8, 9, 12, 13, 14, 15]);

/**
 * @typedef {{back: boolean, confirmOpen: boolean, down: boolean, left: boolean, menu: boolean, nextSection: boolean, previousSection: boolean, right: boolean, up: boolean, view: boolean}} DigitalState
 * @typedef {{digital: DigitalState, hasInput: boolean, activeAxes: string[], hasUnmappedInput: boolean, pressedButtons: number[]}} PadInput
 */

/** @param {unknown} value - Candidate deadzone value. */
export const normalizeGamepadDeadzone = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_GAMEPAD_DEADZONE;
  }
  return Math.max(
    GAMEPAD_DEADZONE_MIN,
    Math.min(GAMEPAD_DEADZONE_MAX, numeric)
  );
};

/** @param {number|undefined} value - Axis value. @param {number} deadzone - Stick deadzone. */
const axisToDir = (value, deadzone) => {
  const bounded = value ?? 0;
  if (bounded <= -deadzone) {
    return -1;
  }
  if (bounded >= deadzone) {
    return 1;
  }
  return 0;
};

/** @param {GamepadButton[]} buttons @param {number} index @returns {boolean} */
const isPressed = (buttons, index) => buttons[index]?.pressed ?? false;

/** @param {number[]} axes @param {number} index @param {number} direction @param {number} deadzone @returns {boolean} */
const axisPressed = (axes, index, direction, deadzone) =>
  axisToDir(axes[index], deadzone) === direction;

export const emptyDigital = () => ({
  back: false,
  confirmOpen: false,
  down: false,
  left: false,
  menu: false,
  nextSection: false,
  previousSection: false,
  right: false,
  up: false,
  view: false,
});

/** @param {GamepadButton[]} buttons @param {number[]} axes @param {number} deadzone @returns {DigitalState} */
const readDigital = (buttons, axes, deadzone) => ({
  back: isPressed(buttons, 1),
  confirmOpen: isPressed(buttons, 0),
  down: isPressed(buttons, 13) || axisPressed(axes, 1, 1, deadzone),
  left: isPressed(buttons, 14) || axisPressed(axes, 0, -1, deadzone),
  menu: isPressed(buttons, 9),
  nextSection: isPressed(buttons, 5),
  previousSection: isPressed(buttons, 4),
  right: isPressed(buttons, 15) || axisPressed(axes, 0, 1, deadzone),
  up: isPressed(buttons, 12) || axisPressed(axes, 1, -1, deadzone),
  view: isPressed(buttons, 8),
});

/** @param {GamepadButton[]} buttons @param {number[]} axes @param {number} deadzone @returns {{activeAxes: string[], hasUnmappedInput: boolean, pressedButtons: number[]}} */
const readDiagnostics = (buttons, axes, deadzone) => {
  const pressedButtons = buttons
    .map((button, index) => (button.pressed ? index : null))
    .filter((index) => index !== null);
  const activeAxisValues = axes
    .map((numeric, index) =>
      Math.abs(numeric) >= deadzone ? { index, numeric } : null
    )
    .filter((value) => value !== null);
  const activeAxes = activeAxisValues.map(
    ({ index, numeric }) => `${index}:${numeric < 0 ? "-" : "+"}`
  );
  return {
    activeAxes,
    hasUnmappedInput:
      pressedButtons.some((index) => !MAPPED_GAMEPAD_BUTTONS.has(index)) ||
      activeAxisValues.some(({ index }) => index > 1),
    pressedButtons,
  };
};

/** @param {Gamepad} pad @param {number} deadzone @param {boolean} [includeDiagnostics] - Include unsupported input details. */
export const readStandardPad = (pad, deadzone, includeDiagnostics = false) => {
  const { axes, buttons } = pad;
  const digital = readDigital(buttons, axes, deadzone);
  const result = {
    activeAxes: [],
    digital,
    hasInput: Object.values(digital).some(Boolean),
    hasUnmappedInput: false,
    pressedButtons: [],
  };
  if (!includeDiagnostics) {
    return result;
  }

  const diagnostics = readDiagnostics(buttons, axes, deadzone);
  return {
    ...result,
    ...diagnostics,
  };
};

/** @param {{key: number, pad: Gamepad}} entry - Gamepad to summarize. */
export const gamepadSummary = ({ key, pad }) => ({
  axes: pad.axes.length,
  buttons: pad.buttons.length,
  id: pad.id === "" ? "(unnamed)" : pad.id.slice(0, 120),
  index: key,
  mapping: pad.mapping === "" ? "unmapped" : pad.mapping,
});
