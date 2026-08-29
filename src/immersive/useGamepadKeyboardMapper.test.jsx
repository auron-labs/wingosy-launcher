import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useGamepadKeyboardMapper } from "./useGamepadKeyboardMapper";

function HookProbe({ deadzone = 0.35, enabled = true } = {}) {
  const { unsupportedGamepad } = useGamepadKeyboardMapper({ deadzone, enabled });
  return <span data-testid="unsupported">{String(unsupportedGamepad)}</span>;
}

function makeGamepad(mapping, buttonIndex = 0, index = 0, axes = []) {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
  if (buttonIndex !== null) buttons[buttonIndex].pressed = true;
  return { index, mapping, buttons, axes };
}

describe("useGamepadKeyboardMapper", () => {
  let frames;
  let nextFrameId;
  let pads;
  let getGamepads;
  let originalGetGamepadsDescriptor;
  let keydown;
  let now;

  beforeEach(() => {
    frames = new Map();
    nextFrameId = 1;
    pads = [];
    getGamepads = vi.fn(() => pads);
    originalGetGamepadsDescriptor = Object.getOwnPropertyDescriptor(navigator, "getGamepads");
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: getGamepads,
    });
    vi.stubGlobal("requestAnimationFrame", (callback) => {
      const id = nextFrameId++;
      frames.set(id, callback);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id) => frames.delete(id));
    keydown = vi.fn();
    now = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    window.addEventListener("keydown", keydown);
  });

  afterEach(() => {
    cleanup();
    window.removeEventListener("keydown", keydown);
    if (originalGetGamepadsDescriptor) {
      Object.defineProperty(navigator, "getGamepads", originalGetGamepadsDescriptor);
    } else {
      delete navigator.getGamepads;
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function runFrame() {
    const next = frames.entries().next().value;
    if (!next) return;
    const [id, callback] = next;
    frames.delete(id);
    act(() => callback(0));
  }

  it("emits a standard pad intent once while the button is held", () => {
    pads = [makeGamepad("standard")];
    render(<HookProbe />);

    runFrame();
    runFrame();

    expect(keydown).toHaveBeenCalledTimes(1);
    expect(keydown).toHaveBeenCalledWith(expect.objectContaining({ key: "Enter" }));
    expect(screen.getByTestId("unsupported")).toHaveTextContent("false");
  });

  it("skips a nonstandard first pad and uses the standard second pad", () => {
    pads = [makeGamepad("", 0), makeGamepad("standard")];
    render(<HookProbe />);

    runFrame();

    expect(keydown).toHaveBeenCalledTimes(1);
    expect(keydown).toHaveBeenCalledWith(expect.objectContaining({ key: "Enter" }));
    expect(screen.getByTestId("unsupported")).toHaveTextContent("false");
  });

  it("emits nothing when only a nonstandard pad is connected", () => {
    pads = [makeGamepad("", 0)];
    render(<HookProbe />);

    runFrame();

    expect(keydown).not.toHaveBeenCalled();
    expect(screen.getByTestId("unsupported")).toHaveTextContent("true");
  });

  it("emits nothing when no pad is connected", () => {
    render(<HookProbe />);

    runFrame();

    expect(keydown).not.toHaveBeenCalled();
    expect(screen.getByTestId("unsupported")).toHaveTextContent("false");
  });

  it("selects the standard pad that is producing input", () => {
    pads = [makeGamepad("standard", null, 1), makeGamepad("standard", 0, 2)];
    render(<HookProbe />);

    runFrame();

    expect(keydown).toHaveBeenCalledTimes(1);
    expect(keydown).toHaveBeenCalledWith(expect.objectContaining({ key: "Enter" }));
  });

  it("clears held input when the active pad disconnects and allows takeover", () => {
    const first = makeGamepad("standard", 12, 1);
    const replacement = makeGamepad("standard", null, 2);
    pads = [first, replacement];
    render(<HookProbe />);

    runFrame();
    expect(keydown).toHaveBeenCalledTimes(1);

    pads = [];
    runFrame();
    replacement.buttons[12].pressed = true;
    pads = [replacement];
    runFrame();

    expect(keydown).toHaveBeenCalledTimes(2);
    expect(keydown).toHaveBeenLastCalledWith(expect.objectContaining({ key: "ArrowUp" }));
  });

  it("does not replay a held direction when the active pad reconnects", () => {
    const pad = makeGamepad("standard", 12, 1);
    pads = [pad];
    render(<HookProbe />);

    runFrame();
    pads = [];
    runFrame();
    pads = [pad];
    runFrame();

    expect(keydown).toHaveBeenCalledTimes(1);

    pad.buttons[12].pressed = false;
    runFrame();
    pad.buttons[12].pressed = true;
    runFrame();

    expect(keydown).toHaveBeenCalledTimes(2);
    expect(keydown).toHaveBeenLastCalledWith(expect.objectContaining({ key: "ArrowUp" }));
  });

  it("keeps the active pad sticky and takes over after it disconnects", () => {
    const active = makeGamepad("standard", 0, 1);
    const second = makeGamepad("standard", null, 2);
    pads = [active, second];
    render(<HookProbe />);

    runFrame();
    second.buttons[12].pressed = true;
    runFrame();

    expect(keydown).toHaveBeenCalledTimes(1);
    expect(keydown).toHaveBeenLastCalledWith(expect.objectContaining({ key: "Enter" }));

    pads = [null, second];
    runFrame();

    expect(keydown).toHaveBeenCalledTimes(2);
    expect(keydown).toHaveBeenLastCalledWith(expect.objectContaining({ key: "ArrowUp" }));
  });

  it("ignores stick noise below the configured deadzone", () => {
    pads = [makeGamepad("standard", null, 1, [0.2, -0.2])];
    render(<HookProbe deadzone={0.35} />);

    runFrame();

    expect(keydown).not.toHaveBeenCalled();
  });

  it.each([
    ["D-pad", 12, []],
    ["left stick", null, [0, -1]],
  ])("emits exactly one navigation event for a quick %s tap", (_label, buttonIndex, axes) => {
    const pad = makeGamepad("standard", buttonIndex, 1, axes);
    pads = [pad];
    render(<HookProbe />);

    runFrame();
    pad.buttons[12].pressed = false;
    pad.axes[1] = 0;
    runFrame();

    expect(keydown).toHaveBeenCalledTimes(1);
    expect(keydown).toHaveBeenLastCalledWith(expect.objectContaining({ key: "ArrowUp" }));
  });

  it("stops a held direction immediately when released at the repeat boundary", () => {
    const pad = makeGamepad("standard", 12, 1);
    pads = [pad];
    render(<HookProbe />);

    runFrame();
    now += 240;
    pad.buttons[12].pressed = false;
    runFrame();
    expect(keydown).toHaveBeenCalledTimes(1);

    now += 110;
    runFrame();
    expect(keydown).toHaveBeenCalledTimes(1);

    pad.buttons[12].pressed = true;
    runFrame();
    expect(keydown).toHaveBeenCalledTimes(2);
    expect(keydown).toHaveBeenLastCalledWith(expect.objectContaining({ key: "ArrowUp" }));
  });

  it("waits for the initial directional delay before using the repeat interval", () => {
    pads = [makeGamepad("standard", 12, 1)];
    render(<HookProbe />);

    runFrame();
    now += 239;
    runFrame();
    expect(keydown).toHaveBeenCalledTimes(1);

    now += 1;
    runFrame();
    expect(keydown).toHaveBeenCalledTimes(2);

    now += 109;
    runFrame();
    expect(keydown).toHaveBeenCalledTimes(2);

    now += 1;
    runFrame();

    expect(keydown).toHaveBeenCalledTimes(3);
    expect(keydown).toHaveBeenLastCalledWith(expect.objectContaining({ key: "ArrowUp" }));
  });

  it("resets held input when disabled and re-enabled", () => {
    const pad = makeGamepad("standard", 0, 1);
    pads = [pad];
    const view = render(<HookProbe />);

    runFrame();
    expect(keydown).toHaveBeenCalledTimes(1);

    view.rerender(<HookProbe enabled={false} />);
    view.rerender(<HookProbe />);
    runFrame();

    expect(keydown).toHaveBeenCalledTimes(2);
  });
});
