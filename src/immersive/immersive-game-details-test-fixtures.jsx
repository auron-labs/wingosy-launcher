import { act, cleanup, render } from "@testing-library/react";
import { vi } from "vitest";

import { createGameDetailsTestIpc } from "../components/game/game-details-test-ipc";
import { RomDownloadsProvider } from "../rom-downloads-context";
import { MuiTestProvider } from "../test/mui-harness";
import { ThemeContext } from "../theme-context";
import ImmersiveGameDetails from "./immersive-game-details";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {import("./immersive-types").LaunchResult} LaunchResult */
/** @typedef {(command: string, args?: Record<string, unknown>) => unknown} InvokeMock */
/** @typedef {import("../test/invoke-mocks").GameDetailsTestInvoke} TypedInvoke */
/** @type {import("vitest").Mock<InvokeMock>} */
export const invoke = vi.fn();
/** @type {TypedInvoke} */
// @ts-expect-error -- The forwarding mock is backed by the typed command fixtures below.
const invokeForIpc = invoke;
/** @type {import("vitest").Mock<typeof import("@tauri-apps/api/event").listen>} */
export const listen = vi.fn();

/** @type {Map<string, (event: {payload: unknown}) => void>} */
export const eventListeners = new Map();

export const testIpc = createGameDetailsTestIpc(invokeForIpc);

const noOp = () => {
  // Theme callbacks are intentionally inert in fixture renders.
};
/** @type {import("../theme-context").ThemeContextValue} */
export const themeValue = {
  accentHue: null,
  colors: {
    primary: "#5C6BC0",
    primaryLight: "#8E99F3",
  },
  setAccentHue: noOp,
  setThemeMode: noOp,
  themeMode: "dark",
};

/** @type {ImmersiveGame} */
export const remoteOnlyGame = {
  id: 7,
  is_favorite: false,
  local_file_path: null,
  name: "Cloud Game",
  platform_id: "gba",
  romm_id: 42,
  screenshot_paths: [],
  source: "RomM",
  summary: "A game in the cloud.",
  sync_state: "remote_only",
};

export const switchRemoteGame = {
  ...remoteOnlyGame,
  id: 17,
  name: "Switch Cloud Game",
  platform_id: "switch",
};

export const launchableGame = {
  ...remoteOnlyGame,
  local_file_path: "/roms/cloud.gba",
};

export const switchLaunchableGame = {
  ...launchableGame,
  id: 18,
  name: "Switch Launchable Game",
  platform_id: "switch",
};

/** @param {string} eventName Event name. @param {unknown} payload Event payload. */
export const dispatchEvent = (eventName, payload) => {
  const handler = eventListeners.get(eventName);
  if (!handler) {
    throw new Error(`Missing test event listener: ${eventName}`);
  }
  handler({ payload });
};

/** @template T @returns {PromiseWithResolvers<T>} Deferred promise. */
export const createDeferred = () => Promise.withResolvers();

/** @returns {import("vitest").Mock<() => void>} Void callback mock. */
export const createVoidCallback = () => vi.fn();

/** @template T @param {PromiseWithResolvers<T>} deferred @param {T} value Resolve a deferred operation. */
export const resolveDeferred = (deferred, value) => {
  act(() => {
    deferred.resolve(value);
  });
};

/** @param {string} key Key name. @param {{repeat?: boolean}} [options] Key options. */
export const dispatchControllerKey = (key, { repeat = false } = {}) => {
  /** @type {Record<string, string>} */
  const codes = { Enter: "Enter", Escape: "Escape" };
  const code = codes[key] ?? "";
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code,
        key,
        repeat,
      })
    );
  });
};

/** @param {number|null} [buttonIndex] Pressed button index. @returns {{axes: number[], buttons: Array<{pressed: boolean}>, index: number, mapping: string}} Test gamepad. */
export const makeStandardPad = (buttonIndex = null) => {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
  if (buttonIndex !== null) {
    buttons[buttonIndex].pressed = true;
  }
  return { axes: [], buttons, index: 1, mapping: "standard" };
};

