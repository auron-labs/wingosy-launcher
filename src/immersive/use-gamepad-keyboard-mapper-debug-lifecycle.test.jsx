import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HookProbe } from "./use-gamepad-keyboard-mapper-test-fixtures";
import { createGamepadTestScope } from "./use-gamepad-keyboard-mapper-test-helpers";

const testScope = createGamepadTestScope();

describe("useGamepadKeyboardMapper controller lifecycle diagnostics", () => {
  beforeEach(testScope.beforeEach);
  afterEach(testScope.afterEach);

  it("logs controller lifecycle and recognized actions without logging idle frames", () => {
    vi.stubEnv("VITE_WINGOSY_DEBUG", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const pad = testScope.makeGamepad("standard", 0, 1);
    testScope.pads = [pad];
    testScope.render(<HookProbe />);

    testScope.runFrame();
    testScope.runFrame();

    expect(info).toHaveBeenCalledWith(
      "[Wingosy][debug][controller] controller connected",
      expect.objectContaining({ index: 1, mapping: "standard" })
    );
    expect(info).toHaveBeenCalledWith(
      "[Wingosy][debug][controller] recognized input/action",
      expect.objectContaining({ deferred: false, key: "Enter" })
    );
    expect(
      info.mock.calls.filter(
        ([message]) =>
          message === "[Wingosy][debug][controller] recognized input/action"
      )
    ).toHaveLength(1);

    testScope.pads = [];
    testScope.runFrame();

    expect(info).toHaveBeenCalledWith(
      "[Wingosy][debug][controller] controller disconnected",
      expect.objectContaining({ index: 1 })
    );
    expect(info).toHaveBeenCalledWith(
      "[Wingosy][debug][controller] no controller detected"
    );
  });

  it("logs a deferred recognized action once", () => {
    vi.stubEnv("VITE_WINGOSY_DEBUG", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const pad = testScope.makeGamepad("standard", 0, 1);
    pad.buttons[15].pressed = true;
    testScope.pads = [pad];
    testScope.render(<HookProbe />);

    testScope.runFrame();
    testScope.runFrame();

    const actionLogs = info.mock.calls.filter(
      ([message]) =>
        message === "[Wingosy][debug][controller] recognized input/action"
    );
    expect(actionLogs).toStrictEqual([
      [
        "[Wingosy][debug][controller] recognized input/action",
        expect.objectContaining({ deferred: false, key: "Enter" }),
      ],
      [
        "[Wingosy][debug][controller] recognized input/action",
        expect.objectContaining({ deferred: true, key: "ArrowRight" }),
      ],
    ]);
  });
});
