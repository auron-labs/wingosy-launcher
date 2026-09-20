import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./app";

/** @type {import("vitest").MockInstance & {<T>(command: string, args?: Record<string, unknown>): Promise<T>}} */
const invoke = vi.fn();

/** @type {((event: {payload: {romm_platform_id?: number, processed?: number, total?: number}}) => void)|null} */
let progressHandler = null;

/** @type {import("./app/app-runtime").AppRuntime["listen"]} */
const listen = async (event, handler) => {
  await Promise.resolve();
  if (event === "romm-platform-sync-progress") {
    progressHandler = handler;
  }
  return () => {
    if (
      event === "romm-platform-sync-progress" &&
      progressHandler === handler
    ) {
      progressHandler = null;
    }
  };
};

const runtime = {
  getCurrentWindow: () => ({
    isFullscreen: async () => {
      await Promise.resolve();
      return false;
    },
    onResized: async () => {
      await Promise.resolve();
      return () => {};
    },
    startDragging: async () => {
      await Promise.resolve();
    },
  }),
  invoke,
  listen,
  openUrl: async () => {
    await Promise.resolve();
  },
};

const resetAppTest = () => {
  cleanup();
  invoke.mockReset();
  progressHandler = null;
};

const renderApp = () => render(<App runtime={runtime} />);

const waitForGamesPageRequest = async () => {
  await waitFor(() => {
    expect(invoke).toHaveBeenCalledWith("get_games_page", expect.anything());
  });
};

/** @param {string} event Event name. @param {object} payload Event payload. */
const dispatchEvent = (event, payload) => {
  if (event === "romm-platform-sync-progress") {
    progressHandler?.({ payload });
  }
};

const games = [
  {
    id: 1,
    is_favorite: true,
    local_file_path: "/roms/starred-quest.nsp",
    name: "Starred Quest",
    platform_id: "switch",
    source: "Local",
    sync_state: "local_only",
  },
  {
    id: 2,
    is_favorite: false,
    local_file_path: "/roms/unstarred-quest.nsp",
    name: "Unstarred Quest",
    platform_id: "switch",
    source: "Local",
    sync_state: "local_only",
  },
];

const platforms = [
  [{ id: "switch", name: "Nintendo Switch", short_name: "Switch" }, 2],
];

const createFirstPageGames = () =>
  Array.from({ length: 60 }, (_, index) => ({
    ...games[0],
    id: index + 1,
    is_favorite: index === 0,
    name: `Game ${index + 1}`,
  }));

/** @param {{firstPageGames: typeof games, secondPageGames: typeof games}} pages Paginated library fixtures. */
const configurePagedLibraryIpc = ({ firstPageGames, secondPageGames }) => {
  invoke.mockImplementation(
    /** @param {string} command @param {Record<string, unknown>|undefined} args */
    (command, args) => {
      if (command === "is_first_run") {
        return false;
      }
      if (command === "get_platforms_with_games") {
        return platforms;
      }
      if (command === "get_config") {
        return {};
      }
      if (command === "check_for_app_update") {
        return { is_update_available: false };
      }
      if (command === "get_games_page") {
        if (args?.filterBy === "favorites") {
          return { games: [firstPageGames[0]], total: 1 };
        }
        return {
          games: args?.page === 2 ? secondPageGames : firstPageGames,
          total: 61,
        };
      }
      return null;
    }
  );
};

describe("Favorites navigation", () => {
  afterEach(resetAppTest);

  it("filters the real library to favorites and focuses its active control", async () => {
    invoke.mockImplementation(
      /** @param {string} command @param {Record<string, unknown>|undefined} args */
      (command, args) => {
        if (command === "is_first_run") {
          return false;
        }
        if (command === "get_platforms_with_games") {
          return platforms;
        }
        if (command === "get_config") {
          return {};
        }
        if (command === "check_for_app_update") {
          return { is_update_available: false };
        }
        if (command === "get_games_page") {
          const visibleGames =
            args?.filterBy === "favorites" ? [games[0]] : games;
          return { games: visibleGames, total: visibleGames.length };
        }
        return null;
      }
    );

    renderApp();
    await waitForGamesPageRequest();

    await waitFor(() => {
      expect(screen.getByText("Starred Quest")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Unstarred Quest" })
    ).toBeInTheDocument();

    const favoritesButton = screen.getByRole("button", {
      name: "Favorites",
    });
    fireEvent.click(favoritesButton);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "get_games_page",
        expect.objectContaining({
          availability: "all",
          filterBy: "favorites",
          sortBy: "name",
          sortDescending: false,
        })
      );
      expect(
        screen.getByRole("button", { name: "Starred Quest" })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Unstarred Quest" })
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("library-result-count")).toHaveTextContent(
        "1 result"
      );
      expect(
        screen.getByRole("combobox", { name: "Filter" })
      ).toHaveTextContent("Favorites");
    });

    expect(favoritesButton).toHaveAttribute("aria-current", "page");
    expect(document.activeElement).toBe(
      screen.getByPlaceholderText("Search games...")
    );
  });
});

