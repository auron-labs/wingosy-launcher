import { useGamepadKeyboardMapper } from "./use-gamepad-keyboard-mapper";

/** @typedef {{axes: number[], buttons: {pressed: boolean}[], id?: string, index: number, mapping: string}} TestGamepad */

export const HookProbe = ({ deadzone = 0.35, enabled = true } = {}) => {
  const { unsupportedGamepad } = useGamepadKeyboardMapper({
    deadzone,
    enabled,
  });
  return <span data-testid="unsupported">{String(unsupportedGamepad)}</span>;
};

export const RoutingProbe = () => {
  useGamepadKeyboardMapper();
  return <div data-testid="immersive-library" />;
};
