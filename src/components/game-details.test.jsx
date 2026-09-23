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
  createDetailsElement,
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

const countAchievementRequests = () =>
  invoke.mock.calls.filter(
    ([command]) => command === "get_romm_retroachievements"
  ).length;

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
      screen.findByText(/Eden is running/u)
    ).resolves.toBeInTheDocument();
  });
});

const countSwitchStatusCalls = () =>
  invoke.mock.calls.filter(
    ([command]) => command === "get_switch_content_status"
  ).length;

describe("GameDetails Switch content status", () => {
  afterEach(cleanupGameDetailsTest);

  it("loads the read-only status on open and again after reopening", async () => {
    invoke.mockImplementation((command) => {
      if (command === "get_switch_content_status") {
        return { status: "current" };
      }
      return { display: {} };
    });

    const view = renderDetails({ game: switchRemoteGame });
    await waitFor(() => {
      expect(countSwitchStatusCalls()).toBe(1);
    });
    expect(
      screen.queryByTestId("switch-content-status")
    ).not.toBeInTheDocument();
    view.unmount();

    renderDetails({ game: switchRemoteGame });
    await waitFor(() => {
      expect(countSwitchStatusCalls()).toBe(2);
    });
    expect(
      screen.queryByTestId("switch-content-status")
    ).not.toBeInTheDocument();
  });

  it("refreshes the status after a successful Sync Updates & DLC", async () => {
    let status = "missing";
    invoke.mockImplementation((command) => {
      if (command === "get_switch_content_status") {
        return { status };
      }
      if (command === "sync_switch_content") {
        status = "current";
        return {
          downloaded: 1,
          message: "Synced Switch content: 1 downloaded, 0 reused.",
          reused: 0,
          success: true,
        };
      }
      return { display: {} };
    });
    renderDetails({ game: switchRemoteGame });

    await expect(
      screen.findByTestId("switch-content-status")
    ).resolves.toHaveTextContent("Wingosy update & DLC files are missing");

    fireEvent.click(screen.getByRole("button", { name: "Sync Updates & DLC" }));
    await waitFor(() => {
      expect(
        screen.queryByTestId("switch-content-status")
      ).not.toBeInTheDocument();
    });
  });

  it("does not claim current when the status lookup is unavailable", async () => {
    invoke.mockImplementation((command) => {
      if (command === "get_switch_content_status") {
        throw new Error("RomM is offline");
      }
      return { display: {} };
    });
    renderDetails({ game: switchRemoteGame });

    await waitFor(() => {
      expect(
        screen.queryByTestId("switch-content-status")
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/current/u)).not.toBeInTheDocument();
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

  it("dismisses a retained launch failure until the next failed Play", async () => {
    window.__TAURI_INTERNALS__ = {};
    listen.mockImplementation(async (event, handler) => {
      eventListeners.set(event, handler);
      const unsubscribe = () => {
        eventListeners.delete(event);
      };
      return await Promise.resolve(unsubscribe);
    });
    const onLaunch = vi
      .fn()
      .mockResolvedValueOnce({ error: "first launch failed", success: false })
      .mockResolvedValueOnce({ error: "second launch failed", success: false });
    const view = renderDetails({ onLaunch });

    await waitFor(() => {
      if (!eventListeners.has("game-launch-progress")) {
        throw new Error("Launch progress listener is not registered");
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await screen.findByText("first launch failed");
    act(() => {
      dispatchEvent("game-launch-progress", {
        error: "retained launch failure",
        game_id: remoteOnlyGame.id,
        stage: "failure",
      });
    });

    const dismiss = screen.getByRole("button", {
      name: "Dismiss launch error",
    });
    dismiss.focus();
    expect(dismiss).toHaveFocus();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    fireEvent.click(dismiss);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    view.rerender(createDetailsElement({ onLaunch }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await screen.findByText("second launch failed");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("GameDetails cloud saves", () => {
  afterEach(cleanupGameDetailsTest);

  it("reports launch save-sync warnings without treating controller warnings as cloud errors", async () => {
    const onLaunch = vi
      .fn()
      .mockResolvedValueOnce({
        save_sync_warnings: ["Eden controller profile is unavailable"],
        success: true,
      })
      .mockResolvedValueOnce({
        error: "The game exited unexpectedly",
        save_sync_warnings: ["Post-launch save sync: RomM is offline"],
        success: false,
      });
    invoke.mockImplementation(async (command) => {
      if (command === "get_switch_game_saves") {return [];}
      if (command === "get_switch_save_path_info") {return null;}
      return { display: {} };
    });
    renderDetails({ game: switchRemoteGame, onLaunch });

    const play = screen.getByRole("button", { name: "Play" });
    fireEvent.click(play);
    await waitFor(() => {
      expect(play).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    const firstHistory = await screen.findByRole("dialog", {
      name: "Save history",
    });
    await within(firstHistory).findByText("No cloud saves yet.");
    expect(firstHistory).not.toHaveTextContent(
      "Automatic cloud sync did not finish"
    );
    fireEvent.click(
      within(firstHistory).getByRole("button", { name: "Close" })
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Save history" })
      ).not.toBeInTheDocument();
    });

    fireEvent.click(play);
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    const history = await screen.findByRole("dialog", { name: "Save history" });
    await expect(
      within(history).findByText(
        "Automatic cloud sync did not finish. Review the cloud copies below, then use Sync current save after resolving the issue."
      )
    ).resolves.toBeInTheDocument();
    expect(history).not.toHaveTextContent(
      "Post-launch save sync: RomM is offline"
    );
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

describe("GameDetails RetroAchievements delivery", () => {
  afterEach(cleanupGameDetailsTest);

  it("delivers mapped achievement rows through the RomM details seam", async () => {
    const achievements = [
      { id: 101, points: 10, title: "Earned", unlocked: true },
      { id: 102, points: 20, title: "Locked", unlocked: false },
    ];
    invoke.mockImplementation((command) => {
      if (command === "get_config") {
        return { display: { retroachievements_enabled: true } };
      }
      if (command === "get_romm_retroachievements") {
        return achievements;
      }
      return { display: {} };
    });

    renderDetails();

    await waitFor(() => {
      expect(screen.getByText("(1/2)")).toBeInTheDocument();
    });
    expect(invoke).toHaveBeenCalledWith("get_romm_retroachievements", {
      refreshProgression: false,
      romId: remoteOnlyGame.romm_id,
      serverUrl: "https://romm.example",
      token: "saved-token",
    });

    fireEvent.click(screen.getByRole("button", { name: "View all" }));
    expect(screen.getByText("Earned")).toBeInTheDocument();
    expect(screen.getByText("Locked")).toBeInTheDocument();
  });

  it("does not reload ordinary progress for an equivalent game object", async () => {
    invoke.mockImplementation((command) => {
      if (command === "get_config") {
        return { display: { retroachievements_enabled: true } };
      }
      if (command === "get_romm_retroachievements") {
        return [{ id: 101, title: "Earned", unlocked: true }];
      }
      return { display: {} };
    });

    const view = renderDetails();
    await waitFor(() => {
      expect(screen.getByText("(1/1)")).toBeInTheDocument();
    });
    view.rerender(createDetailsElement({ game: { ...remoteOnlyGame } }));

    expect(countAchievementRequests()).toBe(1);
  });
});

describe("GameDetails RetroAchievements refresh", () => {
  afterEach(cleanupGameDetailsTest);

  it("retains the previous rows and marks them after a rejected refresh", async () => {
    let achievementRequests = 0;
    invoke.mockImplementation((command) => {
      if (command === "get_config") {
        return { display: { retroachievements_enabled: true } };
      }
      if (command === "get_romm_retroachievements") {
        achievementRequests += 1;
        if (achievementRequests === 1) {
          return [{ id: 101, title: "Earned", unlocked: true }];
        }
        throw new Error("refresh unavailable");
      }
      return { display: {} };
    });

    renderDetails();
    await waitFor(() => {
      expect(screen.getByText("(1/1)")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Refresh achievement progress" })
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("achievements-previous-result")
      ).toHaveTextContent("refresh unavailable");
    });
    expect(screen.getByText("(1/1)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh achievement progress" })
    ).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "View all" }));
    expect(screen.getByText("Earned")).toBeInTheDocument();
  });
});

describe("GameDetails RetroAchievements errors", () => {
  afterEach(cleanupGameDetailsTest);

  it("shows an initial request failure instead of empty or locked progress", async () => {
    invoke.mockImplementation((command) => {
      if (command === "get_config") {
        return { display: { retroachievements_enabled: true } };
      }
      if (command === "get_romm_retroachievements") {
        throw new Error("RomM authentication failed");
      }
      return { display: {} };
    });

    renderDetails();

    await waitFor(() => {
      expect(screen.getByTestId("achievements-error")).toHaveTextContent(
        "RomM authentication failed"
      );
    });
    expect(screen.queryByTestId("achievements-empty")).not.toBeInTheDocument();
    expect(screen.queryByText(/0\/0/u)).not.toBeInTheDocument();
  });
});

describe("GameDetails RetroAchievements request identity", () => {
  afterEach(cleanupGameDetailsTest);

  it("ignores a pending response when the viewed game changes", async () => {
    const oldRequest = createDeferred();
    const nextGame = {
      ...remoteOnlyGame,
      id: 8,
      name: "Next Cloud Game",
      romm_id: 43,
    };
    invoke.mockImplementation(async (command, args) => {
      if (command === "get_config") {
        return { display: { retroachievements_enabled: true } };
      }
      if (command === "get_romm_retroachievements") {
        if (args?.romId === remoteOnlyGame.romm_id) {
          return await oldRequest.promise;
        }
        return [{ id: 201, title: "Next achievement", unlocked: false }];
      }
      return { display: {} };
    });

    const view = renderDetails();
    await waitFor(() => {
      expect(countAchievementRequests()).toBe(1);
    });
    view.rerender(createDetailsElement({ game: nextGame }));

    await waitFor(() => {
      expect(screen.getByText("(0/1)")).toBeInTheDocument();
    });
    await act(async () => {
      oldRequest.resolve([
        { id: 101, title: "Old achievement", unlocked: true },
      ]);
      await oldRequest.promise;
    });
    expect(screen.queryByText("(1/1)")).not.toBeInTheDocument();
    expect(screen.getByText("(0/1)")).toBeInTheDocument();
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
