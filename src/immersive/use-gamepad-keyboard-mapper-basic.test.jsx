import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
