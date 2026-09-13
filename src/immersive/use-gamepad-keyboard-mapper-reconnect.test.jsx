import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HookProbe } from "./use-gamepad-keyboard-mapper-test-fixtures";
import { createGamepadTestScope } from "./use-gamepad-keyboard-mapper-test-helpers";

const testScope = createGamepadTestScope();

describe("useGamepadKeyboardMapper reconnection", () => {
  beforeEach(testScope.beforeEach);
  afterEach(testScope.afterEach);

  it("does not replay a held direction when the active pad reconnects", () => {
    const pad = testScope.makeGamepad("standard", 12, 1);
    testScope.pads = [pad];
    testScope.render(<HookProbe />);

    testScope.runFrame();
    testScope.pads = [];
    testScope.runFrame();
    testScope.pads = [pad];
    testScope.runFrame();

    expect(testScope.keydown).toHaveBeenCalledOnce();

    pad.buttons[12].pressed = false;
    testScope.runFrame();
    pad.buttons[12].pressed = true;
    testScope.runFrame();

    expect(testScope.keydown).toHaveBeenCalledTimes(2);
    expect(testScope.keydown).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: "ArrowUp" })
    );
  });

  it("keeps the active pad sticky and takes over after it disconnects", () => {
    const active = testScope.makeGamepad("standard", 0, 1);
    const second = testScope.makeGamepad("standard", null, 2);
    testScope.pads = [active, second];
    testScope.render(<HookProbe />);

    testScope.runFrame();
    second.buttons[12].pressed = true;
    testScope.runFrame();

    expect(testScope.keydown).toHaveBeenCalledOnce();
    expect(testScope.keydown).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: "Enter" })
    );

    testScope.pads = [null, second];
    testScope.runFrame();

    expect(testScope.keydown).toHaveBeenCalledTimes(2);
    expect(testScope.keydown).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: "ArrowUp" })
    );
  });
});
