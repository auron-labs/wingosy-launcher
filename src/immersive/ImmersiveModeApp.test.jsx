import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import ImmersiveModeApp from "./ImmersiveModeApp";
import { MuiTestProvider } from "../test/muiHarness";
import { attachControllerAction } from "./controllerDebug";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

function dispatchControllerKey(key, { repeat = false, action = null } = {}) {
  const code = { h: "KeyH", H: "KeyH" }[key] || "";
  const event = new KeyboardEvent("keydown", {
    key,
    code,
    repeat,
    bubbles: true,
    cancelable: true,
  });
  attachControllerAction(event, action);
  act(() => window.dispatchEvent(event));
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
  useGamepadKeyboardMapper: () => ({ unsupportedGamepad: false }),
}));

vi.mock("./AmbientAudioPlayer", () => ({ default: () => null }));
vi.mock("./ImmersiveHintBar", () => ({
  default: ({ visible }) => <span data-testid="immersive-hints">{String(visible)}</span>,
}));
vi.mock("../components/Settings", () => ({ default: () => null }));
vi.mock("../components/RomDownloadsView", () => ({ default: () => null }));

vi.mock("./ImmersiveLibrary", () => ({
  default: ({ games, selectedIndex, onSelectedIndexChange, onSelectGame }) => (
    <div
      data-testid="immersive-library"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key !== "ArrowRight") return;
        event.preventDefault();
        onSelectedIndexChange(Math.min(games.length - 1, selectedIndex + 1));
      }}
    >
      <span data-testid="selected-index">{selectedIndex}</span>
      {games.map((game, index) => (
        <button
          key={game.id}
          data-testid={`game-${game.id}`}
          data-focused={String(index === selectedIndex)}
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
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
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
      if (command === "get_games_page") return Promise.resolve({ games, total: games.length });
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
      if (command === "get_games_page") {
        return Promise.resolve({ games: initialGames, total: initialGames.length });
      }
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

  it("logs shell suppression for a correlated controller action while a menu is open", async () => {
    vi.stubEnv("VITE_WINGOSY_DEBUG", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    invoke.mockImplementation((command) => {
      if (command === "get_games_page") {
        return Promise.resolve({ games: initialGames, total: initialGames.length });
      }
      if (command === "get_platforms_with_games") return Promise.resolve([]);
      if (command === "get_config") return Promise.resolve({ display: { big_picture: true } });
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
      </MuiTestProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("game-1")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("game-1"));
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    dispatchControllerKey("h", {
      action: {
        actionId: 44,
        key: "h",
        controllerIndex: 2,
        phase: "edge",
        elapsedSincePreviousMs: null,
        deferred: false,
      },
    });

    expect(info).toHaveBeenCalledWith(
      "[Wingosy][debug][controller] receiver suppressed",
      expect.objectContaining({
        actionId: 44,
        receiver: "shell",
        key: "h",
        outcome: "suppressed",
        reason: "menu open",
      }),
    );
  });

  it("loads bounded pages as controller selection reaches the end without duplicates or overfetching", async () => {
    const firstPage = Array.from({ length: 60 }, (_, index) => ({
      id: index + 1,
      name: `Game ${index + 1}`,
      platform_id: "gba",
    }));
    const secondPage = [{ id: 61, name: "Game 61", platform_id: "gba" }];
    let finishNextPage;
    let finishLaunch;

    invoke.mockImplementation((command, args) => {
      if (command === "get_games_page") {
        if (args.page === 1) return Promise.resolve({ games: firstPage, total: 61 });
        if (args.page === 2) {
          return new Promise((resolve) => {
            finishNextPage = resolve;
          });
        }
        return Promise.reject(new Error(`unexpected page ${args.page}`));
      }
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

    await waitFor(() => expect(screen.getByTestId("game-60")).toBeInTheDocument());
    const library = screen.getByTestId("immersive-library");
    for (let index = 0; index < 59; index += 1) {
      fireEvent.keyDown(library, { key: "ArrowRight" });
    }

    await waitFor(() => expect(finishNextPage).toEqual(expect.any(Function)));
    expect(
      invoke.mock.calls.filter(([command]) => command === "get_games_page"),
    ).toHaveLength(2);
    expect(
      invoke.mock.calls.filter(
        ([command, args]) => command === "get_games_page" && args.page === 2,
      ),
    ).toHaveLength(1);
    expect(invoke).toHaveBeenCalledWith("get_games_page", {
      platformId: null,
      searchQuery: null,
      page: 1,
      pageSize: 60,
    });
    expect(invoke).toHaveBeenCalledWith("get_games_page", {
      platformId: null,
      searchQuery: null,
      page: 2,
      pageSize: 60,
    });

    await act(async () => finishNextPage({ games: secondPage, total: 61 }));

    await waitFor(() => expect(screen.getByTestId("game-61")).toBeInTheDocument());
    fireEvent.keyDown(library, { key: "ArrowRight" });
    expect(screen.getByTestId("selected-index")).toHaveTextContent("60");
    expect(screen.getByTestId("game-61")).toHaveAttribute("data-focused", "true");
    expect(invoke.mock.calls.some(([, args]) => args?.page === 3)).toBe(false);

    fireEvent.click(screen.getByTestId("game-61"));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await act(async () => {
      finishLaunch({ success: true });
    });
    await waitFor(() =>
      expect(screen.getByTestId("details-game")).toHaveTextContent("Game 61"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByTestId("selected-index")).toHaveTextContent("60");
    expect(screen.getByTestId("game-61")).toHaveAttribute("data-focused", "true");
    expect(invoke.mock.calls.some(([, args]) => args?.page === 3)).toBe(false);
  });

  it("does not re-request retained later-page games after refresh", async () => {
    const firstPage = Array.from({ length: 60 }, (_, index) => ({
      id: index + 1,
      name: `Game ${index + 1}`,
      platform_id: "gba",
    }));
    const secondPage = Array.from({ length: 12 }, (_, index) => ({
      id: index + 61,
      name: `Game ${index + 61}`,
      platform_id: "gba",
    }));
    let pageOneCalls = 0;
    let pageTwoCalls = 0;
    let pageThreeCalls = 0;
    let finishLaunch;

    invoke.mockImplementation((command, args) => {
      if (command === "get_games_page") {
        if (args.page === 1) {
          pageOneCalls += 1;
          return Promise.resolve({ games: firstPage, total: 73 });
        }
        if (args.page === 2) {
          pageTwoCalls += 1;
          return Promise.resolve({ games: secondPage, total: 73 });
        }
        if (args.page === 3) {
          pageThreeCalls += 1;
          return Promise.resolve({
            games: [{ id: 73, name: "Game 73", platform_id: "gba" }],
            total: 73,
          });
        }
        return Promise.reject(new Error(`unexpected page ${args.page}`));
      }
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
      </MuiTestProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("game-60")).toBeInTheDocument());
    const library = screen.getByTestId("immersive-library");
    for (let index = 0; index < 59; index += 1) {
      fireEvent.keyDown(library, { key: "ArrowRight" });
    }
    await waitFor(() => expect(screen.getByTestId("game-72")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("game-61"));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(finishLaunch).toEqual(expect.any(Function)));
    await act(async () => finishLaunch({ success: true }));
    await waitFor(() => expect(pageOneCalls).toBe(2));

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(pageThreeCalls).toBe(1));
    expect(pageTwoCalls).toBe(1);
  });

  it("does not let a stale page request clear a replacement request guard", async () => {
    const firstPage = Array.from({ length: 60 }, (_, index) => ({
      id: index + 1,
      name: `Game ${index + 1}`,
      platform_id: "gba",
    }));
    const stalePage = [{ id: 999, name: "Stale Game", platform_id: "gba" }];
    const secondPage = [{ id: 61, name: "Game 61", platform_id: "gba" }];
    let pageOneCalls = 0;
    let pageTwoCalls = 0;
    let finishStalePage;
    let finishRefresh;
    let finishReplacementPage;

    invoke.mockImplementation((command, args) => {
      if (command === "get_games_page") {
        if (args.page === 1) {
          pageOneCalls += 1;
          if (pageOneCalls === 1) return Promise.resolve({ games: firstPage, total: 61 });
          return new Promise((resolve) => {
            finishRefresh = resolve;
          });
        }
        if (args.page === 2) {
          pageTwoCalls += 1;
          if (pageTwoCalls === 1) {
            return new Promise((resolve) => {
              finishStalePage = resolve;
            });
          }
          return new Promise((resolve) => {
            finishReplacementPage = resolve;
          });
        }
        return Promise.reject(new Error(`unexpected page ${args.page}`));
      }
      if (command === "get_platforms_with_games") return Promise.resolve([]);
      if (command === "get_config") return Promise.resolve({ display: { big_picture: true } });
      if (command === "prepare_and_launch_game") return Promise.resolve({ success: true });
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
      </MuiTestProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("game-60")).toBeInTheDocument());
    const library = screen.getByTestId("immersive-library");
    for (let index = 0; index < 59; index += 1) {
      fireEvent.keyDown(library, { key: "ArrowRight" });
    }
    await waitFor(() => expect(finishStalePage).toEqual(expect.any(Function)));

    fireEvent.click(screen.getByTestId("game-60"));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(finishRefresh).toEqual(expect.any(Function)));
    await act(async () => finishRefresh({ games: firstPage, total: 61 }));
    await waitFor(() => expect(finishReplacementPage).toEqual(expect.any(Function)));
    expect(pageTwoCalls).toBe(2);

    await act(async () => finishStalePage({ games: stalePage, total: 61 }));
    fireEvent.keyDown(screen.getByTestId("immersive-library"), { key: "ArrowLeft" });
    expect(pageTwoCalls).toBe(2);

    await act(async () => finishReplacementPage({ games: secondPage, total: 61 }));
    await waitFor(() => expect(screen.getByTestId("game-61")).toBeInTheDocument());
    expect(screen.getAllByTestId("game-61")).toHaveLength(1);
    expect(screen.queryByTestId("game-999")).not.toBeInTheDocument();
    expect(invoke.mock.calls.some(([, request]) => request?.page === 3)).toBe(false);
  });
});
