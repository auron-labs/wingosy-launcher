import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./app";
import { MuiTestProvider } from "./test/mui-harness";

/** @type {import("vitest").MockInstance & {<T>(command: string, args?: Record<string, unknown>): Promise<T>}} */
const invoke = vi.fn();

/** @type {import("./app/app-runtime").AppRuntime["listen"]} */
const listen = async (_event, _handler) => {
  await Promise.resolve();
  return () => {};
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

describe("Favorites navigation", () => {
  afterEach(() => {
    cleanup();
    invoke.mockReset();
  });

  it("filters the real library to favorites and focuses its active control", async () => {
    invoke.mockImplementation((command) => {
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
        return { games, total: games.length };
      }
      if (command === "get_games_filtered") {
        return games;
      }
      return null;
    });

    render(
      <MuiTestProvider>
        <App runtime={runtime} />
      </MuiTestProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Starred Quest" })
      ).toBeInTheDocument();
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
        "get_games_filtered",
        expect.objectContaining({ favoritesOnly: true })
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

describe("Launch save-sync notifications", () => {
  afterEach(() => {
    cleanup();
    invoke.mockReset();
  });

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
      if (command === "get_games_filtered") return games;
      if (command === "prepare_and_launch_game") {
        return {
          save_sync_messages: [transfer, restored, transfer],
          success: true,
        };
      }
      return null;
    });

    render(
      <MuiTestProvider>
        <App runtime={runtime} />
      </MuiTestProvider>
    );

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
