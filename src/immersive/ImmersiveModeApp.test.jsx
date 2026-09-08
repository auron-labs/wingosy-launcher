import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import ImmersiveModeApp from "./ImmersiveModeApp";
import { MuiTestProvider } from "../test/muiHarness";
import { attachControllerAction } from "./controllerDebug";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

function dispatchControllerKey(key, { repeat = false, action = null } = {}) {
  dispatchControllerKeyTo(window, key, { repeat, action });
}

function dispatchControllerKeyTo(target, key, { repeat = false, action = null } = {}) {
  const code = { h: "KeyH", H: "KeyH" }[key] || "";
  const event = new KeyboardEvent("keydown", {
    key,
    code,
    repeat,
    bubbles: true,
    cancelable: true,
  });
  attachControllerAction(event, action);
  act(() => target.dispatchEvent(event));
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
  default: ({
    games,
    platforms = [],
    selectedPlatform,
    onSelectedPlatformChange,
    searchQuery,
    onSearchChange,
    selectedIndex,
    onSelectedIndexChange,
    onSelectGame,
    error,
  }) => (
    <div
      data-testid="immersive-library"
      tabIndex={0}
      onKeyDown={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest?.("input, textarea, select, [role='textbox']")
        ) {
          return;
        }
        if (event.key !== "ArrowRight") return;
        event.preventDefault();
        onSelectedIndexChange(Math.min(games.length - 1, selectedIndex + 1));
      }}
    >
      {error ? <span data-testid="immersive-launch-error">{error}</span> : null}
      <button onClick={() => onSelectedPlatformChange(null)}>All platforms</button>
      {platforms.map(([platform]) => (
        <button
          key={platform.id}
          aria-pressed={selectedPlatform === platform.id}
          onClick={() => onSelectedPlatformChange(platform.id)}
        >
          {platform.name}
        </button>
      ))}
      <input
        aria-label="Search games by name"
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      {searchQuery ? (
        <button onClick={() => onSearchChange("")}>Clear game search</button>
      ) : null}
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

const immersivePlatforms = [
  [{ id: "gba", name: "Game Boy Advance" }, 61],
  [{ id: "snes", name: "Super Nintendo" }, 2],
];

