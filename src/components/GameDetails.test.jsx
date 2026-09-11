import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RomDownloadsProvider } from "../RomDownloadsContext";
import { MuiTestProvider } from "../test/muiHarness";
import GameDetails from "./GameDetails";

const { invoke, listen } = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
}));
const eventListeners = new Map();

afterEach(() => {
  cleanup();
  eventListeners.clear();
  delete window.__TAURI_INTERNALS__;
  invoke.mockReset();
  listen.mockReset();
});

vi.mock(import("@tauri-apps/api/core"), () => ({
  // These mocks are deterministic UI/command-dispatch evidence, not proof that a real emulator process launches.
  invoke,
  convertFileSrc: (path) => path,
}));

vi.mock(import("@tauri-apps/plugin-dialog"), () => ({
  open: vi.fn(),
}));

vi.mock(import("@tauri-apps/api/event"), () => ({
  listen,
}));

const remoteOnlyGame = {
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

function renderDetails({
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
} = {}) {
  return render(
    <MuiTestProvider>
      <RomDownloadsProvider>
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
        />
      </RomDownloadsProvider>
    </MuiTestProvider>
  );
}

const switchRemoteGame = {
  ...remoteOnlyGame,
  file_path: "Switch Cloud Game.nsp",
  id: 17,
  name: "Switch Cloud Game",
  platform_id: "switch",
};

describe("GameDetails remote Play", () => {
  beforeEach(() => {
    invoke.mockResolvedValue({ display: {} });
  });

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

  it("dispatches Switch content sync once and reports its completion summary", async () => {
    let finish;
    invoke.mockImplementation(async (command) => {
      if (command === "sync_switch_content") {
        return new Promise((resolve) => {
          finish = resolve;
        });
      }
      return Promise.resolve({ display: {} });
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

    finish({
      downloaded: 1,
      message: "Synced Switch content: 1 downloaded, 2 reused.",
      reused: 2,
      success: true,
    });
    await expect(
      screen.findByText("Synced Switch content: 1 downloaded, 2 reused.")
    ).resolves.toBeInTheDocument();
  });

  it("renders Switch content progress and actionable retry guidance", async () => {
    window.__TAURI_INTERNALS__ = {};
    listen.mockImplementation(async (event, handler) => {
      eventListeners.set(event, handler);
      return () => eventListeners.delete(event);
    });
    let finish;
    invoke.mockImplementation(async (command) => {
      if (command === "sync_switch_content") {
        return new Promise((resolve) => {
          finish = resolve;
        });
      }
      return Promise.resolve({ display: {} });
    });
    renderDetails({ game: switchRemoteGame });

    await waitFor(() => {
      expect(eventListeners.has("switch-content-sync-progress")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Sync Updates & DLC" }));
    await act(async () => {
      eventListeners.get("switch-content-sync-progress")({
        payload: {
          downloaded: 512,
          file_index: 1,
          game_id: switchRemoteGame.id,
          percent: 50,
          stage: "downloading",
          total: 1024,
          total_files: 2,
        },
      });
    });
    expect(
      screen.getByTestId("switch-content-sync-progress")
    ).toHaveTextContent("Downloading Switch content… (1/2)");
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "50"
    );

    finish({
      message: "Synced Switch content: 1 downloaded, 1 reused.",
      success: true,
    });
    await waitFor(() => {
      expect(screen.getByText(/1 downloaded, 1 reused/)).toBeInTheDocument();
    });

    invoke.mockImplementation(async (command) => {
      if (command === "sync_switch_content") {
        return Promise.reject(new Error("Eden is running"));
      }
      return Promise.resolve({ display: {} });
    });
    fireEvent.click(screen.getByRole("button", { name: "Sync Updates & DLC" }));
    await expect(
      screen.findByText(/Eden is running.*Choose “Sync Updates & DLC” to retry/)
    ).resolves.toBeInTheDocument();
  });

  it("downloads a ROM manually and updates the game", async () => {
    const onGameUpdate = vi.fn();
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
    const onGameUpdate = vi.fn();
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

  it("keeps the overflow menu focused on working actions", async () => {
    renderDetails({
      game: {
        ...remoteOnlyGame,
        local_file_path: "/roms/cloud-game.gba",
        sync_state: "synced",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "More options" }));

    expect(
      screen.queryByRole("menuitem", { name: /Manage cached saves/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /Ratings & status/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /Change emulator/ })
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

  it("deduplicates Play activation until the preparation finishes", async () => {
    let finish = (_result) => {};
    const onLaunch = vi.fn(
      async () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    renderDetails({ onLaunch });

    const play = screen.getByRole("button", { name: "Play" });
    fireEvent.click(play);
    fireEvent.click(play);

    expect(onLaunch).toHaveBeenCalledOnce();
    expect(play).toBeDisabled();

    finish({ success: true });
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
      expect(screen.getByText(/download failed/)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Play" })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(onLaunch).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("button", { name: "Play" })).not.toBeDisabled();
    });
  });

  it("translates missing emulator errors into plain guidance without offering Retry", async () => {
    const onOpenSettings = vi.fn();
    const onLaunch = vi.fn().mockResolvedValue({
      error: "No compatible RetroArch core is installed for ps2",
      success: false,
    });
    renderDetails({
      game: { ...remoteOnlyGame, platform_id: "ps2" },
      onLaunch,
      onOpenSettings,
      platforms: [[{ id: "ps2", name: "PlayStation 2" }]],
    });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => {
      expect(
        screen.getByText(/no compatible emulator is installed/i)
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("alert")).toHaveTextContent("PlayStation 2");
    expect(
      screen.queryByRole("button", { name: "Retry" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open Settings" })
    ).toBeInTheDocument();
    expect(screen.queryByText(/certified|promised/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it("routes the disabled achievements link to Integrations settings", async () => {
    const onOpenIntegrations = vi.fn();
    renderDetails({ onOpenIntegrations });

    const integrationsLink = await screen.findByRole("link", {
      name: "Enable it in Settings → Integrations.",
    });
    fireEvent.click(integrationsLink);

    expect(onOpenIntegrations).toHaveBeenCalledOnce();
  });

  it("renders staged launch preparation progress from the public event", async () => {
    window.__TAURI_INTERNALS__ = {};
    listen.mockImplementation(async (event, handler) => {
      eventListeners.set(event, handler);
      return () => eventListeners.delete(event);
    });
    renderDetails();

    await waitFor(() => {
      expect(eventListeners.has("game-launch-progress")).toBeTruthy();
    });

    await act(async () => {
      eventListeners.get("game-launch-progress")({
        payload: {
          game_id: remoteOnlyGame.id,
          stage: "bios_preparation",
        },
      });
    });

    expect(screen.getByText("Preparing BIOS...")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).not.toHaveAttribute(
      "aria-valuenow"
    );

    await act(async () => {
      eventListeners.get("game-launch-progress")({
        payload: {
          downloaded: 512 * 1024,
          game_id: remoteOnlyGame.id,
          percent: 50,
          stage: "downloading",
          total: 1024 * 1024,
        },
      });
    });

    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "50"
    );
    expect(screen.getByText(/50%.*512\.0 KB.*1\.00 MB/)).toBeInTheDocument();

    await act(async () => {
      eventListeners.get("game-launch-progress")({
        payload: {
          downloaded: 512 * 1024,
          game_id: remoteOnlyGame.id,
          percent: null,
          stage: "downloading",
          total: null,
        },
      });
    });

    expect(screen.getByRole("progressbar")).not.toHaveAttribute(
      "aria-valuenow"
    );
    expect(screen.getByText("512.0 KB")).toBeInTheDocument();
  });

  it("offers a guarded save-sync retry with the same slot and save id, but not for a permanent failure", async () => {
    const saveCalls = [];
    let permanentFailure = false;
    let finishRetry;
    invoke.mockImplementation(async (command, args) => {
      if (command === "get_game_saves") {
        return Promise.resolve([
          { file_name: "Cloud Save", id: 9001, slot: "autosave" },
        ]);
      }
      if (command === "download_switch_save") {
        saveCalls.push([command, args]);
        if (permanentFailure) {
          return Promise.reject(new Error("Save not found on server"));
        }
        if (saveCalls.length === 1) {
          return Promise.reject(
            "Device-aware save download returned an error: HTTP status server error (503 Service Unavailable) for url (https://romm.example/api/saves/9001/content)"
          );
        }
        return new Promise((resolve) => {
          finishRetry = resolve;
        });
      }
      return Promise.resolve({ display: {} });
    });
    renderDetails({ game: switchRemoteGame });

    fireEvent.click(screen.getByRole("button", { name: "List Saves" }));
    await screen.findByText("Cloud Save");
    fireEvent.click(screen.getByTitle("Download save"));

    await expect(
      screen.findByText(/503 Service Unavailable/)
    ).resolves.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(saveCalls).toStrictEqual([
      [
        "download_switch_save",
        { gameId: switchRemoteGame.id, saveId: 9001, slot: "autosave" },
      ],
    ]);

    fireEvent.change(
      screen.getByRole("textbox", { name: "RomM slot (channel)" }),
      {
        target: { value: "changed-after-failure" },
      }
    );
    const retry = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retry);
    await waitFor(() => {
      expect(saveCalls).toHaveLength(2);
    });
    expect(saveCalls[1]).toStrictEqual(saveCalls[0]);
    expect(retry).toBeDisabled();
    fireEvent.click(retry);
    expect(saveCalls).toHaveLength(2);

    finishRetry({ message: "Retry restored save" });
    await expect(
      screen.findByText("Retry restored save")
    ).resolves.toBeInTheDocument();

    permanentFailure = true;
    fireEvent.click(screen.getByTitle("Download save"));

    await expect(
      screen.findByText("Save not found on server")
    ).resolves.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retry" })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(
      screen.queryByText("Save not found on server")
    ).not.toBeInTheDocument();
  });
});
