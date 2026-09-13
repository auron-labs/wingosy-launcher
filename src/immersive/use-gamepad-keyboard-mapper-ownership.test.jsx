import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HookProbe } from "./use-gamepad-keyboard-mapper-test-fixtures";
import { createGamepadTestScope } from "./use-gamepad-keyboard-mapper-test-helpers";

const testScope = createGamepadTestScope();

describe("useGamepadKeyboardMapper controller ownership", () => {
  beforeEach(testScope.beforeEach);
  afterEach(testScope.afterEach);

  it("selects the standard pad that is producing input", () => {
    testScope.pads = [
      testScope.makeGamepad("standard", null, 1),
      testScope.makeGamepad("standard", 0, 2),
    ];
    testScope.render(<HookProbe />);

    testScope.runFrame();

    expect(testScope.keydown).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ key: "Enter" })
    );
  });

  it("clears held input when the active pad disconnects and allows takeover", () => {
    const first = testScope.makeGamepad("standard", 12, 1);
    const replacement = testScope.makeGamepad("standard", null, 2);
    testScope.pads = [first, replacement];
    testScope.render(<HookProbe />);

    testScope.runFrame();
    expect(testScope.keydown).toHaveBeenCalledOnce();

    testScope.pads = [];
    testScope.runFrame();
    replacement.buttons[12].pressed = true;
    testScope.pads = [replacement];
    testScope.runFrame();

    expect(testScope.keydown).toHaveBeenCalledTimes(2);
    expect(testScope.keydown).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: "ArrowUp" })
    );
  });
});
