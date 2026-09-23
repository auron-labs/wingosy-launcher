import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDeferred,
  dispatchControllerKey,
  initialGames,
  invoke,
  noOpCallback,
  renderImmersiveModeApp,
  resetImmersiveModeTest,
  resolveDeferred,
} from "./immersive-mode-app-test-fixtures";

/** @template T @param {PromiseWithResolvers<T>} deferred @param {T} value Resolve a deferred operation. */
const resolveInAct = (deferred, value) => {
  resolveDeferred(deferred, value);
};

describe("ImmersiveModeApp duplicate games", () => {
  afterEach(resetImmersiveModeTest);

  it("passes only one tile for duplicate game records", async () => {
    const games = [
      { id: 1, name: "Bonk's Adventure", platform_id: "nes" },
      { id: 2, name: "  BONK'S   ADVENTURE ", platform_id: "NES" },
      { id: 3, name: "Another Game", platform_id: "nes" },
    ];
    invoke.mockImplementation((command) => {
      if (command === "get_games_page") {
        return { games, total: games.length };
      }
      if (command === "get_platforms_with_games") {
        return [];
      }
      if (command === "get_config") {
        return { display: { big_picture: true } };
      }
      return null;
    });

    renderImmersiveModeApp();

    await waitFor(() => {
      expect(screen.getByTestId("game-1")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("game-2")).not.toBeInTheDocument();
    expect(screen.getByTestId("game-3")).toBeInTheDocument();
  });
});

describe("ImmersiveModeApp RomM sync monitor", () => {
  afterEach(resetImmersiveModeTest);

  it("opens the shared monitor from immersive utilities and returns to the library", async () => {
    invoke.mockImplementation((command) => {
      if (command === "get_games_page") {
        return { games: initialGames, total: initialGames.length };
      }
      if (command === "get_platforms_with_games") {
        return [];
      }
      if (command === "get_config") {
        return { display: { big_picture: true } };
      }
      return null;
    });
    /** @type {import("../components/use-romm-sync-monitor").RommSyncMonitorState} */
    const rommSyncMonitor = {
      activeOperation: null,
      error: null,
      loadOverview: vi.fn(async () => {}),
      loading: false,
      platformStatuses: {},
      platforms: [
        {
          installed_games: 1,
          local_games: 2,
          name: "Game Boy Advance",
          platform_id: "gba",
          romm_platform_id: 7,
          server_games: 3,
        },
      ],
      syncAll: vi.fn(async () => {}),
      syncAllStatus: { error: null, state: "idle", totalGames: null },
      syncPlatform: vi.fn(async () => {}),
    };

    renderImmersiveModeApp({ rommSyncMonitor });
    await waitFor(() => {
      expect(screen.getByTestId("game-1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "RomM Sync" }));

    expect(screen.getByTestId("romm-sync-monitor")).toBeInTheDocument();
    expect(screen.getByText("Game Boy Advance")).toBeInTheDocument();
    expect(screen.getByText("Server ROMs")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to library" }));
    expect(screen.getByTestId("immersive-library")).toBeInTheDocument();
  });
});

describe("ImmersiveModeApp selected game refresh", () => {
  afterEach(resetImmersiveModeTest);

  it("keeps the selected game, details view, and library index after refresh", async () => {
    let games = initialGames;
    const launch = createDeferred();
    invoke.mockImplementation(async (command) => {
      if (command === "get_games_page") {
        return { games, total: games.length };
      }
      if (command === "get_platforms_with_games") {
        return [];
      }
      if (command === "get_config") {
        return { display: { big_picture: true } };
      }
      if (command === "prepare_and_launch_game") {
        return await launch.promise;
      }
      return null;
    });

    renderImmersiveModeApp();
    await waitFor(() => {
      expect(screen.getByTestId("game-2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("game-2"));
    expect(screen.getByTestId("details-game")).toHaveTextContent("Second Game");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    games = [
      { ...initialGames[0] },
      { ...initialGames[1], name: "Second Game Refreshed" },
    ];
    resolveInAct(launch, { success: true });

    await waitFor(() => {
      expect(screen.getByTestId("details-game")).toHaveTextContent(
        "Second Game Refreshed"
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByTestId("selected-index")).toHaveTextContent("1");
  });
});

describe("ImmersiveModeApp settings callbacks", () => {
  afterEach(resetImmersiveModeTest);

  it("supplies a saved RetroAchievements preference to details after returning from settings", async () => {
    invoke.mockImplementation((command) => {
      if (command === "get_games_page") {
        return { games: initialGames, total: initialGames.length };
      }
      if (command === "get_platforms_with_games") {
        return [];
      }
      if (command === "get_config") {
        return { display: { big_picture: true } };
      }
      return null;
    });

    renderImmersiveModeApp();
    await waitFor(() => {
      expect(screen.getByTestId("game-1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("game-1"));
    expect(screen.getByTestId("details-retroachievements")).toHaveTextContent(
      "false"
    );
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Save RetroAchievements" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Back to details" }));

    expect(screen.getByTestId("details-retroachievements")).toHaveTextContent(
      "true"
    );
  });
});

describe("ImmersiveModeApp launch messages", () => {
  afterEach(resetImmersiveModeTest);

  it("presents successful automatic save-sync messages without treating them as errors", async () => {
    invoke.mockImplementation((command) => {
      if (command === "get_games_page") {
        return { games: initialGames, total: initialGames.length };
      }
      if (command === "get_platforms_with_games") {
        return [];
      }
      if (command === "get_config") {
        return { display: { big_picture: true } };
      }
      if (command === "prepare_and_launch_game") {
        return {
          save_sync_messages: ["Uploaded newer local save"],
          success: true,
        };
      }
      return null;
    });

    renderImmersiveModeApp();
    await waitFor(() => {
      expect(screen.getByTestId("game-1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("game-1"));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => {
      expect(screen.getByText("Uploaded newer local save")).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId("immersive-launch-error")
    ).not.toBeInTheDocument();
  });
});

describe("ImmersiveModeApp details back navigation", () => {
  afterEach(resetImmersiveModeTest);

  it("returns from details to the immersive library on controller Back", async () => {
    invoke.mockImplementation((command) => {
      if (command === "get_games_page") {
        return { games: initialGames, total: initialGames.length };
      }
      if (command === "get_platforms_with_games") {
        return [];
      }
      if (command === "get_config") {
        return { display: { big_picture: true } };
      }
      return null;
    });

    renderImmersiveModeApp();
    await waitFor(() => {
      expect(screen.getByTestId("game-1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("game-1"));
    expect(screen.getByTestId("details-game")).toHaveTextContent("First Game");

    dispatchControllerKey("Escape", {
      action: {
        actionId: 1,
        controllerIndex: 0,
        deferred: false,
        elapsedSincePreviousMs: null,
        key: "Escape",
        phase: "edge",
      },
    });

    expect(screen.getByTestId("immersive-library")).toBeInTheDocument();
    expect(screen.getByTestId("selected-index")).toHaveTextContent("0");
  });
});

describe("ImmersiveModeApp launch guards", () => {
  afterEach(resetImmersiveModeTest);

  it("defers window hotkeys to open menus and suppresses repeated or cross-game launches", async () => {
    const launch = createDeferred();
    invoke.mockImplementation(async (command) => {
      if (command === "get_games_page") {
        return { games: initialGames, total: initialGames.length };
      }
      if (command === "get_platforms_with_games") {
        return [];
      }
      if (command === "get_config") {
        return { display: { big_picture: true } };
      }
      if (command === "prepare_and_launch_game") {
        return await launch.promise;
      }
      return null;
    });

    renderImmersiveModeApp();
    await waitFor(() => {
      expect(screen.getByTestId("game-1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("game-1"));

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    dispatchControllerKey("h");
    expect(screen.getByTestId("immersive-hints")).toHaveTextContent("true");
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    dispatchControllerKey("h");
    expect(screen.getByTestId("immersive-hints")).toHaveTextContent("false");

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(invoke).toHaveBeenCalledWith("prepare_and_launch_game", {
      gameId: 1,
    });
    expect(
      invoke.mock.calls.filter(
        ([command]) => command === "prepare_and_launch_game"
      )
    ).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByTestId("game-2"));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(
      invoke.mock.calls.filter(
        ([command]) => command === "prepare_and_launch_game"
      )
    ).toHaveLength(1);

    resolveInAct(launch, { success: true });
  });
});

describe("ImmersiveModeApp shell debug logging", () => {
  afterEach(resetImmersiveModeTest);

  it("logs shell suppression for a correlated controller action while a menu is open", async () => {
    vi.stubEnv("VITE_WINGOSY_DEBUG", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    invoke.mockImplementation((command) => {
      if (command === "get_games_page") {
        return { games: initialGames, total: initialGames.length };
      }
      if (command === "get_platforms_with_games") {
        return [];
      }
      if (command === "get_config") {
        return { display: { big_picture: true } };
      }
      return null;
    });

    renderImmersiveModeApp({ onRommConnect: noOpCallback });
    await waitFor(() => {
      expect(screen.getByTestId("game-1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("game-1"));
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    dispatchControllerKey("h", {
      action: {
        actionId: 44,
        controllerIndex: 2,
        deferred: false,
        elapsedSincePreviousMs: null,
        key: "h",
        phase: "edge",
      },
    });

    expect(info).toHaveBeenCalledWith(
      "[Wingosy][debug][controller] receiver suppressed",
      expect.objectContaining({
        actionId: 44,
        key: "h",
        outcome: "suppressed",
        reason: "menu open",
        receiver: "shell",
      })
    );
  });
});