describe("Desktop library paging and query controls", () => {
  afterEach(resetAppTest);

  it("renders the authoritative second page from a full first page", async () => {
    const firstPageGames = createFirstPageGames();
    const secondPageGames = [{ ...games[0], id: 61, name: "Game 61" }];
    configurePagedLibraryIpc({ firstPageGames, secondPageGames });

    renderApp();
    await waitForGamesPageRequest();

    await waitFor(() => {
      expect(screen.getByTestId("library-result-count")).toHaveTextContent(
        "61 results"
      );
      expect(screen.getByText("Game 60")).toBeInTheDocument();
    });
    expect(screen.getByText("Game 1")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Go to page 2"));

    await waitFor(() => {
      expect(screen.getByText("Game 61")).toBeInTheDocument();
      expect(screen.queryByText("Game 1")).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { current: "page", name: "page 2" })
    ).toBeInTheDocument();
  });

  it("sends composed query controls after paging", async () => {
    const [firstPageGame] = createFirstPageGames();
    const secondPageGames = [{ ...games[0], id: 61, name: "Game 61" }];
    configurePagedLibraryIpc({
      firstPageGames: [firstPageGame],
      secondPageGames,
    });

    renderApp();
    await waitForGamesPageRequest();

    await waitFor(() => {
      expect(screen.getByText("Game 1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Go to page 2"));

    await waitFor(() => {
      expect(screen.getByText("Game 61")).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Filter" }));
    fireEvent.click(screen.getByRole("option", { name: "Favorites" }));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Sort by" }));
    fireEvent.click(screen.getByRole("option", { name: "Most played" }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "get_games_page",
        expect.objectContaining({
          filterBy: "favorites",
          sortBy: "play_count",
          sortDescending: true,
        })
      );
    });

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Availability" }));
    fireEvent.click(screen.getByRole("option", { name: "Downloaded" }));
    fireEvent.click(screen.getByRole("button", { name: "Sort ascending" }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "get_games_page",
        expect.objectContaining({
          availability: "downloaded",
          filterBy: "favorites",
          page: 1,
          pageSize: 60,
          platformId: null,
          searchQuery: null,
          sortBy: "play_count",
          sortDescending: false,
        })
      );
    });
  });
});

describe("Desktop details navigation", () => {
  afterEach(resetAppTest);

  it("preserves platform and search context when returning from details", async () => {
    const searchedGame = { ...games[0], name: "Starred Quest" };
    invoke.mockImplementation(
      /** @param {string} command @param {Record<string, unknown>|undefined} args */
      (command, args) => {
        if (command === "is_first_run") {
          return false;
        }
        if (command === "get_platforms_with_games") {
          return platforms;
        }
        if (command === "get_config") {
          return {};
        }
        if (command === "check_for_app_update") {
          return { is_update_available: false };
        }
        if (command === "get_games_page") {
          if (args?.platformId === "switch" && args.searchQuery === "quest") {
            return { games: [searchedGame], total: 1 };
          }
          return { games, total: games.length };
        }
        return null;
      }
    );

    renderApp();
    await waitForGamesPageRequest();

    await waitFor(() => {
      expect(screen.getByText("Starred Quest")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Switch/u }));
    const search = screen.getByPlaceholderText("Search games...");
    fireEvent.change(search, { target: { value: "quest" } });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "get_games_page",
        expect.objectContaining({
          platformId: "switch",
          searchQuery: "quest",
        })
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Starred Quest" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Starred Quest" })
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Back to Library" }));

    await waitFor(() => {
      expect(search).toHaveValue("quest");
      expect(invoke).toHaveBeenCalledWith(
        "get_games_page",
        expect.objectContaining({
          page: 1,
          platformId: "switch",
          searchQuery: "quest",
        })
      );
    });
  });
});

const rommMonitorOverview = [
  {
    installed_games: 2,
    local_games: 3,
    name: "Nintendo Switch",
    platform_id: "switch",
    romm_platform_id: 11,
    server_games: 4,
  },
];

/** @param {PromiseWithResolvers<unknown>} sync Deferred sync operation. */
const configureRommMonitorIpc = (sync, overview = rommMonitorOverview) => {
  invoke.mockImplementation(
    /** @param {string} command IPC command. */
    async (command) => {
      if (command === "is_first_run") {
        return false;
      }
      if (command === "get_platforms_with_games") {
        return platforms;
      }
      if (command === "get_config") {
        return {
          romm: {
            auth_token: "test-token",
            server_url: "https://romm.example",
          },
        };
      }
      if (command === "restore_romm_session") {
        return {
          access_token: "test-token",
          server_url: "https://romm.example",
        };
      }
      if (command === "check_for_app_update") {
        return { is_update_available: false };
      }
      if (command === "get_games_page") {
        return { games, total: games.length };
      }
      if (command === "list_romm_sync_platforms") {
        return overview;
      }
      if (command === "sync_romm_platform") {
        return await sync.promise;
      }
      if (command === "sync_romm_library") {
        return await sync.promise;
      }
      return null;
    }
  );
};

describe("RomM sync monitor", () => {
  afterEach(resetAppTest);

  it("keeps scoped progress across navigation and refreshes the library after completion", async () => {
    /** @type {PromiseWithResolvers<{games_added: number, games_deleted: number, games_updated: number, total_games: number}>} */
    const sync = Promise.withResolvers();
    configureRommMonitorIpc(sync);

    renderApp();
    await waitForGamesPageRequest();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "RomM Sync" })
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "RomM Sync" }));

    await waitFor(() => {
      expect(screen.getByTestId("romm-sync-monitor")).toBeInTheDocument();
      expect(screen.getByText("Server ROMs")).toBeInTheDocument();
      expect(screen.getByText("Indexed RomM entries")).toBeInTheDocument();
      expect(screen.getByText("Downloaded locally")).toBeInTheDocument();
    });
    const platformCard = screen.getByTestId("romm-sync-platform-11");
    expect(within(platformCard).getByText("4")).toBeInTheDocument();
    expect(within(platformCard).getByText("3")).toBeInTheDocument();
    expect(within(platformCard).getByText("2")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Sync Nintendo Switch library metadata",
      })
    );
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("sync_romm_platform", {
        rommPlatformId: 11,
        serverUrl: "https://romm.example",
        token: "test-token",
      });
    });

    dispatchEvent("romm-platform-sync-progress", {
      processed: 1,
      romm_platform_id: 11,
      total: 4,
    });
    await waitFor(() => {
      expect(
        screen.getByText("Syncing Nintendo Switch library metadata · 1 / 4")
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "All Games" }));
    fireEvent.click(screen.getByRole("button", { name: "RomM Sync" }));
    await waitFor(() => {
      expect(
        screen.getByText("Syncing Nintendo Switch library metadata · 1 / 4")
      ).toBeInTheDocument();
    });

    sync.resolve({
      games_added: 1,
      games_deleted: 0,
      games_updated: 2,
      total_games: 4,
    });
    await waitFor(() => {
      expect(
        screen.getByText(/Metadata sync complete: 4 indexed/u)
      ).toBeInTheDocument();
      expect(invoke).toHaveBeenCalledWith("get_games_page", expect.anything());
    });
  });
});