describe("ImmersiveModeApp launch context", () => {
  it("passes only one tile for duplicate game records", async () => {
    const games = [
      { id: 1, name: "Bonk's Adventure", platform_id: "nes" },
      { id: 2, name: "  BONK'S   ADVENTURE ", platform_id: "NES" },
      { id: 3, name: "Another Game", platform_id: "nes" },
    ];
    invoke.mockImplementation((command) => {
      if (command === "get_games_page") return Promise.resolve({ games, total: games.length });
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
    expect(screen.queryByTestId("game-2")).not.toBeInTheDocument();
    expect(screen.getByTestId("game-3")).toBeInTheDocument();
  });

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

  it("presents successful automatic save-sync messages without treating them as errors", async () => {
    invoke.mockImplementation((command) => {
      if (command === "get_games_page") {
        return Promise.resolve({ games: initialGames, total: initialGames.length });
      }
      if (command === "get_platforms_with_games") return Promise.resolve([]);
      if (command === "get_config") return Promise.resolve({ display: { big_picture: true } });
      if (command === "prepare_and_launch_game") {
        return Promise.resolve({
          success: true,
          save_sync_messages: ["Uploaded newer local save"],
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

    await waitFor(() => expect(screen.getByTestId("game-1")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("game-1"));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => expect(screen.getByText("Uploaded newer local save")).toBeInTheDocument());
    expect(screen.queryByTestId("immersive-launch-error")).not.toBeInTheDocument();
  });

  it("returns from details to the immersive library on controller Back", async () => {
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
    expect(screen.getByTestId("details-game")).toHaveTextContent("First Game");

    dispatchControllerKey("Escape", {
      action: {
        actionId: 1,
        key: "Escape",
        controllerIndex: 0,
        phase: "edge",
        elapsedSincePreviousMs: null,
        deferred: false,
      },
    });

    expect(screen.getByTestId("immersive-library")).toBeInTheDocument();
    expect(screen.getByTestId("selected-index")).toHaveTextContent("0");
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

  it("queries the selected platform for every page and clears back to all platforms", async () => {
    const allGames = Array.from({ length: 60 }, (_, index) => ({
      id: index + 1,
      name: `All Game ${index + 1}`,
      platform_id: index % 2 === 0 ? "gba" : "snes",
    }));
    const gbaFirstPage = Array.from({ length: 60 }, (_, index) => ({
      id: index + 101,
      name: `GBA Game ${index + 1}`,
      platform_id: "gba",
    }));
    const gbaSecondPage = [{ id: 161, name: "GBA Game 61", platform_id: "gba" }];
    let finishGbaSecondPage;

    invoke.mockImplementation((command, args) => {
      if (command === "get_games_page") {
        if (args.platformId === "gba" && args.page === 1) {
          return Promise.resolve({ games: gbaFirstPage, total: 61 });
        }
        if (args.platformId === "gba" && args.page === 2) {
          return new Promise((resolve) => {
            finishGbaSecondPage = resolve;
          });
        }
        if (args.platformId === null && args.page === 1) {
          return Promise.resolve({ games: allGames, total: 60 });
        }
        return Promise.reject(new Error(`unexpected request ${JSON.stringify(args)}`));
      }
      if (command === "get_platforms_with_games") return Promise.resolve(immersivePlatforms);
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

    await waitFor(() => expect(screen.getByText("All Game 1")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Game Boy Advance" }));
    await waitFor(() => expect(screen.getByText("GBA Game 60")).toBeInTheDocument());

    const library = screen.getByTestId("immersive-library");
    for (let index = 0; index < 59; index += 1) {
      fireEvent.keyDown(library, { key: "ArrowRight" });
    }
    await waitFor(() => expect(finishGbaSecondPage).toEqual(expect.any(Function)));
    expect(invoke).toHaveBeenCalledWith("get_games_page", {
      platformId: "gba",
      searchQuery: null,
      page: 2,
      pageSize: 60,
    });

    await act(async () => finishGbaSecondPage({ games: gbaSecondPage, total: 61 }));
    await waitFor(() => expect(screen.getByTestId("game-161")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "All platforms" }));
    await waitFor(() => expect(screen.getByText("All Game 1")).toBeInTheDocument());
    expect(invoke).toHaveBeenCalledWith("get_games_page", {
      platformId: null,
      searchQuery: null,
      page: 1,
      pageSize: 60,
    });
  });

  it("ignores a stale platform response after a newer selection", async () => {
    let finishGba;
    let finishSnes;
    invoke.mockImplementation((command, args) => {
      if (command === "get_games_page") {
        if (args.platformId === null) {
          return Promise.resolve({
            games: [{ id: 1, name: "All Game", platform_id: "gba" }],
            total: 1,
          });
        }
        if (args.platformId === "gba") {
          return new Promise((resolve) => {
            finishGba = resolve;
          });
        }
        if (args.platformId === "snes") {
          return new Promise((resolve) => {
            finishSnes = resolve;
          });
        }
      }
      if (command === "get_platforms_with_games") return Promise.resolve(immersivePlatforms);
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
    fireEvent.click(screen.getByRole("button", { name: "Game Boy Advance" }));
    await waitFor(() => expect(finishGba).toEqual(expect.any(Function)));
    fireEvent.click(screen.getByRole("button", { name: "Super Nintendo" }));
    await waitFor(() => expect(finishSnes).toEqual(expect.any(Function)));

    await act(async () => finishGba({ games: [{ id: 2, name: "Stale GBA", platform_id: "gba" }], total: 1 }));
    await act(async () => finishSnes({ games: [{ id: 3, name: "Current SNES", platform_id: "snes" }], total: 1 }));

    await waitFor(() => expect(screen.getByTestId("game-3")).toBeInTheDocument());
    expect(screen.queryByTestId("game-2")).not.toBeInTheDocument();
    expect(screen.getByTestId("selected-index")).toHaveTextContent("0");
  });

  it("passes partial, case-insensitive name searches to the complete-library query and clears them", async () => {
    const marioResult = [{ id: 3, name: "Super Mario World", platform_id: "snes" }];
    invoke.mockImplementation((command, args) => {
      if (command === "get_games_page") {
        if (args.searchQuery === "mAr") {
          return Promise.resolve({ games: marioResult, total: 1 });
        }
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

    const library = screen.getByTestId("immersive-library");
    fireEvent.keyDown(library, { key: "ArrowRight" });
    expect(screen.getByTestId("selected-index")).toHaveTextContent("1");

    const search = screen.getByRole("textbox", { name: "Search games by name" });
    search.focus();
    fireEvent.change(search, { target: { value: "mAr" } });

    await waitFor(() => expect(screen.getByTestId("game-3")).toBeInTheDocument());
    expect(screen.queryByTestId("game-1")).not.toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("get_games_page", {
      platformId: null,
      searchQuery: "mAr",
      page: 1,
      pageSize: 60,
    });
    expect(screen.getByTestId("selected-index")).toHaveTextContent("0");
    expect(document.activeElement).toBe(search);

    fireEvent.click(screen.getByRole("button", { name: "Clear game search" }));

    await waitFor(() => expect(screen.getByTestId("game-1")).toBeInTheDocument());
    expect(screen.getByRole("textbox", { name: "Search games by name" })).toHaveValue("");
    expect(
      invoke.mock.calls.filter(([command]) => command === "get_games_page").at(-1),
    ).toEqual([
      "get_games_page",
      { platformId: null, searchQuery: null, page: 1, pageSize: 60 },
    ]);
  });

  it("keeps the active name query on selected-platform page requests", async () => {
    const marioGba = [{ id: 4, name: "Mario Advance", platform_id: "gba" }];
    invoke.mockImplementation((command, args) => {
      if (command === "get_games_page") {
        if (args.searchQuery === "mario") {
          return Promise.resolve({ games: marioGba, total: 1 });
        }
        return Promise.resolve({ games: initialGames, total: initialGames.length });
      }
      if (command === "get_platforms_with_games") return Promise.resolve(immersivePlatforms);
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

    fireEvent.change(screen.getByRole("textbox", { name: "Search games by name" }), {
      target: { value: "mario" },
    });
    await waitFor(() => expect(screen.queryByTestId("game-1")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Game Boy Advance" }));

    await waitFor(() => expect(screen.getByTestId("game-4")).toBeInTheDocument());
    expect(invoke).toHaveBeenCalledWith("get_games_page", {
      platformId: "gba",
      searchQuery: "mario",
      page: 1,
      pageSize: 60,
    });
    expect(screen.getByTestId("selected-index")).toHaveTextContent("0");
  });

  it("lazy-loads later pages using the active name query", async () => {
    const firstPage = Array.from({ length: 60 }, (_, index) => ({
      id: index + 10,
      name: `Mario Match ${index + 1}`,
      platform_id: "gba",
    }));
    const secondPage = [{ id: 70, name: "Mario Match 61", platform_id: "gba" }];
    let finishSecondPage;

    invoke.mockImplementation((command, args) => {
      if (command === "get_games_page") {
        if (args.searchQuery === "mario" && args.page === 1) {
          return Promise.resolve({ games: firstPage, total: 61 });
        }
        if (args.searchQuery === "mario" && args.page === 2) {
          return new Promise((resolve) => {
            finishSecondPage = resolve;
          });
        }
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

    fireEvent.change(screen.getByRole("textbox", { name: "Search games by name" }), {
      target: { value: "mario" },
    });
    await waitFor(() => expect(screen.getByTestId("game-69")).toBeInTheDocument());

    const library = screen.getByTestId("immersive-library");
    for (let index = 0; index < 59; index += 1) {
      fireEvent.keyDown(library, { key: "ArrowRight" });
    }
    await waitFor(() => expect(finishSecondPage).toEqual(expect.any(Function)));
    expect(invoke).toHaveBeenCalledWith("get_games_page", {
      platformId: null,
      searchQuery: "mario",
      page: 2,
      pageSize: 60,
    });

    await act(async () => finishSecondPage({ games: secondPage, total: 61 }));
    await waitFor(() => expect(screen.getByTestId("game-70")).toBeInTheDocument());
  });

  it("does not append a stale filtered page after the search query changes", async () => {
    const oldFirstPage = Array.from({ length: 60 }, (_, index) => ({
      id: index + 100,
      name: `Old Match ${index + 1}`,
      platform_id: "gba",
    }));
    const oldSecondPage = [{ id: 160, name: "Old Match 61", platform_id: "gba" }];
    const newFirstPage = [{ id: 200, name: "New Match", platform_id: "gba" }];
    let finishOldSecondPage;

    invoke.mockImplementation((command, args) => {
      if (command === "get_games_page") {
        if (args.searchQuery === "old" && args.page === 1) {
          return Promise.resolve({ games: oldFirstPage, total: 61 });
        }
        if (args.searchQuery === "old" && args.page === 2) {
          return new Promise((resolve) => {
            finishOldSecondPage = resolve;
          });
        }
        if (args.searchQuery === "new" && args.page === 1) {
          return Promise.resolve({ games: newFirstPage, total: 1 });
        }
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

    const search = screen.getByRole("textbox", { name: "Search games by name" });
    fireEvent.change(search, { target: { value: "old" } });
    await waitFor(() => expect(screen.getByTestId("game-159")).toBeInTheDocument());

    const library = screen.getByTestId("immersive-library");
    for (let index = 0; index < 59; index += 1) {
      fireEvent.keyDown(library, { key: "ArrowRight" });
    }
    await waitFor(() => expect(finishOldSecondPage).toEqual(expect.any(Function)));

    fireEvent.change(search, { target: { value: "new" } });
    await waitFor(() => expect(screen.getByTestId("game-200")).toBeInTheDocument());
    expect(screen.queryByTestId("game-159")).not.toBeInTheDocument();

    await act(async () => finishOldSecondPage({ games: oldSecondPage, total: 61 }));

    expect(screen.getByTestId("game-200")).toBeInTheDocument();
    expect(screen.queryByTestId("game-160")).not.toBeInTheDocument();
    expect(screen.queryByTestId("game-159")).not.toBeInTheDocument();
    expect(search).toHaveValue("new");
  });

  it("ignores an older name-query response after a newer query starts", async () => {
    let finishOldQuery;
    let finishNewQuery;
    invoke.mockImplementation((command, args) => {
      if (command === "get_games_page") {
        if (args.searchQuery === "old") {
          return new Promise((resolve) => {
            finishOldQuery = resolve;
          });
        }
        if (args.searchQuery === "new") {
          return new Promise((resolve) => {
            finishNewQuery = resolve;
          });
        }
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

    const search = screen.getByRole("textbox", { name: "Search games by name" });
    fireEvent.change(search, { target: { value: "old" } });
    await waitFor(() => expect(finishOldQuery).toEqual(expect.any(Function)));
    fireEvent.change(search, { target: { value: "new" } });
    await waitFor(() => expect(finishNewQuery).toEqual(expect.any(Function)));

    await act(async () =>
      finishNewQuery({
        games: [{ id: 8, name: "New Result", platform_id: "gba" }],
        total: 1,
      }),
    );
    await waitFor(() => expect(screen.getByTestId("game-8")).toBeInTheDocument());

    await act(async () =>
      finishOldQuery({
        games: [{ id: 9, name: "Old Result", platform_id: "gba" }],
        total: 1,
      }),
    );
    expect(screen.getByTestId("game-8")).toBeInTheDocument();
    expect(screen.queryByTestId("game-9")).not.toBeInTheDocument();
    expect(search).toHaveValue("new");
    expect(screen.getByTestId("selected-index")).toHaveTextContent("0");
  });

  it("suppresses immersive shell shortcuts while the game-name search is focused", async () => {
    const onExit = vi.fn();
    invoke.mockImplementation((command) => {
      if (command === "get_games_page") return Promise.resolve({ games: initialGames, total: 2 });
      if (command === "get_platforms_with_games") return Promise.resolve([]);
      if (command === "get_config") return Promise.resolve({ display: { big_picture: true } });
      return Promise.resolve(null);
    });

    render(
      <MuiTestProvider>
        <ImmersiveModeApp
          onExit={onExit}
          rommToken={null}
          rommUrl={null}
          onRommConnect={vi.fn()}
        />
      </MuiTestProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("game-1")).toBeInTheDocument());

    const search = screen.getByRole("textbox", { name: "Search games by name" });
    search.focus();
    dispatchControllerKeyTo(search, "h", {
      action: {
        actionId: 51,
        key: "h",
        controllerIndex: 1,
        phase: "edge",
        elapsedSincePreviousMs: null,
        deferred: false,
      },
    });
    dispatchControllerKeyTo(search, "Escape", {
      action: {
        actionId: 52,
        key: "Escape",
        controllerIndex: 1,
        phase: "edge",
        elapsedSincePreviousMs: null,
        deferred: false,
      },
    });
    dispatchControllerKeyTo(search, "F11", {
      action: {
        actionId: 53,
        key: "F11",
        controllerIndex: 1,
        phase: "edge",
        elapsedSincePreviousMs: null,
        deferred: false,
      },
    });

    expect(screen.getByTestId("immersive-hints")).toHaveTextContent("true");
    expect(onExit).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(search);
  });
});
