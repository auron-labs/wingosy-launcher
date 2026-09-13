import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HookProbe } from "./use-gamepad-keyboard-mapper-test-fixtures";
import { createGamepadTestScope } from "./use-gamepad-keyboard-mapper-test-helpers";

const testScope = createGamepadTestScope();

describe("useGamepadKeyboardMapper enabled state", () => {
  beforeEach(testScope.beforeEach);
  afterEach(testScope.afterEach);

  it("resets held input when disabled and re-enabled", () => {
    const pad = testScope.makeGamepad("standard", 0, 1);
    testScope.pads = [pad];
    const view = testScope.render(<HookProbe />);

    testScope.runFrame();
    expect(testScope.keydown).toHaveBeenCalledOnce();

    view.rerender(<HookProbe enabled={false} />);
    view.rerender(<HookProbe />);
    testScope.runFrame();

    expect(testScope.keydown).toHaveBeenCalledTimes(2);
  });
});
