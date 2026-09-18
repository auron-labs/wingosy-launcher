import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HookProbe } from "./use-gamepad-keyboard-mapper-test-fixtures";
import { createGamepadTestScope } from "./use-gamepad-keyboard-mapper-test-helpers";

const testScope = createGamepadTestScope();

/** @param {Array<unknown>} call Console call. @returns {[string, unknown]} Normalized console call. */
const normalizeInfoCall = ([message, details]) => [String(message), details];

/** @param {Array<Array<unknown>>} calls Console calls. @returns {Array<[string, unknown]>} Normalized console calls. */
const getInfoCalls = (calls) => calls.map(normalizeInfoCall);

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

describe("useGamepadKeyboardMapper repeat diagnostics", () => {
  beforeEach(testScope.beforeEach);
  afterEach(testScope.afterEach);

  it("reports initial and held-repeat timing without polling logs", () => {
    vi.stubEnv("VITE_WINGOSY_DEBUG", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    testScope.pads = [testScope.makeGamepad("standard", 12, 3)];
    testScope.render(<HookProbe />);

    testScope.runFrame();
    testScope.now += 239;
    testScope.runFrame();
    testScope.now += 1;
    testScope.runFrame();

    const infoCalls = getInfoCalls(info.mock.calls);
    const actionLogs = infoCalls
      .filter(
        ([message]) =>
          message === "[Wingosy][debug][controller] recognized input/action"
      )
      .map(([, details]) => details);
    expect(actionLogs).toStrictEqual([
      expect.objectContaining({
        actionId: 1,
        controllerIndex: 3,
        elapsedSincePreviousMs: null,
        key: "ArrowUp",
        phase: "edge",
      }),
      expect.objectContaining({
        actionId: 2,
        controllerIndex: 3,
        elapsedSincePreviousMs: 240,
        key: "ArrowUp",
        phase: "repeat",
      }),
    ]);
    expect(infoCalls.some(([message]) => message.includes("poll"))).toBeFalsy();
  });
});
