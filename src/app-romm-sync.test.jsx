import { clearMocks, mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./app";

/** @type {import("vitest").MockInstance & {<T>(command: string, args?: Record<string, unknown>): Promise<T>}} */
const ipcHandler = vi.fn();

/** @type {((event: {payload: {romm_platform_id?: number, processed?: number, total?: number}}) => void)|null} */
let progressHandler = null;

/** @type {import("./app/app-runtime").AppRuntime["listen"]} */
const listen = async (event, handler) => {
  await Promise.resolve();
  if (event === "romm-platform-sync-progress") {
    progressHandler = handler;
  }
  return () => {
    if (
      event === "romm-platform-sync-progress" &&
      progressHandler === handler
    ) {
      progressHandler = null;
    }
  };
};

const runtime = {
  getCurrentWindow: () => ({
    isFullscreen: async () => {
      await Promise.resolve();
      return false;
    },
    onResized: async () => {
      await Promise.resolve();
      return () => {};
    },
    startDragging: async () => {
      await Promise.resolve();
    },
  }),
  invoke: ipcHandler,
  listen,
  openUrl: async () => {
    await Promise.resolve();
  },
};

const games = [
  {
    id: 1,
    is_favorite: true,
    local_file_path: "/roms/starred-quest.nsp",
    name: "Starred Quest",
    platform_id: "switch",
    source: "Local",
    sync_state: "local_only",
  },
  {
    id: 2,
    is_favorite: false,
    local_file_path: "/roms/unstarred-quest.nsp",
    name: "Unstarred Quest",
    platform_id: "switch",
    source: "Local",
    sync_state: "local_only",
  },
];

const platforms = [
  [{ id: "switch", name: "Nintendo Switch", short_name: "Switch" }, 2],
];

const rommMonitorOverview = [
  {
    installed_games: 2,
    local_games: 3,
    name: "Nintendo Switch",
    platform_id: "switch",
    romm_platform_id: 11,
    server_games: 4,
  },
];

const syncedGame = {
  id: 3,
  is_favorite: false,
  local_file_path: "",
  name: "Synced Quest",
  platform_id: "switch",
  source: "RomM",
  sync_state: "remote_only",
};

/** @typedef {typeof games} TestGames */
/** @typedef {PromiseWithResolvers<unknown>} DeferredSync */
/** @typedef {{getGames?: () => TestGames, sync: DeferredSync}} SyncIpcOptions */

/** @param {SyncIpcOptions} options Sync IPC options. */
const configureRommMonitorIpc = ({ getGames = () => games, sync }) => {
  ipcHandler.mockImplementation(async (command) => {
    if (command === "is_first_run") {
      return false;
    }
    if (command === "get_platforms_with_games") {
      return platforms;
    }
    if (command === "get_config") {
      return {
        display: { big_picture: true },
        romm: {
          auth_token: "test-token",
          server_url: "https://romm.example",
        },
      };
    }
    if (command === "restore_romm_session") {
      return {
        access_token: "test-token",
        server_url: "https://romm.example",
      };
    }
    if (command === "check_for_app_update") {
      return { is_update_available: false };
    }
    if (command === "get_games_page") {
      const currentGames = getGames();
      return { games: currentGames, total: currentGames.length };
    }
    if (command === "list_romm_sync_platforms") {
      return rommMonitorOverview;
    }
    if (command === "sync_romm_platform") {
      return await sync.promise;
    }
    return null;
  });
  mockConvertFileSrc("linux");
  mockIPC(ipcHandler);
};

const resetTest = () => {
  cleanup();
  ipcHandler.mockReset();
  clearMocks();
  progressHandler = null;
};

const renderApp = () => render(<App runtime={runtime} />);

/** @param {{romm_platform_id: number, processed: number, total: number}} payload Progress payload. */
const dispatchProgress = (payload) => {
  progressHandler?.({ payload });
};

const waitForRommSyncButton = async () =>
  await waitFor(() => {
    const button = screen.queryByText("RomM Sync", { selector: "button" });
    if (button === null) {
      throw new Error("RomM Sync is not ready");
    }
    expect(button).toBeEnabled();
    return button;
  });

const openMonitor = async () => {
  fireEvent.click(await waitForRommSyncButton());
  await waitFor(() => {
    expect(screen.getByTestId("romm-sync-monitor")).toBeInTheDocument();
    expect(screen.getByText("Server ROMs")).toBeInTheDocument();
    expect(screen.getByText("Indexed RomM entries")).toBeInTheDocument();
    expect(screen.getByText("Downloaded locally")).toBeInTheDocument();
  });
};

const expectOverviewCounts = () => {
  const platformCard = screen.getByTestId("romm-sync-platform-11");
  expect(within(platformCard).getByText("4")).toBeInTheDocument();
  expect(within(platformCard).getByText("3")).toBeInTheDocument();
  expect(within(platformCard).getByText("2")).toBeInTheDocument();
};

const startPlatformSync = async () => {
  fireEvent.click(
    screen.getByRole("button", {
      name: "Sync Nintendo Switch library metadata",
    })
  );
  await waitFor(() => {
    expect(ipcHandler).toHaveBeenCalledWith("sync_romm_platform", {
      rommPlatformId: 11,
      serverUrl: "https://romm.example",
      token: "test-token",
    });
  });
  dispatchProgress({ processed: 1, romm_platform_id: 11, total: 4 });
  await waitFor(() => {
    expect(
      screen.getByText("Syncing Nintendo Switch library metadata · 1 / 4")
    ).toBeInTheDocument();
  });
};

const returnToMonitor = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Back to library" }));
  fireEvent.click(await waitForRommSyncButton());
  await waitFor(() => {
    expect(
      screen.getByText("Syncing Nintendo Switch library metadata · 1 / 4")
    ).toBeInTheDocument();
  });
};

