import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import GameDetails from "./GameDetails";
import { RomDownloadsProvider } from "../RomDownloadsContext";
import { MuiTestProvider } from "../test/muiHarness";

const { invoke, listen } = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn() }));
const eventListeners = new Map();

afterEach(() => {
  cleanup();
  eventListeners.clear();
  delete window.__TAURI_INTERNALS__;
  invoke.mockReset();
  listen.mockReset();
});

vi.mock("@tauri-apps/api/core", () => ({
  // These mocks are deterministic UI/command-dispatch evidence, not proof that a real emulator process launches.
  invoke,
  convertFileSrc: (path) => path,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen,
}));

const remoteOnlyGame = {
  id: 7,
  name: "Cloud Game",
  platform_id: "gba",
  source: "RomM",
  romm_id: 42,
  file_path: "https://romm.example/api/roms/42/content/cloud.gba",
  local_file_path: null,
  sync_state: "remote_only",
  cover_path: null,
  screenshot_paths: [],
  genres: [],
  play_time_minutes: 0,
  play_count: 0,
  is_favorite: false,
  is_hidden: false,
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
  id: 17,
  name: "Switch Cloud Game",
  platform_id: "switch",
  file_path: "Switch Cloud Game.nsp",
};

describe("GameDetails remote Play", () => {
  beforeEach(() => {
    invoke.mockResolvedValue({ display: {} });
  });

  it("offers Play while retaining manual Download ROM", () => {
    renderDetails();

    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download ROM" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sync Updates & DLC" })).not.toBeInTheDocument();
  });

  it("shows Switch content sync only for an authenticated RomM Switch game", () => {
    renderDetails({ game: switchRemoteGame });

    expect(screen.getByRole("button", { name: "Sync Updates & DLC" })).toBeInTheDocument();
  });

  it("dispatches Switch content sync once and reports its completion summary", async () => {
    let finish;
    invoke.mockImplementation((command) => {
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

    expect(invoke).toHaveBeenCalledWith("sync_switch_content", { gameId: switchRemoteGame.id });
    expect(invoke.mock.calls.filter(([command]) => command === "sync_switch_content")).toHaveLength(1);
    expect(sync).toBeDisabled();

    finish({
      success: true,
      message: "Synced Switch content: 1 downloaded, 2 reused.",
      downloaded: 1,
      reused: 2,
    });
    expect(await screen.findByText("Synced Switch content: 1 downloaded, 2 reused.")).toBeInTheDocument();
  });

  it("renders Switch content progress and actionable retry guidance", async () => {
    window.__TAURI_INTERNALS__ = {};
    listen.mockImplementation(async (event, handler) => {
      eventListeners.set(event, handler);
      return () => eventListeners.delete(event);
    });
    let finish;
    invoke.mockImplementation((command) => {
      if (command === "sync_switch_content") {
        return new Promise((resolve) => {
          finish = resolve;
        });
      }
      return Promise.resolve({ display: {} });
    });
    renderDetails({ game: switchRemoteGame });

    await waitFor(() => expect(eventListeners.has("switch-content-sync-progress")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Sync Updates & DLC" }));
    await act(async () => {
      eventListeners.get("switch-content-sync-progress")({
        payload: {
          game_id: switchRemoteGame.id,
          stage: "downloading",
          file_index: 1,
          total_files: 2,
          downloaded: 512,
          total: 1024,
          percent: 50,
        },
      });
    });
    expect(screen.getByTestId("switch-content-sync-progress")).toHaveTextContent("Downloading Switch content… (1/2)");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");

    finish({ success: true, message: "Synced Switch content: 1 downloaded, 1 reused." });
    await waitFor(() => expect(screen.getByText(/1 downloaded, 1 reused/)).toBeInTheDocument());

    invoke.mockImplementation((command) => {
      if (command === "sync_switch_content") return Promise.reject(new Error("Eden is running"));
      return Promise.resolve({ display: {} });
    });
    fireEvent.click(screen.getByRole("button", { name: "Sync Updates & DLC" }));
    expect(await screen.findByText(/Eden is running.*Choose “Sync Updates & DLC” to retry/)).toBeInTheDocument();
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
    expect(await screen.findByText("Downloaded! Ready to play.")).toBeInTheDocument();
    expect(onGameUpdate).toHaveBeenCalledWith(remoteOnlyGame.id);
    expect(screen.getByRole("button", { name: "Re-download" })).toBeInTheDocument();
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
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete Download" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("delete_local_rom", { gameId: cachedGame.id });
    });
    expect(await screen.findByText("ROM deleted successfully")).toBeInTheDocument();
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

    expect(screen.queryByRole("menuitem", { name: /Manage cached saves/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Ratings & status/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Change emulator/ })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete Download" })).toBeInTheDocument();
  });

  it("uses the unified status chips and exposes the favorite affordance", () => {
    renderDetails();

    const statusChips = screen.getByTestId("game-status-chips").querySelectorAll(".MuiChip-root");
    expect(statusChips).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Add Cloud Game to favorites" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More options" })).toBeInTheDocument();
  });

  it("deduplicates Play activation until the preparation finishes", async () => {
    let finish = (_result) => {};
    const onLaunch = vi.fn(
      () => new Promise((resolve) => {
        finish = resolve;
      })
    );
    renderDetails({ onLaunch });

    const play = screen.getByRole("button", { name: "Play" });
    fireEvent.click(play);
    fireEvent.click(play);

    expect(onLaunch).toHaveBeenCalledTimes(1);
    expect(play).toBeDisabled();

    finish({ success: true });
    await waitFor(() => expect(play).not.toBeDisabled());
  });

  it("keeps Play retryable after a failed preparation", async () => {
    const onLaunch = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: "download failed" })
      .mockResolvedValueOnce({ success: true });
    renderDetails({ onLaunch });

    const play = screen.getByRole("button", { name: "Play" });
    fireEvent.click(play);
    await waitFor(() => expect(screen.getByText(/download failed/)).toBeInTheDocument());

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
      success: false,
      error: "No compatible RetroArch core is installed for ps2",
    });
    renderDetails({
      onLaunch,
      onOpenSettings,
      game: { ...remoteOnlyGame, platform_id: "ps2" },
      platforms: [[{ id: "ps2", name: "PlayStation 2" }]],
    });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => expect(screen.getByText(/no compatible emulator is installed/i)).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("PlayStation 2");
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Settings" })).toBeInTheDocument();
    expect(screen.queryByText(/certified|promised/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("routes the disabled achievements link to Integrations settings", async () => {
    const onOpenIntegrations = vi.fn();
    renderDetails({ onOpenIntegrations });

    const integrationsLink = await screen.findByRole("link", {
      name: "Enable it in Settings → Integrations.",
    });
    fireEvent.click(integrationsLink);

    expect(onOpenIntegrations).toHaveBeenCalledTimes(1);
  });

  it("renders staged launch preparation progress from the public event", async () => {
    window.__TAURI_INTERNALS__ = {};
    listen.mockImplementation(async (event, handler) => {
      eventListeners.set(event, handler);
      return () => eventListeners.delete(event);
    });
    renderDetails();

    await waitFor(() => expect(eventListeners.has("game-launch-progress")).toBe(true));

    await act(async () => {
      eventListeners.get("game-launch-progress")({
        payload: {
          game_id: remoteOnlyGame.id,
          stage: "bios_preparation",
        },
      });
    });

    expect(screen.getByText("Preparing BIOS...")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");

    await act(async () => {
      eventListeners.get("game-launch-progress")({
        payload: {
          game_id: remoteOnlyGame.id,
          stage: "downloading",
          downloaded: 512 * 1024,
          total: 1024 * 1024,
          percent: 50,
        },
      });
    });

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText(/50%.*512\.0 KB.*1\.00 MB/)).toBeInTheDocument();

    await act(async () => {
      eventListeners.get("game-launch-progress")({
        payload: {
          game_id: remoteOnlyGame.id,
          stage: "downloading",
          downloaded: 512 * 1024,
          total: null,
          percent: null,
        },
      });
    });

    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
    expect(screen.getByText("512.0 KB")).toBeInTheDocument();
  });
});
