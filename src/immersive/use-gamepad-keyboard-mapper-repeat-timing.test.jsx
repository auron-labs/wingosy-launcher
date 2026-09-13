import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HookProbe } from "./use-gamepad-keyboard-mapper-test-fixtures";
import { createGamepadTestScope } from "./use-gamepad-keyboard-mapper-test-helpers";

const testScope = createGamepadTestScope();

describe("useGamepadKeyboardMapper repeat timing", () => {
  beforeEach(testScope.beforeEach);
  afterEach(testScope.afterEach);

  it("stops a held direction immediately when released at the repeat boundary", () => {
    const pad = testScope.makeGamepad("standard", 12, 1);
    testScope.pads = [pad];
    testScope.render(<HookProbe />);

    testScope.runFrame();
    testScope.now += 240;
    pad.buttons[12].pressed = false;
    testScope.runFrame();
    expect(testScope.keydown).toHaveBeenCalledOnce();

    testScope.now += 110;
    testScope.runFrame();
    expect(testScope.keydown).toHaveBeenCalledOnce();

    pad.buttons[12].pressed = true;
    testScope.runFrame();
    expect(testScope.keydown).toHaveBeenCalledTimes(2);
    expect(testScope.keydown).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: "ArrowUp" })
    );
  });

  it("waits for the initial directional delay before using the repeat interval", () => {
    testScope.pads = [testScope.makeGamepad("standard", 12, 1)];
    testScope.render(<HookProbe />);

    testScope.runFrame();
    testScope.now += 239;
    testScope.runFrame();
    expect(testScope.keydown).toHaveBeenCalledOnce();

    testScope.now += 1;
    testScope.runFrame();
    expect(testScope.keydown).toHaveBeenCalledTimes(2);

    testScope.now += 109;
    testScope.runFrame();
    expect(testScope.keydown).toHaveBeenCalledTimes(2);

    testScope.now += 1;
    testScope.runFrame();
    expect(testScope.keydown).toHaveBeenCalledTimes(3);
    expect(testScope.keydown).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: "ArrowUp" })
    );
  });
});
