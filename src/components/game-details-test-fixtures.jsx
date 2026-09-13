import { cleanup, render } from "@testing-library/react";
import { vi } from "vitest";

import { RomDownloadsProvider } from "../rom-downloads-context";
import { MuiTestProvider } from "../test/mui-harness";
import GameDetails from "./game-details";
import { createGameDetailsTestIpc } from "./game/game-details-test-ipc";

/** @typedef {import("./game/game-details-types").GameDetailsGame} GameDetailsGame */
/** @typedef {import("./game/game-details-types").GameDetailsPlatform} GameDetailsPlatform */
/** @typedef {(command: string, args?: Record<string, unknown>) => unknown} InvokeMock */
/** @typedef {import("../test/invoke-mocks").GameDetailsTestInvoke} TypedInvoke */

/** @typedef {(event: string, handler: (event: {payload: unknown}) => void) => Promise<() => void>} ListenMock */
/** @type {{invoke: import("vitest").Mock<InvokeMock>, listen: import("vitest").Mock<ListenMock>}} */
export const { invoke, listen } = {
  invoke: vi.fn(),
  listen: vi.fn(),
};
/** @type {TypedInvoke} */
// @ts-expect-error -- The forwarding mock is backed by the typed command fixtures below.
const invokeForIpc = invoke;
/** @type {import("vitest").MockedFunction<typeof import("@tauri-apps/plugin-dialog").open>} */
export const openDialog = vi.fn();
export const testIpc = createGameDetailsTestIpc(invokeForIpc);
/** @type {Map<string, (event: {payload: unknown}) => void>} */
export const eventListeners = new Map();

/** @template T @returns {PromiseWithResolvers<T>} Deferred promise. */
export const createDeferred = () => Promise.withResolvers();

/** @param {string} eventName Event name. @param {unknown} payload Event payload. */
export const dispatchEvent = (eventName, payload) => {
  const handler = eventListeners.get(eventName);
  if (!handler) {
    throw new Error(`Missing test event listener: ${eventName}`);
  }
  handler({ payload });
};

/** @returns {import("vitest").Mock<() => void>} Void callback mock. */
export const createVoidCallback = () => vi.fn();

/** @type {GameDetailsGame} */
export const remoteOnlyGame = {
  cover_path: null,
  file_path: "https://romm.example/api/roms/42/content/cloud.gba",
  genres: [],
  id: 7,
  is_favorite: false,
  is_hidden: false,
  local_file_path: null,
  name: "Cloud Game",
  platform_id: "gba",
  play_count: 0,
  play_time_minutes: 0,
  romm_id: 42,
  screenshot_paths: [],
  source: "RomM",
  sync_state: "remote_only",
};

/** @param {{game?: GameDetailsGame, onLaunch?: (gameId: number|string) => Promise<{success?: boolean, error?: string|null}>, onBack?: () => void, onToggleFavorite?: (gameId: number|string) => void, onGameUpdate?: (gameId: number|string) => void, onOpenSettings?: () => void, onOpenIntegrations?: () => void, platforms?: Array<[GameDetailsPlatform, number]>, rommToken?: string|null, rommUrl?: string|null}} [options] Details test options. */
export const renderDetails = ({
  game = remoteOnlyGame,
  onLaunch = vi.fn(),
  onBack = vi.fn(),
  onToggleFavorite = vi.fn(),
  onGameUpdate = vi.fn(),
  onOpenSettings = vi.fn(),
  onOpenIntegrations = vi.fn(),
  platforms = [],
  rommToken = "saved-token",
  rommUrl = "https://romm.example",
} = {}) =>
  render(
    <MuiTestProvider>
      <RomDownloadsProvider listen={listen}>
        <GameDetails
          game={game}
          platforms={platforms}
          onBack={onBack}
          onLaunch={onLaunch}
          onToggleFavorite={onToggleFavorite}
          onGameUpdate={onGameUpdate}
          onOpenSettings={onOpenSettings}
          onOpenIntegrations={onOpenIntegrations}
          rommToken={rommToken}
          rommUrl={rommUrl}
          dependencies={{ ipc: testIpc, openDialog }}
        />
      </RomDownloadsProvider>
    </MuiTestProvider>
  );

/** Reset the DOM and dependency doubles between detail tests. */
export const cleanupGameDetailsTest = () => {
  cleanup();
  eventListeners.clear();
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  invoke.mockReset();
  invoke.mockResolvedValue({ display: {} });
  listen.mockReset();
  openDialog.mockReset();
};

invoke.mockResolvedValue({ display: {} });

export const switchRemoteGame = {
  ...remoteOnlyGame,
  file_path: "Switch Cloud Game.nsp",
  id: 17,
  name: "Switch Cloud Game",
  platform_id: "switch",
};
