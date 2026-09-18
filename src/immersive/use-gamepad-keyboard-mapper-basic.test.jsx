import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HookProbe } from "./use-gamepad-keyboard-mapper-test-fixtures";
import { createGamepadTestScope } from "./use-gamepad-keyboard-mapper-test-helpers";

const testScope = createGamepadTestScope();

describe("useGamepadKeyboardMapper basic input", () => {
  beforeEach(testScope.beforeEach);
  afterEach(testScope.afterEach);

  it("emits a standard pad intent once while the button is held", () => {
    testScope.pads = [testScope.makeGamepad("standard")];
    testScope.render(<HookProbe />);

    testScope.runFrame();
    testScope.runFrame();

    expect(testScope.keydown).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ key: "Enter" })
    );
    expect(testScope.screen.getByTestId("unsupported")).toHaveTextContent(
      "false"
    );
  });

  it("delivers a decoded action once to the app callback instead of the DOM", () => {
    vi.stubEnv("VITE_WINGOSY_DEBUG", "1");
    const onControllerAction = vi.fn(() => {});
    testScope.pads = [testScope.makeGamepad("standard")];
    testScope.render(<HookProbe onControllerAction={onControllerAction} />);

    testScope.runFrame();

    expect(onControllerAction).toHaveBeenCalledExactlyOnceWith(
      "Enter",
      expect.objectContaining({
        actionId: 1,
        controllerIndex: 0,
        key: "Enter",
        phase: "edge",
      })
    );
    expect(testScope.keydown).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("skips a nonstandard first pad and uses the standard second pad", () => {
    testScope.pads = [
      testScope.makeGamepad("", 0),
      testScope.makeGamepad("standard"),
    ];
    testScope.render(<HookProbe />);

    testScope.runFrame();

    expect(testScope.keydown).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ key: "Enter" })
    );
    expect(testScope.screen.getByTestId("unsupported")).toHaveTextContent(
      "false"
    );
  });

  it("emits nothing when only a nonstandard pad is connected", () => {
    testScope.pads = [testScope.makeGamepad("", 0)];
    testScope.render(<HookProbe />);

    testScope.runFrame();

    expect(testScope.keydown).not.toHaveBeenCalled();
    expect(testScope.screen.getByTestId("unsupported")).toHaveTextContent(
      "true"
    );
  });

  it("emits nothing when no pad is connected", () => {
    testScope.render(<HookProbe />);

    testScope.runFrame();

    expect(testScope.keydown).not.toHaveBeenCalled();
    expect(testScope.screen.getByTestId("unsupported")).toHaveTextContent(
      "false"
    );
  });
});

describe("useGamepadKeyboardMapper callback updates", () => {
  beforeEach(testScope.beforeEach);
  afterEach(testScope.afterEach);

  it("uses the latest app callback without restarting the mapper", () => {
    const firstCallback = vi.fn(() => {});
    const secondCallback = vi.fn(() => {});
    const pad = testScope.makeGamepad("standard");
    testScope.pads = [pad];
    const { rerender } = testScope.render(
      <HookProbe onControllerAction={firstCallback} />
    );

    testScope.runFrame();
    expect(firstCallback).toHaveBeenCalledExactlyOnceWith("Enter", null);

    pad.buttons[0].pressed = false;
    testScope.runFrame();
    rerender(<HookProbe onControllerAction={secondCallback} />);
    pad.buttons[0].pressed = true;
    testScope.runFrame();

    expect(firstCallback).toHaveBeenCalledOnce();
    expect(secondCallback).toHaveBeenCalledExactlyOnceWith("Enter", null);
    expect(testScope.keydown).not.toHaveBeenCalled();
  });
});
