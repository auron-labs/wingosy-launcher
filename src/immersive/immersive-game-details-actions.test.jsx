import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDeferred,
  createVoidCallback,
  dispatchEvent,
  eventListeners,
  invoke,
  listen,
  remoteOnlyGame,
  renderDetails,
  resetImmersiveGameDetailsTest,
  resolveDeferred,
  switchRemoteGame,
} from "./immersive-game-details-test-fixtures";

describe("ImmersiveGameDetails integrations action", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("passes the Integrations navigation callback to the achievements section", () => {
    const onOpenIntegrations = createVoidCallback();
    renderDetails(
      vi.fn().mockResolvedValue({ success: true }),
      remoteOnlyGame,
      {
        onOpenIntegrations,
      }
    );

    screen
      .getByRole("link", {
        name: "Enable it in Settings → Integrations.",
      })
      .click();

    expect(onOpenIntegrations).toHaveBeenCalledOnce();
  });
});

describe("ImmersiveGameDetails primary launch action", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it.each([
    [
      "a local-only game",
      {
        ...remoteOnlyGame,
        id: 8,
        local_file_path: "/roms/local.gba",
        name: "Local Game",
        romm_id: null,
        source: "Local",
        sync_state: "local_only",
      },
    ],
    [
      "a cached RomM game",
      {
        ...remoteOnlyGame,
        id: 9,
        local_file_path: "/roms/cached.gba",
        name: "Cached Game",
        sync_state: "synced",
      },
    ],
  ])("routes Play for %s through onLaunch", async (_label, game) => {
    const onLaunch = vi.fn().mockResolvedValue({ success: true });
    renderDetails(onLaunch, game);

    screen.getByRole("button", { name: "Play" }).click();

    await waitFor(() => {
      expect(onLaunch).toHaveBeenCalledWith(game.id);
    });
  });
});

describe("ImmersiveGameDetails remote-only actions", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("offers Download as the sole primary action for a remote-only RomM game", () => {
    const onLaunch = vi.fn().mockResolvedValue({ success: true });
    renderDetails(onLaunch);

    expect(
      screen.queryByRole("button", { name: "Play" })
    ).not.toBeInTheDocument();
    const download = screen.getByRole("button", { name: "Download" });
    expect(download).toHaveClass("MuiButton-contained");
    expect(
      screen
        .getAllByRole("button")
        .filter((button) => button.classList.contains("MuiButton-contained"))
    ).toHaveLength(1);
    expect(onLaunch).not.toHaveBeenCalled();
  });
});

describe("ImmersiveGameDetails Switch content action", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("shows and dispatches the explicit Switch content action without disturbing Play", async () => {
    invoke.mockImplementation(async (command) => {
      if (command === "sync_switch_content") {
        return await Promise.resolve({
          downloaded: 1,
          message: "Synced Switch content: 1 downloaded, 1 reused.",
          reused: 1,
          success: true,
        });
      }
      return await Promise.resolve({ display: {} });
    });
    const onLaunch = vi.fn().mockResolvedValue({ success: true });
    renderDetails(onLaunch, switchRemoteGame);

    expect(
      screen.getByRole("button", { name: "Sync Updates & DLC" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Play" })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sync Updates & DLC" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Syncing Updates & DLC…" })
    );

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("sync_switch_content", {
        gameId: switchRemoteGame.id,
      });
    });
    expect(
      invoke.mock.calls.filter(([command]) => command === "sync_switch_content")
    ).toHaveLength(1);
    await expect(
      screen.findByText("Synced Switch content: 1 downloaded, 1 reused.")
    ).resolves.toBeInTheDocument();
  });
});

describe("ImmersiveGameDetails protected Eden saves", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("resumes normal sync and refreshes the protected revision", async () => {
    /** @type {import("../components/game/game-details-types").GameDetailsSwitchSaveRestoreProtection|null} */
    let protection = {
      selected_revision: {
        file_name: "restored-switch-save.zip",
        id: 9001,
        slot: "before-final-boss",
        updated_at: "2026-09-18T10:00:00Z",
      },
    };
    invoke.mockImplementation(async (command) => {
      if (command === "get_switch_save_restore_protection") {
        return await Promise.resolve(protection);
      }
      if (command === "resume_switch_save_normal_sync") {
        protection = null;
        await Promise.resolve();
      }
      return await Promise.resolve({ display: {} });
    });
    renderDetails(undefined, switchRemoteGame);

    await expect(
      screen.findByText("Protected Eden revision")
    ).resolves.toBeInTheDocument();
    expect(screen.getByText(/restored-switch-save\.zip/u)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Resume normal sync" }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("resume_switch_save_normal_sync", {
        gameId: switchRemoteGame.id,
      });
      expect(
        screen.queryByText("Protected Eden revision")
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByText("Normal Eden save sync resumed.")
    ).toBeInTheDocument();
  });
});

const installProgressListener = () => {
  window.__TAURI_INTERNALS__ = {};
  listen.mockImplementation(async (event, handler) => {
    eventListeners.set(event, handler);
    return await Promise.resolve(() => {
      eventListeners.delete(event);
    });
  });
};

describe("ImmersiveGameDetails Switch content progress", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("shows Switch content progress while synchronizing", async () => {
    installProgressListener();
    /** @type {PromiseWithResolvers<{message: string, success: boolean}>} */
    const sync = createDeferred();
    invoke.mockImplementation(async (command) =>
      command === "sync_switch_content"
        ? await sync.promise
        : await Promise.resolve({ display: {} })
    );
    renderDetails(undefined, switchRemoteGame);

    await waitFor(() => {
      expect(eventListeners.has("switch-content-sync-progress")).toBeTruthy();
    });
    screen.getByRole("button", { name: "Sync Updates & DLC" }).click();
    act(() => {
      dispatchEvent("switch-content-sync-progress", {
        downloaded: null,
        file_index: 2,
        game_id: switchRemoteGame.id,
        percent: null,
        stage: "registering",
        total: null,
        total_files: 2,
      });
    });
    expect(
      screen.getByTestId("switch-content-sync-progress")
    ).toHaveTextContent("Registering content with Eden… (2/2)");
    resolveDeferred(sync, {
      message: "Synced Switch content: 2 downloaded, 0 reused.",
      success: true,
    });
    await expect(
      screen.findByText("Synced Switch content: 2 downloaded, 0 reused.")
    ).resolves.toBeInTheDocument();
  });
});

describe("ImmersiveGameDetails Switch content retry", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("shows retry guidance after a failed content synchronization", async () => {
    invoke.mockImplementation(async (command) =>
      command === "sync_switch_content"
        ? await Promise.reject(new Error("Eden is running"))
        : await Promise.resolve({ display: {} })
    );
    renderDetails(undefined, switchRemoteGame);

    screen.getByRole("button", { name: "Sync Updates & DLC" }).click();
    await waitFor(() => {
      expect(
        screen.getByText(
          /Eden is running.*Choose “Sync Updates & DLC” to retry/u
        )
      ).toBeInTheDocument();
    });
  });
});
