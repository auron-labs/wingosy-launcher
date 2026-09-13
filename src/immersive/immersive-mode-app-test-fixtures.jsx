import { act, cleanup, render } from "@testing-library/react";
import { vi } from "vitest";

import { MuiTestProvider } from "../test/mui-harness";
import { attachControllerAction } from "./controller-debug";
import ProductionImmersiveModeApp from "./immersive-mode-app";
import {
  TestAudioPlayer,
  TestDetails,
  TestDownloads,
  TestHintBar,
  TestLibrary,
  TestSettings,
} from "./immersive-mode-app-test-components";

/** @typedef {(command: string, args?: Record<string, unknown>) => unknown} InvokeMock */
/** @typedef {import("../test/invoke-mocks").ImmersiveTestInvoke} TypedInvoke */
/** @type {import("vitest").Mock<InvokeMock>} */
export const invoke = vi.fn();
/** @type {TypedInvoke} */
// @ts-expect-error -- The forwarding mock is backed by the typed command fixtures below.
const invokeForIpc = invoke;
const noOp = () => {
  // Callback is intentionally inert for app fixture renders.
};

/** @type {import("./use-immersive-mode-library").ImmersiveLibraryIpc} */
const libraryIpc = {
  getGamesPage: async (page, platformId, searchQuery) =>
    await invokeForIpc("get_games_page", {
      page,
      pageSize: 60,
      platformId,
      searchQuery,
    }),
  getImmersiveConfig: async () => await invokeForIpc("get_config"),
  getPlatformsWithGames: async () =>
    await invokeForIpc("get_platforms_with_games"),
};
/** @type {NonNullable<React.ComponentProps<typeof ProductionImmersiveModeApp>["dependencies"]>} */
const testDependencies = {
  components: {
    audio: TestAudioPlayer,
    details: TestDetails,
    downloads: TestDownloads,
    hintBar: TestHintBar,
    library: TestLibrary,
    settings: TestSettings,
  },
  getConfig: async () => await invokeForIpc("get_config"),
  libraryIpc,
  prepareLaunch: async (gameId) =>
    await invokeForIpc("prepare_and_launch_game", { gameId }),
  saveConfig: async (config) => await invoke("save_config", { config }),
};

/** @param {React.ComponentProps<typeof ProductionImmersiveModeApp>} props App properties. */
export const renderImmersiveModeApp = ({ onExit = vi.fn(), ...props } = {}) =>
  render(
    <MuiTestProvider>
      <ProductionImmersiveModeApp
        {...props}
        dependencies={testDependencies}
        onExit={onExit}
        onRommConnect={props.onRommConnect ?? noOp}
        rommToken={props.rommToken ?? null}
        rommUrl={props.rommUrl ?? null}
      />
    </MuiTestProvider>
  );

/** @template T @returns {PromiseWithResolvers<T>} Deferred promise. */
export const createDeferred = () => Promise.withResolvers();

/** @template T @param {PromiseWithResolvers<T>} deferred @param {T} value Resolve a deferred operation. */
export const resolveDeferred = (deferred, value) => {
  act(() => {
    deferred.resolve(value);
  });
};

/** @typedef {{actionId: number, controllerIndex: number, deferred: boolean, elapsedSincePreviousMs: number|null, key: string, phase: string}} ControllerAction */

/** @param {EventTarget} target @param {string} key @param {{repeat?: boolean, action?: ControllerAction|null}} [options] */
export const dispatchControllerKeyTo = (
  target,
  key,
  { repeat = false, action = null } = {}
) => {
  const code = key === "H" || key === "h" ? "KeyH" : "";
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    code,
    key,
    repeat,
  });
  attachControllerAction(event, action);
  act(() => {
    target.dispatchEvent(event);
  });
};

/** @param {string} key @param {{repeat?: boolean, action?: ControllerAction|null}} [options] */
export const dispatchControllerKey = (key, options = {}) => {
  dispatchControllerKeyTo(window, key, options);
};

/** Reset app DOM, mocks, and debug environment. */
export const resetImmersiveModeTest = () => {
  cleanup();
  invoke.mockReset();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
};

export const noOpCallback = noOp;
export const initialGames = [
  { id: 1, name: "First Game", platform_id: "gba" },
  { id: 2, name: "Second Game", platform_id: "gba" },
];
export const immersivePlatforms = [
  [{ id: "gba", name: "Game Boy Advance" }, 61],
  [{ id: "snes", name: "Super Nintendo" }, 2],
];