describe("RomM sync all", () => {
  afterEach(resetAppTest);

  it("keeps Sync all available when the remote overview has no platforms", async () => {
    /** @type {PromiseWithResolvers<unknown[]>} */
    const sync = Promise.withResolvers();
    configureRommMonitorIpc(sync, []);

    renderApp();
    await waitForGamesPageRequest();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "RomM Sync" })
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "RomM Sync" }));
    await waitFor(() => {
      expect(screen.getByTestId("romm-sync-monitor")).toBeInTheDocument();
    });
    const syncAll = screen.getByRole("button", { name: "Sync all" });
    expect(syncAll).not.toBeDisabled();
    fireEvent.click(syncAll);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("sync_romm_library", {
        serverUrl: "https://romm.example",
        token: "test-token",
      });
    });
    sync.resolve([]);
  });
});

describe("Launch save-sync notifications", () => {
  afterEach(resetAppTest);

  it("presents duplicated Switch transfer results as one safe success message", async () => {
    const transfer =
      "Uploaded Switch save for 0100A5C00D162000 to RomM (slot: autosave)";
    const restored =
      "Restored Switch save 0100A5C00D162000 from RomM (slot: backup-2026-09-19, save id: 9001)";
    invoke.mockImplementation((command) => {
      if (command === "is_first_run") return false;
      if (command === "get_platforms_with_games") return platforms;
      if (command === "get_config") return {};
      if (command === "check_for_app_update") {
        return { is_update_available: false };
      }
      if (command === "get_games_page") {
        return { games, total: games.length };
      }
      if (command === "prepare_and_launch_game") {
        return {
          save_sync_messages: [transfer, restored, transfer],
          success: true,
        };
      }
      return null;
    });

    renderApp();

    await screen.findByRole("button", { name: "Play Starred Quest" });
    fireEvent.click(screen.getByRole("button", { name: "Play Starred Quest" }));

    await expect(
      screen.findByText("Cloud save sync completed.")
    ).resolves.toBeInTheDocument();
    expect(screen.getAllByText("Cloud save sync completed.")).toHaveLength(1);
    expect(screen.queryByText(transfer)).not.toBeInTheDocument();
    expect(screen.queryByText(/0100A5C00D162000/u)).not.toBeInTheDocument();
  });
});
