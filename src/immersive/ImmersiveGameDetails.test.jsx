import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ImmersiveGameDetails from "./ImmersiveGameDetails";
import { RomDownloadsProvider } from "../RomDownloadsContext";
import { MuiTestProvider } from "../test/muiHarness";

const { listen } = vi.hoisted(() => ({ listen: vi.fn() }));

// These mocks provide deterministic UI/command sequencing evidence, not proof of a real emulator launch.
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  convertFileSrc: (path) => path,
}));

vi.mock("@tauri-apps/api/event", () => ({ listen }));

vi.mock("../ThemeContext", () => ({
  useAppTheme: () => ({
    colors: {
      primary: "#5C6BC0",
      primaryLight: "#8E99F3",
    },
  }),
}));

vi.mock("../components/game/GameScreenshotsSection", () => ({
  default: () => null,
}));

vi.mock("../components/game/GameAchievementsSection", () => ({
  default: () => null,
}));

vi.mock("../components/game/CollectionPickerDialog", () => ({
  default: () => null,
}));

const eventListeners = new Map();

function dispatchControllerKey(key, { repeat = false } = {}) {
  const code = { Enter: "Enter", Escape: "Escape" }[key] || "";
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key,
      code,
      repeat,
      bubbles: true,
      cancelable: true,
    }));
  });
}

afterEach(() => {
  cleanup();
  eventListeners.clear();
  listen.mockReset();
  delete window.__TAURI_INTERNALS__;
});

const remoteOnlyGame = {
  id: 7,
  name: "Cloud Game",
  platform_id: "gba",
  source: "RomM",
  romm_id: 42,
  local_file_path: null,
  sync_state: "remote_only",
  screenshot_paths: [],
  summary: "A game in the cloud.",
  is_favorite: false,
};

function renderDetails(onLaunch = vi.fn().mockResolvedValue({ success: true }), game = remoteOnlyGame) {
  return render(
    <MuiTestProvider>
      <RomDownloadsProvider>
        <ImmersiveGameDetails
          game={game}
          platformLabel="Game Boy Advance"
          onBack={vi.fn()}
          onLaunch={onLaunch}
          onToggleFavorite={vi.fn()}
          onGameUpdate={vi.fn()}
          rommToken="saved-token"
          rommUrl="https://romm.example"
        />
      </RomDownloadsProvider>
    </MuiTestProvider>
  );
}

describe("ImmersiveGameDetails launch controls", () => {
  it.each([
    ["a local-only game", { ...remoteOnlyGame, id: 8, name: "Local Game", source: "Local", romm_id: null, local_file_path: "/roms/local.gba", sync_state: "local_only" }],
    ["a cached RomM game", { ...remoteOnlyGame, id: 9, name: "Cached Game", local_file_path: "/roms/cached.gba", sync_state: "synced" }],
  ])("routes Play for %s through onLaunch", async (_label, game) => {
    const onLaunch = vi.fn().mockResolvedValue({ success: true });
    renderDetails(onLaunch, game);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => expect(onLaunch).toHaveBeenCalledWith(game.id));
  });

  it("offers Play and explicit Download for a remote-only RomM game", async () => {
    const onLaunch = vi.fn().mockResolvedValue({ success: true });
    renderDetails(onLaunch);

    const play = screen.getByRole("button", { name: "Play" });
    expect(play).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();

    fireEvent.click(play);
    expect(onLaunch).toHaveBeenCalledWith(remoteOnlyGame.id);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(play).not.toBeDisabled();
  });

  it("starts the same launch flow when controller A dispatches Enter to window", async () => {
    const onLaunch = vi.fn().mockResolvedValue({ success: true });
    renderDetails(onLaunch);

    dispatchControllerKey("Enter");

    expect(onLaunch).toHaveBeenCalledWith(remoteOnlyGame.id);
    await waitFor(() => expect(screen.getByRole("button", { name: "Play" })).not.toBeDisabled());
  });

  it("does not route native control key events through the controller handler", () => {
    const onLaunch = vi.fn().mockResolvedValue({ success: true });
    renderDetails(onLaunch);

    fireEvent.keyDown(screen.getByRole("button", { name: "Download" }), { key: "Enter" });

    expect(onLaunch).not.toHaveBeenCalled();
  });

  it("ignores repeated or buffered Enter input while preparation is active", async () => {
    let finish;
    const onLaunch = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    renderDetails(onLaunch);

    dispatchControllerKey("Enter");
    dispatchControllerKey("Enter");
    dispatchControllerKey("Enter", { repeat: true });

    expect(onLaunch).toHaveBeenCalledTimes(1);
    await act(async () => finish({ success: true }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Play" })).not.toBeDisabled());
  });

  it("shows determinate and indeterminate preparation progress while Play is awaiting exit", async () => {
    window.__TAURI_INTERNALS__ = {};
    listen.mockImplementation(async (event, handler) => {
      eventListeners.set(event, handler);
      return () => eventListeners.delete(event);
    });
    let finish;
    const onLaunch = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    renderDetails(onLaunch);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(eventListeners.has("game-launch-progress")).toBe(true));

    await act(async () => {
      eventListeners.get("game-launch-progress")({
        payload: {
          game_id: remoteOnlyGame.id,
          game_name: remoteOnlyGame.name,
          stage: "downloading",
          downloaded: 512 * 1024,
          total: 1024 * 1024,
          percent: 50,
        },
      });
    });

    expect(screen.getByRole("dialog")).toHaveTextContent("Cloud Game");
    expect(screen.getByText("Downloading ROM...")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText(/50%.*512\.0 KB.*1\.00 MB/)).toBeInTheDocument();

    await act(async () => {
      eventListeners.get("game-launch-progress")({
        payload: {
          game_id: remoteOnlyGame.id,
          game_name: remoteOnlyGame.name,
          stage: "running",
          downloaded: null,
          total: null,
          percent: null,
        },
      });
    });

    expect(screen.getByText("Emulator running")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");

    await act(async () => {
      eventListeners.get("game-launch-progress")({
        payload: {
          game_id: remoteOnlyGame.id,
          game_name: remoteOnlyGame.name,
          stage: "completion",
        },
      });
    });
    expect(screen.getByText("Launch complete")).toBeInTheDocument();

    await act(async () => finish({ success: true }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Play" })).toHaveFocus();
  });

  it("keeps failure recovery controller-safe with focused Retry and Back", async () => {
    const onBack = vi.fn();
    const onLaunch = vi.fn().mockRejectedValue(new Error("network unavailable"));
    render(
      <MuiTestProvider>
        <RomDownloadsProvider>
          <ImmersiveGameDetails
            game={remoteOnlyGame}
            platformLabel="Game Boy Advance"
            onBack={onBack}
            onLaunch={onLaunch}
            onToggleFavorite={vi.fn()}
            onGameUpdate={vi.fn()}
            rommToken="saved-token"
            rommUrl="https://romm.example"
          />
        </RomDownloadsProvider>
      </MuiTestProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(screen.getByText("network unavailable")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus());

    dispatchControllerKey("Enter", { repeat: true });
    expect(onLaunch).toHaveBeenCalledTimes(1);

    dispatchControllerKey("Enter");
    await waitFor(() => expect(onLaunch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText("network unavailable")).toBeInTheDocument());

    dispatchControllerKey("Escape", { repeat: true });
    expect(onBack).not.toHaveBeenCalled();
    dispatchControllerKey("Escape");
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
