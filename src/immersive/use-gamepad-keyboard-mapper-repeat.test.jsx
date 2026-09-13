import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HookProbe } from "./use-gamepad-keyboard-mapper-test-fixtures";
import { createGamepadTestScope } from "./use-gamepad-keyboard-mapper-test-helpers";

const testScope = createGamepadTestScope();

describe("useGamepadKeyboardMapper repeat input", () => {
  beforeEach(testScope.beforeEach);
  afterEach(testScope.afterEach);

  it("ignores stick noise below the configured deadzone", () => {
    testScope.pads = [testScope.makeGamepad("standard", null, 1, [0.2, -0.2])];
    testScope.render(<HookProbe deadzone={0.35} />);

    testScope.runFrame();

    expect(testScope.keydown).not.toHaveBeenCalled();
  });

  it.each([
    ["D-pad", 12, []],
    ["left stick", null, [0, -1]],
  ])(
    "emits exactly one navigation event for a quick %s tap",
    (_label, buttonIndex, axes) => {
      const pad = testScope.makeGamepad("standard", buttonIndex, 1, axes);
      testScope.pads = [pad];
      testScope.render(<HookProbe />);

      testScope.runFrame();
      pad.buttons[12].pressed = false;
      pad.axes[1] = 0;
      testScope.runFrame();

      expect(testScope.keydown).toHaveBeenCalledOnce();
      expect(testScope.keydown).toHaveBeenLastCalledWith(
        expect.objectContaining({ key: "ArrowUp" })
      );
    }
  );
});
