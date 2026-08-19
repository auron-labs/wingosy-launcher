import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import ImmersiveModeApp from "./ImmersiveModeApp";
import { MuiTestProvider } from "../test/muiHarness";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

function dispatchControllerKey(key, { repeat = false } = {}) {
  const code = { h: "KeyH", H: "KeyH" }[key] || "";
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

// These mocks provide deterministic UI/command sequencing evidence, not proof of a real emulator launch.
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

vi.mock("./useFullscreen", () => ({
  useFullscreen: () => ({
    setFullscreen: vi.fn().mockResolvedValue(undefined),
    toggleFullscreen: vi.fn(),
  }),
}));

vi.mock("./useGamepadKeyboardMapper", () => ({
  useGamepadKeyboardMapper: () => {},
}));

vi.mock("./AmbientAudioPlayer", () => ({ default: () => null }));
vi.mock("./ImmersiveHintBar", () => ({
  default: ({ visible }) => <span data-testid="immersive-hints">{String(visible)}</span>,
}));
vi.mock("../components/Settings", () => ({ default: () => null }));
vi.mock("../components/RomDownloadsView", () => ({ default: () => null }));

vi.mock("./ImmersiveLibrary", () => ({
  default: ({ games, selectedIndex, onSelectedIndexChange, onSelectGame }) => (
    <div data-testid="immersive-library">
      <span data-testid="selected-index">{selectedIndex}</span>
      {games.map((game, index) => (
        <button
          key={game.id}
          data-testid={`game-${game.id}`}
          onClick={() => {
            onSelectedIndexChange(index);
            onSelectGame(game);
          }}
        >
          {game.name}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("./ImmersiveGameDetails", () => {
  function MockImmersiveGameDetails({ game, onBack, onLaunch }) {
    const [menuOpen, setMenuOpen] = useState(false);
    return (
      <div data-testid="immersive-details">
        <span data-testid="details-game">{game.name}</span>
        <button onClick={() => onLaunch(game.id)}>Play</button>
        <button onClick={onBack}>Back</button>
        <button onClick={() => setMenuOpen((open) => !open)}>Open menu</button>
        {menuOpen ? <div role="menu">Menu owns input</div> : null}
      </div>
    );
  }

  return { default: MockImmersiveGameDetails };
});

afterEach(() => {
  cleanup();
  invoke.mockReset();
});

const initialGames = [
  { id: 1, name: "First Game", platform_id: "gba" },
  { id: 2, name: "Second Game", platform_id: "gba" },
];

describe("ImmersiveModeApp launch context", () => {
  it("keeps the selected game, details view, and library index after refresh", async () => {
    let games = initialGames;
    let finishLaunch;
    invoke.mockImplementation((command) => {
      if (command === "get_all_games") return Promise.resolve(games);
      if (command === "get_platforms_with_games") return Promise.resolve([]);
      if (command === "get_config") return Promise.resolve({ display: { big_picture: true } });
      if (command === "prepare_and_launch_game") {
        return new Promise((resolve) => {
          finishLaunch = resolve;
        });
      }
      return Promise.resolve(null);
    });

    render(
      <MuiTestProvider>
        <ImmersiveModeApp
          onExit={vi.fn()}
          rommToken={null}
          rommUrl={null}
          onRommConnect={vi.fn()}
        />
      </MuiTestProvider>
    );
    await waitFor(() => expect(screen.getByTestId("game-2")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("game-2"));
    expect(screen.getByTestId("details-game")).toHaveTextContent("Second Game");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    games = [{ ...initialGames[0] }, { ...initialGames[1], name: "Second Game Refreshed" }];
    await act(async () => finishLaunch({ success: true }));

    await waitFor(() => expect(screen.getByTestId("details-game")).toHaveTextContent("Second Game Refreshed"));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByTestId("selected-index")).toHaveTextContent("1");
  });

  it("defers window hotkeys to open menus and suppresses repeated or cross-game launches", async () => {
    let finishLaunch;
    invoke.mockImplementation((command) => {
      if (command === "get_all_games") return Promise.resolve(initialGames);
      if (command === "get_platforms_with_games") return Promise.resolve([]);
      if (command === "get_config") return Promise.resolve({ display: { big_picture: true } });
      if (command === "prepare_and_launch_game") {
        return new Promise((resolve) => {
          finishLaunch = resolve;
        });
      }
      return Promise.resolve(null);
    });

    render(
      <MuiTestProvider>
        <ImmersiveModeApp
          onExit={vi.fn()}
          rommToken={null}
          rommUrl={null}
          onRommConnect={vi.fn()}
        />
      </MuiTestProvider>
    );
    await waitFor(() => expect(screen.getByTestId("game-1")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("game-1"));

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    dispatchControllerKey("h");
    expect(screen.getByTestId("immersive-hints")).toHaveTextContent("true");
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    dispatchControllerKey("h");
    expect(screen.getByTestId("immersive-hints")).toHaveTextContent("false");

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(invoke).toHaveBeenCalledWith("prepare_and_launch_game", { gameId: 1 });
    expect(invoke.mock.calls.filter(([command]) => command === "prepare_and_launch_game")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByTestId("game-2"));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(invoke.mock.calls.filter(([command]) => command === "prepare_and_launch_game")).toHaveLength(1);

    await act(async () => finishLaunch({ success: true }));
  });
});
