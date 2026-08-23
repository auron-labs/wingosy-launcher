import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useGamepadKeyboardMapper } from "./useGamepadKeyboardMapper";

function HookProbe() {
  const { unsupportedGamepad } = useGamepadKeyboardMapper();
  return <span data-testid="unsupported">{String(unsupportedGamepad)}</span>;
}

function makeGamepad(mapping, buttonIndex = 0) {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
  buttons[buttonIndex].pressed = true;
  return { mapping, buttons, axes: [] };
}

describe("useGamepadKeyboardMapper", () => {
  let frames;
  let nextFrameId;
  let pads;
  let getGamepads;
  let originalGetGamepadsDescriptor;
  let keydown;

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
});
