import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cleanupGameDetailsTest,
  createDeferred,
  createVoidCallback,
  dispatchEvent,
  eventListeners,
  invoke,
  listen,
  remoteOnlyGame,
  renderDetails,
  switchRemoteGame,
} from "./game-details-test-fixtures";

describe("GameDetails remote Play", () => {
  afterEach(cleanupGameDetailsTest);

  it("offers Play while retaining manual Download ROM", () => {
    renderDetails();

    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Download ROM" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sync Updates & DLC" })
    ).not.toBeInTheDocument();
  });

  it("shows Switch content sync only for an authenticated RomM Switch game", () => {
    renderDetails({ game: switchRemoteGame });

    expect(
      screen.getByRole("button", { name: "Sync Updates & DLC" })
    ).toBeInTheDocument();
  });
});

describe("GameDetails Switch content sync", () => {
  afterEach(cleanupGameDetailsTest);

  it("dispatches Switch content sync once and reports its completion summary", async () => {
    /** @type {PromiseWithResolvers<{downloaded: number, message: string, reused: number, success: boolean}>} */
    const syncRequest = createDeferred();
    invoke.mockImplementation(async (command) => {
      if (command === "sync_switch_content") {
        return await syncRequest.promise;
      }
      return { display: {} };
    });
    renderDetails({ game: switchRemoteGame });

    const sync = screen.getByRole("button", { name: "Sync Updates & DLC" });
    fireEvent.click(sync);
    fireEvent.click(sync);

    expect(invoke).toHaveBeenCalledWith("sync_switch_content", {
      gameId: switchRemoteGame.id,
    });
    expect(
      invoke.mock.calls.filter(([command]) => command === "sync_switch_content")
    ).toHaveLength(1);
    expect(sync).toBeDisabled();

    syncRequest.resolve({
      downloaded: 1,
      message: "Synced Switch content: 1 downloaded, 2 reused.",
      reused: 2,
      success: true,
    });
    await expect(
      screen.findByText("Synced Switch content: 1 downloaded, 2 reused.")
    ).resolves.toBeInTheDocument();
  });
});

describe("GameDetails Switch content progress", () => {
  afterEach(cleanupGameDetailsTest);

  it("renders Switch content progress and actionable retry guidance", async () => {
    window.__TAURI_INTERNALS__ = {};
    listen.mockImplementation(async (event, handler) => {
      eventListeners.set(event, handler);
      const unsubscribe = () => {
        eventListeners.delete(event);
      };
      return await Promise.resolve(unsubscribe);
    });
    /** @type {PromiseWithResolvers<{message: string, success: boolean}>} */
    const syncRequest = createDeferred();
    invoke.mockImplementation(async (command) => {
      if (command === "sync_switch_content") {
        return await syncRequest.promise;
      }
      return { display: {} };
    });
    renderDetails({ game: switchRemoteGame });

    await waitFor(() => {
      if (!eventListeners.has("switch-content-sync-progress")) {
        throw new Error("Switch content progress listener is not registered");
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Sync Updates & DLC" }));
    act(() => {
      dispatchEvent("switch-content-sync-progress", {
        downloaded: 512,
        file_index: 1,
        game_id: switchRemoteGame.id,
        percent: 50,
        stage: "downloading",
        total: 1024,
        total_files: 2,
      });
    });
    expect(
      screen.getByTestId("switch-content-sync-progress")
    ).toHaveTextContent("Downloading Switch content… (1/2)");
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "50"
    );

    syncRequest.resolve({
      message: "Synced Switch content: 1 downloaded, 1 reused.",
      success: true,
    });
    await waitFor(() => {
      expect(screen.getByText(/1 downloaded, 1 reused/u)).toBeInTheDocument();
    });

    invoke.mockImplementation(async (command) => {
      if (command === "sync_switch_content") {
        return await Promise.reject(new Error("Eden is running"));
      }
      return await Promise.resolve({ display: {} });
    });
    fireEvent.click(screen.getByRole("button", { name: "Sync Updates & DLC" }));
    await expect(
      screen.findByText(
        /Eden is running.*Choose “Sync Updates & DLC” to retry/u
      )
    ).resolves.toBeInTheDocument();
  });
});

describe("GameDetails ROM downloads", () => {
  afterEach(cleanupGameDetailsTest);

  it("downloads a ROM manually and updates the game", async () => {
    const onGameUpdate = createVoidCallback();
    renderDetails({ onGameUpdate });

    fireEvent.click(screen.getByRole("button", { name: "Download ROM" }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("download_rom", {
        gameId: remoteOnlyGame.id,
        serverUrl: "https://romm.example",
        token: "saved-token",
      });
    });
    await expect(
      screen.findByText("Downloaded! Ready to play.")
    ).resolves.toBeInTheDocument();
    expect(onGameUpdate).toHaveBeenCalledWith(remoteOnlyGame.id);
    expect(
      screen.getByRole("button", { name: "Re-download" })
    ).toBeInTheDocument();
  });

  it("deletes a cached RomM download through More options", async () => {
    const cachedGame = {
      ...remoteOnlyGame,
      local_file_path: "/roms/cloud-game.gba",
      sync_state: "synced",
    };
    const onGameUpdate = createVoidCallback();
    renderDetails({ game: cachedGame, onGameUpdate });

    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Delete Download" })
    );

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("delete_local_rom", {
        gameId: cachedGame.id,
      });
    });
    await expect(
      screen.findByText("ROM deleted successfully")
    ).resolves.toBeInTheDocument();
    expect(onGameUpdate).toHaveBeenCalledWith(cachedGame.id);
  });
});

