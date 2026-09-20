import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MuiTestProvider } from "../test/mui-harness";
import RommSyncMonitor from "./romm-sync-monitor";
import { useRommSyncMonitor } from "./use-romm-sync-monitor";

/** @type {import("vitest").MockInstance & {<T>(command: string, args?: Record<string, unknown>): Promise<T>}} */
const invoke = vi.fn();

/** @type {import("../app/app-runtime").AppRuntime["listen"]} */
const listen = async () => {
  await Promise.resolve();
  return () => {};
};

const runtime = {
  getCurrentWindow: () => ({
    isFullscreen: async () => await Promise.resolve(false),
    onResized: async () => await Promise.resolve(() => {}),
    startDragging: async () => {
      await Promise.resolve();
    },
  }),
  invoke,
  listen,
  openUrl: async () => {
    await Promise.resolve();
  },
};

const overview = [
  {
    installed_games: 2,
    local_games: 3,
    name: "Nintendo Switch",
    platform_id: "switch",
    romm_platform_id: 11,
    server_games: 4,
  },
];

/** @param {PromiseWithResolvers<unknown>} sync Deferred sync operation. @param {typeof overview} platforms Remote overview. */
const configureIpc = (sync, platforms = overview) => {
  invoke.mockImplementation(async (command) => {
    if (command === "list_romm_sync_platforms") {
      return platforms;
    }
    if (command === "sync_romm_platform" || command === "sync_romm_library") {
      return await sync.promise;
    }
    return null;
  });
};

/** @param {{refreshLibrary: () => Promise<unknown>}} props Monitor harness properties. */
const MonitorHarness = ({ refreshLibrary }) => {
  const monitor = useRommSyncMonitor({
    refreshLibrary,
    rommToken: "test-token",
    rommUrl: "https://romm.example",
    runtime,
  });
  return <RommSyncMonitor monitor={monitor} />;
};

const resetTest = () => {
  cleanup();
  invoke.mockReset();
};

describe("RomM sync refresh failures", () => {
  afterEach(resetTest);

  it("keeps a scoped sync successful when the library refresh fails", async () => {
    const sync = Promise.withResolvers();
    configureIpc(sync);
    const refreshLibrary = vi
      .fn()
      .mockRejectedValue(new Error("library refresh failed"));

    render(
      <MuiTestProvider>
        <MonitorHarness refreshLibrary={refreshLibrary} />
      </MuiTestProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "Sync Nintendo Switch library metadata",
        })
      ).toBeInTheDocument();
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Sync Nintendo Switch library metadata",
      })
    );
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
      expect(
        screen.getByText(
          "Sync completed, but refreshing the library view failed: library refresh failed"
        )
      ).toBeInTheDocument();
    });
    expect(refreshLibrary).toHaveBeenCalledOnce();
  });

  it("keeps Sync all successful when the library refresh fails", async () => {
    const sync = Promise.withResolvers();
    configureIpc(sync, []);
    const refreshLibrary = vi
      .fn()
      .mockRejectedValue(new Error("library refresh failed"));

    render(
      <MuiTestProvider>
        <MonitorHarness refreshLibrary={refreshLibrary} />
      </MuiTestProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Sync all" })
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Sync all" }));
    sync.resolve([]);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Sync completed, but refreshing the library view failed: library refresh failed"
        )
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Sync all" })
      ).toBeInTheDocument();
    });
    expect(refreshLibrary).toHaveBeenCalledOnce();
  });
});
