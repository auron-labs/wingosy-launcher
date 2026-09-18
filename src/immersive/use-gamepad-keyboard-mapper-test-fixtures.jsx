import { useGamepadKeyboardMapper } from "./use-gamepad-keyboard-mapper";

/** @typedef {{axes: number[], buttons: {pressed: boolean}[], id?: string, index: number, mapping: string}} TestGamepad */

/** @param {{deadzone?: number, enabled?: boolean, onControllerAction?: ((key: string, action: unknown) => void)|null}} [options] Mapper test options. */
export const HookProbe = ({
  deadzone = 0.35,
  enabled = true,
  onControllerAction = null,
} = {}) => {
  const { unsupportedGamepad } = useGamepadKeyboardMapper({
    deadzone,
    enabled,
    onControllerAction,
  });
  return <span data-testid="unsupported">{String(unsupportedGamepad)}</span>;
};

export const RoutingProbe = () => {
  useGamepadKeyboardMapper();
  return <div data-testid="immersive-library" />;
};
