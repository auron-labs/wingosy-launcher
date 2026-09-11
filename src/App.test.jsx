import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { MuiTestProvider } from "./test/muiHarness";

/** @type {import("vitest").Mock<(command: string, args?: Record<string, unknown>) => Promise<unknown>>} */
const invoke = vi.fn();

const runtime = {
  getCurrentWindow: () => ({
    isFullscreen: () => Promise.resolve(false),
    onResized: () => Promise.resolve(() => {}),
    startDragging: () => Promise.resolve(),
  }),
  invoke,
  listen: () => Promise.resolve(() => {}),
  openUrl: () => Promise.resolve(),
};

afterEach(() => {
  cleanup();
  invoke.mockReset();
});

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
  it("filters the real library to favorites and focuses its active control", async () => {
    invoke.mockImplementation((command) => {
      if (command === "is_first_run") {
        return Promise.resolve(false);
      }
      if (command === "get_platforms_with_games") {
        return Promise.resolve(platforms);
      }
      if (command === "get_config") {
        return Promise.resolve({});
      }
      if (command === "check_for_app_update") {
        return Promise.resolve({ is_update_available: false });
      }
      if (command === "get_games_page") {
        return Promise.resolve({ games, total: games.length });
      }
      if (command === "get_games_filtered") {
        return Promise.resolve(games);
      }
      return Promise.resolve(null);
    });

    render(
      <MuiTestProvider>
        <App runtime={runtime} />
      </MuiTestProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { exact: true, name: "Starred Quest" })
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { exact: true, name: "Unstarred Quest" })
    ).toBeInTheDocument();

    const favoritesButton = screen.getByRole("button", {
      exact: true,
      name: "Favorites",
    });
    fireEvent.click(favoritesButton);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "get_games_filtered",
        expect.objectContaining({ favoritesOnly: true })
      );
      expect(
        screen.getByRole("button", { exact: true, name: "Starred Quest" })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { exact: true, name: "Unstarred Quest" })
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("library-result-count")).toHaveTextContent(
        "1 result"
      );
      expect(
        screen.getByRole("combobox", { name: "Filter" })
      ).toHaveTextContent("Favorites");
      expect(favoritesButton).toHaveAttribute("aria-current", "page");
    });

    expect(document.activeElement).toBe(
      screen.getByPlaceholderText("Search games...")
    );
  });
});
