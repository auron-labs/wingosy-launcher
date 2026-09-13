import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HookProbe } from "./use-gamepad-keyboard-mapper-test-fixtures";
import { createGamepadTestScope } from "./use-gamepad-keyboard-mapper-test-helpers";

const testScope = createGamepadTestScope();

describe("useGamepadKeyboardMapper state diagnostics", () => {
  beforeEach(testScope.beforeEach);
  afterEach(testScope.afterEach);

  it("logs a controller replacement that reuses the same gamepad index", () => {
    vi.stubEnv("VITE_WINGOSY_DEBUG", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const first = testScope.makeGamepad("standard", null, 1);
    first.id = "Controller A";
    const replacement = testScope.makeGamepad("standard", null, 1);
    replacement.id = "Controller B";
    testScope.pads = [first];
    testScope.render(<HookProbe />);

    testScope.runFrame();
    testScope.pads = [replacement];
    testScope.runFrame();
    testScope.runFrame();

    const changeLog = info.mock.calls.find(
      ([message]) =>
        message ===
        "[Wingosy][debug][controller] controller changed at same index"
    );
    expect(changeLog?.[1]).toMatchObject({
      current: { id: "Controller B", index: 1 },
      index: 1,
      previous: { id: "Controller A", index: 1 },
    });
    expect(
      info.mock.calls.filter(
        ([message]) =>
          message ===
          "[Wingosy][debug][controller] controller changed at same index"
      )
    ).toHaveLength(1);
  });

  it("logs unsupported mappings and unmapped input only when their state changes", () => {
    vi.stubEnv("VITE_WINGOSY_DEBUG", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const pad = testScope.makeGamepad("", 0, 1);
    testScope.pads = [pad];
    testScope.render(<HookProbe />);

    testScope.runFrame();
    testScope.runFrame();

    expect(info).toHaveBeenCalledWith(
      "[Wingosy][debug][controller] unsupported/unmapped controller: no standard mapping available",
      { unsupported: true }
    );
    expect(info).toHaveBeenCalledTimes(2);

    pad.mapping = "standard";
    pad.buttons[0].pressed = false;
    pad.buttons[2].pressed = true;
    testScope.runFrame();
    testScope.runFrame();

    expect(info).toHaveBeenCalledWith(
      "[Wingosy][debug][controller] unsupported/unmapped input",
      { pads: [{ activeAxes: [], index: 1, pressedButtons: [2] }] }
    );
    expect(info).toHaveBeenCalledTimes(5);
  });
});