export const installControllerTestEnvironment = () => {
  /** @type {Map<number, FrameRequestCallback>} */
  const frames = new Map();
  let nextFrameId = 1;
  /** @type {Array<{axes: number[], buttons: Array<{pressed: boolean}>, index: number, mapping: string}>} */
  let pads = [];
  let now = 1000;
  const originalGetGamepadsDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "getGamepads"
  );
  const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => now);

  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: () => pads,
  });
  /** @param {FrameRequestCallback} frameHandler Animation callback. @returns {number} Frame identifier. */
  const requestAnimationFrame = (frameHandler) => {
    nextFrameId += 1;
    const id = nextFrameId;
    frames.set(id, frameHandler);
    return id;
  };
  /** @param {number} id Frame identifier. */
  const cancelAnimationFrame = (id) => {
    frames.delete(id);
  };
  vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
  vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

  return {
    advanceRepeatDelay() {
      now += 240;
    },
    restore() {
      if (originalGetGamepadsDescriptor) {
        Object.defineProperty(
          navigator,
          "getGamepads",
          originalGetGamepadsDescriptor
        );
      } else {
        Reflect.deleteProperty(navigator, "getGamepads");
      }
      vi.unstubAllGlobals();
      nowSpy.mockRestore();
    },
    runFrame() {
      const next = frames.entries().next();
      if (next.done === true) {
        return;
      }
      const [id, frameHandler] = next.value;
      frames.delete(id);
      act(() => {
        frameHandler(0);
      });
    },
    /** @param {Array<{axes: number[], buttons: Array<{pressed: boolean}>, index: number, mapping: string}>} nextPads Test gamepads. */
    setPads(nextPads) {
      pads = nextPads;
    },
  };
};

/** @param {(gameId: number|string) => Promise<LaunchResult|null|undefined>} onLaunch Launch callback. @param {ImmersiveGame} game Game under test. @param {{onBack?: () => void, onToggleFavorite?: (gameId?: number|string) => void, onGameUpdate?: () => void, onOpenSettings?: () => void, onOpenIntegrations?: () => void, platformLabel?: string, retroachievementsEnabled?: boolean}} [options] Detail fixture options. */
export const renderDetails = (
  onLaunch = vi.fn().mockResolvedValue({ success: true }),
  game = remoteOnlyGame,
  {
    onBack = vi.fn(),
    onToggleFavorite = vi.fn(),
    onGameUpdate = vi.fn(),
    onOpenSettings = vi.fn(),
    onOpenIntegrations = vi.fn(),
    platformLabel = "Game Boy Advance",
    retroachievementsEnabled = false,
  } = {}
) =>
  render(
    <MuiTestProvider>
      <ThemeContext.Provider value={themeValue}>
        <RomDownloadsProvider listen={listen}>
          <ImmersiveGameDetails
            game={game}
            platformLabel={platformLabel}
            onBack={() => {
              onBack();
            }}
            onLaunch={onLaunch}
            onToggleFavorite={(gameId) => {
              onToggleFavorite?.(gameId);
            }}
            onGameUpdate={() => {
              onGameUpdate();
            }}
            onOpenSettings={() => {
              onOpenSettings?.();
            }}
            onOpenIntegrations={() => {
              onOpenIntegrations?.();
            }}
            retroachievementsEnabled={retroachievementsEnabled}
            rommToken="saved-token"
            rommUrl="https://romm.example"
            dependencies={{ ipc: testIpc }}
          />
        </RomDownloadsProvider>
      </ThemeContext.Provider>
    </MuiTestProvider>
  );

/** @param {{runFrame: () => void}} controller Controller harness. @param {{buttons: Array<{pressed: boolean}>}} pad Test gamepad. @param {number} buttonIndex Button index. */
export const tapPadButton = (controller, pad, buttonIndex) => {
  for (const button of pad.buttons) {
    button.pressed = false;
  }
  controller.runFrame();
  pad.buttons[buttonIndex].pressed = true;
  controller.runFrame();
  pad.buttons[buttonIndex].pressed = false;
  controller.runFrame();
};

/** Reset details DOM, listeners, mocks, and debug environment. */
export const resetImmersiveGameDetailsTest = () => {
  cleanup();
  eventListeners.clear();
  invoke.mockReset();
  listen.mockReset();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
};
