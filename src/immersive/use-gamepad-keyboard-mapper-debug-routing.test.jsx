import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  HookProbe,
  RoutingProbe,
} from "./use-gamepad-keyboard-mapper-test-fixtures";
import { createGamepadTestScope } from "./use-gamepad-keyboard-mapper-test-helpers";

const testScope = createGamepadTestScope();

/** @param {Array<unknown>} call Console call. @returns {[string, unknown]} Normalized console call. */
const normalizeInfoCall = ([message, details]) => [String(message), details];

/** @param {Array<Array<unknown>>} calls Console calls. @returns {Array<[string, unknown]>} Normalized console calls. */
const getInfoCalls = (calls) => calls.map(normalizeInfoCall);

describe("useGamepadKeyboardMapper routing diagnostics", () => {
  beforeEach(testScope.beforeEach);
  afterEach(testScope.afterEach);

  it("correlates an emitted action with its actual routing destinations", () => {
    vi.stubEnv("VITE_WINGOSY_DEBUG", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    testScope.pads = [testScope.makeGamepad("standard", 0, 3)];
    testScope.render(<RoutingProbe />);

    testScope.runFrame();

    const routed = info.mock.calls.find(
      ([message]) => message === "[Wingosy][debug][controller] action routed"
    );
    expect(routed?.[1]).toMatchObject({
      controllerIndex: 3,
      destinations: [{ type: "window" }, { type: "library-root" }],
      elapsedSincePreviousMs: null,
      expectedTarget: "library-root",
      expectedTargetMissing: false,
      key: "Enter",
      phase: "edge",
    });
    expect(routed?.[1]).toHaveProperty("actionId");
  });

  it("reports a missing immersive target instead of hiding an unrouted action", () => {
    vi.stubEnv("VITE_WINGOSY_DEBUG", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    testScope.pads = [testScope.makeGamepad("standard", 0, 3)];
    testScope.render(<HookProbe />);

    testScope.runFrame();

    const routed = info.mock.calls.find(
      ([message]) => message === "[Wingosy][debug][controller] action routed"
    );
    expect(routed?.[1]).toMatchObject({
      destinations: [{ type: "window" }],
      expectedTarget: "library-root",
      expectedTargetMissing: true,
      key: "Enter",
    });
  });

  it("reports the initial edge and held repeat timing without polling logs", () => {
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