describe("GameDetails overflow actions", () => {
  afterEach(cleanupGameDetailsTest);

  it("keeps the overflow menu focused on working actions", () => {
    renderDetails({
      game: {
        ...remoteOnlyGame,
        local_file_path: "/roms/cloud-game.gba",
        sync_state: "synced",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "More options" }));

    expect(
      screen.queryByRole("menuitem", { name: /Manage cached saves/u })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /Ratings & status/u })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /Change emulator/u })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Delete Download" })
    ).toBeInTheDocument();
  });

  it("uses the unified status chips and exposes the favorite affordance", () => {
    renderDetails();

    const statusChips = screen
      .getByTestId("game-status-chips")
      .querySelectorAll(".MuiChip-root");
    expect(statusChips).toHaveLength(3);
    expect(
      screen.getByRole("button", { name: "Add Cloud Game to favorites" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "More options" })
    ).toBeInTheDocument();
  });
});

describe("GameDetails launch retry", () => {
  afterEach(cleanupGameDetailsTest);

  it("deduplicates Play activation until the preparation finishes", async () => {
    /** @type {PromiseWithResolvers<{success: boolean}>} */
    const launch = createDeferred();
    const onLaunch = vi.fn(async () => await launch.promise);
    renderDetails({ onLaunch });

    const play = screen.getByRole("button", { name: "Play" });
    fireEvent.click(play);
    fireEvent.click(play);

    expect(onLaunch).toHaveBeenCalledOnce();
    expect(play).toBeDisabled();

    launch.resolve({ success: true });
    await waitFor(() => {
      expect(play).not.toBeDisabled();
    });
  });

  it("keeps Play retryable after a failed preparation", async () => {
    const onLaunch = vi
      .fn()
      .mockResolvedValueOnce({ error: "download failed", success: false })
      .mockResolvedValueOnce({ success: true });
    renderDetails({ onLaunch });

    const play = screen.getByRole("button", { name: "Play" });
    fireEvent.click(play);
    await waitFor(() => {
      expect(screen.getByText(/download failed/u)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Play" })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(onLaunch).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("button", { name: "Play" })).not.toBeDisabled();
    });
  });
});

describe("GameDetails emulator guidance", () => {
  afterEach(cleanupGameDetailsTest);

  it("translates missing emulator errors into plain guidance without offering Retry", async () => {
    const onOpenSettings = createVoidCallback();
    const onLaunch = vi.fn().mockResolvedValue({
      error: "No compatible RetroArch core is installed for ps2",
      success: false,
    });
    renderDetails({
      game: { ...remoteOnlyGame, platform_id: "ps2" },
      onLaunch,
      onOpenSettings,
      platforms: [[{ id: "ps2", name: "PlayStation 2" }, 1]],
    });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => {
      expect(
        screen.getByText(/no compatible emulator is installed/iu)
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("alert")).toHaveTextContent("PlayStation 2");
    expect(
      screen.queryByRole("button", { name: "Retry" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open Settings" })
    ).toBeInTheDocument();
    expect(screen.queryByText(/certified|promised/iu)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it("routes the disabled achievements link to Integrations settings", async () => {
    const onOpenIntegrations = createVoidCallback();
    renderDetails({ onOpenIntegrations });

    const integrationsLink = await screen.findByRole("link", {
      name: "Enable it in Settings → Integrations.",
    });
    fireEvent.click(integrationsLink);

    expect(onOpenIntegrations).toHaveBeenCalledOnce();
  });
});

describe("GameDetails launch progress", () => {
  afterEach(cleanupGameDetailsTest);

  it("renders staged launch preparation progress from the public event", async () => {
    window.__TAURI_INTERNALS__ = {};
    listen.mockImplementation(async (event, handler) => {
      eventListeners.set(event, handler);
      const unsubscribe = () => {
        eventListeners.delete(event);
      };
      return await Promise.resolve(unsubscribe);
    });
    renderDetails();

    await waitFor(() => {
      expect(eventListeners.has("game-launch-progress")).toBeTruthy();
    });

    act(() => {
      dispatchEvent("game-launch-progress", {
        game_id: remoteOnlyGame.id,
        stage: "bios_preparation",
      });
    });

    expect(screen.getByText("Preparing BIOS...")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).not.toHaveAttribute(
      "aria-valuenow"
    );

    act(() => {
      dispatchEvent("game-launch-progress", {
        downloaded: 512 * 1024,
        game_id: remoteOnlyGame.id,
        percent: 50,
        stage: "downloading",
        total: 1024 * 1024,
      });
    });

    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "50"
    );
    expect(screen.getByText(/50%.*512\.0 KB.*1\.00 MB/u)).toBeInTheDocument();

    act(() => {
      dispatchEvent("game-launch-progress", {
        downloaded: 512 * 1024,
        game_id: remoteOnlyGame.id,
        percent: null,
        stage: "downloading",
        total: null,
      });
    });

    expect(screen.getByRole("progressbar")).not.toHaveAttribute(
      "aria-valuenow"
    );
  });
});