/** @param {{currentGames: {value: TestGames}, sync: DeferredSync}} options Completion options. */
const completeSync = async ({ currentGames, sync }) => {
  const pageRequestsBeforeSync = ipcHandler.mock.calls.filter(
    ([command]) => command === "get_games_page"
  ).length;
  currentGames.value = [...games, syncedGame];
  sync.resolve({
    games_added: 1,
    games_deleted: 0,
    games_updated: 2,
    total_games: 4,
  });
  await waitFor(() => {
    expect(
      screen.getByText(/Metadata sync complete: 4 indexed/u)
    ).toBeInTheDocument();
    const pageRequests = ipcHandler.mock.calls.filter(
      ([command]) => command === "get_games_page"
    );
    expect(pageRequests.length).toBeGreaterThan(pageRequestsBeforeSync);
    expect(pageRequests.at(-1)).toStrictEqual([
      "get_games_page",
      {
        page: 1,
        pageSize: 60,
        platformId: null,
        searchQuery: null,
      },
    ]);
  });
  fireEvent.click(screen.getByRole("button", { name: "Back to library" }));
  await waitFor(() => {
    expect(screen.getByTestId("immersive-library")).toBeInTheDocument();
    expect(screen.getAllByText("Synced Quest").length).toBeGreaterThan(0);
  });
  return screen.getAllByText("Synced Quest")[0];
};

describe("Real App immersive RomM sync monitor", () => {
  afterEach(resetTest);

  it("preserves progress across monitor navigation and refreshes synced library data", async () => {
    const sync = Promise.withResolvers();
    const currentGames = { value: games };
    configureRommMonitorIpc({
      getGames: () => currentGames.value,
      sync,
    });
    renderApp();
    await openMonitor();
    expectOverviewCounts();
    await startPlatformSync();
    await returnToMonitor();
    await expect(
      completeSync({ currentGames, sync })
    ).resolves.toBeInTheDocument();
  });
});
