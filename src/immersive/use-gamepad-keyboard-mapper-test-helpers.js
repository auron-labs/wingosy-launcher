import { act, cleanup, render, screen } from "@testing-library/react";
import { vi } from "vitest";

/** @typedef {{axes: number[], buttons: {pressed: boolean}[], id?: string, index: number, mapping: string}} TestGamepad */

/** @param {KeyboardEvent} event Keyboard event observed by the test window. */
const ignoreKeydown = (event) => {
  void event;
};

class TestFrame {
  /** @param {FrameRequestCallback} scheduledCallback Frame callback to invoke. */
  constructor(scheduledCallback) {
    this.scheduledCallback = scheduledCallback;
  }

  run() {
    this.scheduledCallback(0);
  }
}

/** @param {string} mapping Mapping identifier. @param {number|null} [buttonIndex] Pressed button index. @param {number} [index] Controller index. @param {number[]} [axes] Axis values. @returns {TestGamepad} Test gamepad. */
export const makeGamepad = (mapping, buttonIndex = 0, index = 0, axes = []) => {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
  if (buttonIndex !== null) {
    buttons[buttonIndex].pressed = true;
  }
  return { axes, buttons, index, mapping };
};

/** @param {() => (TestGamepad|null)[]} getPads Read the current test pads. @param {() => number} getNow Read the test clock. */
const createGamepadEnvironment = (getPads, getNow) => {
  /** @type {{id: number, frame: TestFrame}[]} */
  const frames = [];
  let nextFrameId = 1;
  const originalGetGamepadsDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "getGamepads"
  );
  const getGamepads = vi.fn(() => getPads());
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: getGamepads,
  });
  /** @param {FrameRequestCallback} scheduledCallback Frame callback to schedule. @returns {number} Scheduled frame identifier. */
  const scheduleFrame = (scheduledCallback) => {
    const id = nextFrameId;
    nextFrameId += 1;
    frames.push({ frame: new TestFrame(scheduledCallback), id });
    return id;
  };
  /** @param {number} id Scheduled frame identifier. */
  const cancelFrame = (id) => {
    const frameIndex = frames.findIndex((entry) => entry.id === id);
    if (frameIndex !== -1) {
      frames.splice(frameIndex, 1);
    }
  };
  vi.stubGlobal("requestAnimationFrame", scheduleFrame);
  vi.stubGlobal("cancelAnimationFrame", cancelFrame);
  const keydown = vi.fn(ignoreKeydown);
  vi.spyOn(Date, "now").mockImplementation(getNow);
  window.addEventListener("keydown", keydown);

  const runFrame = () => {
    const next = frames.shift();
    if (next === undefined) {
      return;
    }
    act(() => {
      next.frame.run();
    });
  };

  const dispose = () => {
    cleanup();
    window.removeEventListener("keydown", keydown);
    if (originalGetGamepadsDescriptor === undefined) {
      Reflect.deleteProperty(navigator, "getGamepads");
    } else {
      Object.defineProperty(
        navigator,
        "getGamepads",
        originalGetGamepadsDescriptor
      );
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  };

  return { dispose, keydown, runFrame };
};

export const createGamepadTestScope = () => {
  /** @type {TestGamepad[]} */
  /** @type {(TestGamepad|null)[]} */
  let pads = [];
  let now = 1000;
  /** @type {ReturnType<typeof createGamepadEnvironment>|null} */
  let environment = null;

  const beforeEach = () => {
    pads = [];
    now = 1000;
    environment = createGamepadEnvironment(
      () => pads,
      () => now
    );
  };

  const afterEach = () => {
    environment?.dispose();
    environment = null;
  };

  const getEnvironment = () => {
    if (environment === null) {
      throw new Error("Gamepad test environment is not initialized");
    }
    return environment;
  };

  return {
    afterEach,
    beforeEach,
    get keydown() {
      return getEnvironment().keydown;
    },
    makeGamepad,
    get now() {
      return now;
    },
    set now(value) {
      now = value;
    },
    get pads() {
      return pads;
    },
    set pads(value) {
      pads = value;
    },
    render,
    runFrame: () => {
      getEnvironment().runFrame();
    },
    screen,
  };
};
