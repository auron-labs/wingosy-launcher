import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cleanupLibraryTest,
  controllerKeyDown,
  keyDown,
  makeFavoriteGames,
  makeGames,
  renderLibrary,
  setViewportWidth,
} from "./immersive-library-test-fixtures";

/** @type {import("./immersive-types").PlatformEntry[]} */
const platformEntries = [
  [{ id: "snes", name: "Super Nintendo", short_name: "SNES" }, 1],
  [{ id: "gba", name: "Game Boy Advance", short_name: "GBA" }, 2],
];
const platformGames = [
  {
    id: 1,
    is_favorite: false,
    name: "SNES Game",
    platform_id: "snes",
    sync_state: "synced",
  },
  {
    id: 2,
    is_favorite: true,
    name: "GBA Favorite",
    platform_id: "gba",
    sync_state: "synced",
  },
  {
    id: 3,
    is_favorite: false,
    last_played_at: "2026-09-01",
    name: "GBA Recent",
    platform_id: "gba",
    sync_state: "synced",
  },
];
const searchGames = [
  {
    id: 1,
    is_favorite: true,
    last_played_at: null,
    name: "Mario Favorite",
    platform_id: "gba",
    sync_state: "synced",
  },
  {
    id: 2,
    is_favorite: false,
    last_played_at: "2026-09-01",
    name: "Mario Recent",
    platform_id: "gba",
    sync_state: "synced",
  },
  {
    id: 3,
    is_favorite: false,
    last_played_at: null,
    name: "Mario Other",
    platform_id: "gba",
    sync_state: "synced",
  },
  {
    id: 5,
    is_favorite: true,
    last_played_at: null,
    name: "Zelda Favorite",
    platform_id: "gba",
    sync_state: "synced",
  },
  {
    id: 6,
    is_favorite: false,
    last_played_at: "2026-09-03",
    name: "Zelda Recent",
    platform_id: "gba",
    sync_state: "synced",
  },
  {
    id: 4,
    is_favorite: true,
    last_played_at: "2026-09-02",
    name: "Mario SNES",
    platform_id: "snes",
    sync_state: "synced",
  },
];
/** @type {import("./immersive-types").PlatformEntry[]} */
const searchPlatforms = [
  [{ id: "gba", name: "Game Boy Advance" }, 3],
  [{ id: "snes", name: "Super Nintendo" }, 1],
];

const navigateTest = (width, columns) => {
  setViewportWidth(width);
  const { onSelectedIndexChange } = renderLibrary(makeGames(20), {
    initialIndex: 0,
  });
  const root = screen.getByTestId("immersive-library");

  keyDown(root, "ArrowRight");
  expect(onSelectedIndexChange).toHaveBeenLastCalledWith(1);

  onSelectedIndexChange.mockClear();
  keyDown(root, "ArrowLeft");
  expect(onSelectedIndexChange).toHaveBeenLastCalledWith(0);

  for (let i = 0; i < columns; i += 1) {
    keyDown(root, "ArrowRight");
  }
  expect(onSelectedIndexChange).toHaveBeenLastCalledWith(columns);

  onSelectedIndexChange.mockClear();
  keyDown(root, "ArrowUp");
  expect(onSelectedIndexChange).toHaveBeenLastCalledWith(0);
};

describe("ImmersiveLibrary responsive grid", () => {
  afterEach(cleanupLibraryTest);

  it.each([
    [1280, 6],
    [1200, 6],
    [1199, 4],
    [900, 4],
    [899, 3],
    [600, 3],
    [599, 2],
    [320, 2],
  ])("uses %i columns at width %ipx", (width, expected) => {
    setViewportWidth(width);
    renderLibrary();
    const grid = screen.getByTestId("immersive-grid");
    expect(grid).toHaveStyle({
      gridTemplateColumns: `repeat(${expected}, minmax(0, 1fr))`,
    });
  });
});

describe("ImmersiveLibrary keyboard navigation", () => {
  afterEach(cleanupLibraryTest);

  it("navigates with 6 columns on wide screens", () => {
    navigateTest(1280, 6);
    expect(screen.getByTestId("immersive-library")).toHaveAttribute(
      "tabindex",
      "0"
    );
  });

  it("navigates with 4 columns on medium screens", () => {
    navigateTest(1000, 4);
    expect(screen.getByTestId("immersive-library")).toHaveAttribute(
      "tabindex",
      "0"
    );
  });

  it("navigates with 3 columns on small screens", () => {
    navigateTest(800, 3);
    expect(screen.getByTestId("immersive-library")).toHaveAttribute(
      "tabindex",
      "0"
    );
  });

  it("navigates with 2 columns on narrow screens", () => {
    navigateTest(500, 2);
    expect(screen.getByTestId("immersive-library")).toHaveAttribute(
      "tabindex",
      "0"
    );
  });

  it("handles partial final rows", () => {
    setViewportWidth(800);
    const { onSelectedIndexChange } = renderLibrary(makeGames(7), {
      initialIndex: 4,
    });
    const root = screen.getByTestId("immersive-library");

    keyDown(root, "ArrowDown");
    expect(onSelectedIndexChange).toHaveBeenLastCalledWith(6);

    onSelectedIndexChange.mockClear();
    keyDown(root, "ArrowRight");
    expect(onSelectedIndexChange).not.toHaveBeenCalled();
  });

  it("handles libraries smaller than one row", () => {
    setViewportWidth(1280);
    const { onSelectedIndexChange } = renderLibrary(makeGames(2), {
      initialIndex: 0,
    });
    const root = screen.getByTestId("immersive-library");

    keyDown(root, "ArrowDown");
    expect(onSelectedIndexChange).toHaveBeenLastCalledWith(1);

    onSelectedIndexChange.mockClear();
    keyDown(root, "ArrowRight");
    expect(onSelectedIndexChange).not.toHaveBeenCalled();
  });
});

describe("ImmersiveLibrary controller focus", () => {
  afterEach(cleanupLibraryTest);

  it("focuses the game control and logs correlated focus descriptors", () => {
    vi.stubEnv("VITE_WINGOSY_DEBUG", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    renderLibrary(makeGames(3));
    const root = screen.getByTestId("immersive-library");
    root.focus();

    controllerKeyDown(root, "ArrowRight");
    expect(document.activeElement).toBe(
      screen
        .getByTestId("immersive-grid")
        .querySelector('[data-immersive-index="1"] button')
    );

    const { calls } = info.mock;
    const handledCall = calls.find(
      ([message]) => message === "[Wingosy][debug][controller] receiver handled"
    );
    if (!handledCall) {
      throw new Error("Expected a handled library controller action");
    }
    expect(handledCall[1]).toMatchObject({
      actionId: 21,
      afterFocus: { role: "button", tag: "button" },
      beforeFocus: { testId: "immersive-library" },
      key: "ArrowRight",
      outcome: "handled",
      reason: "focus-moved",
      receiver: "library",
      targetFocus: { index: "1", tag: "div" },
    });
  });
});

describe("ImmersiveLibrary sections switching", () => {
  afterEach(cleanupLibraryTest);

  it("switches sections and resets selection to zero", () => {
    const { onSelectedIndexChange } = renderLibrary(
      [...makeGames(4), ...makeFavoriteGames(2)],
      { initialIndex: 3 }
    );

    fireEvent.click(screen.getByRole("button", { name: "Favorites" }));
    expect(onSelectedIndexChange).toHaveBeenCalledWith(0);
    expect(
      within(screen.getByTestId("immersive-grid")).getByText("Favorite 1")
    ).toBeInTheDocument();
  });

  it("cycles sections forward and backward with PageDown and PageUp", () => {
    renderLibrary(makeGames(6), { initialIndex: 2 });
    const root = screen.getByTestId("immersive-library");

    keyDown(root, "PageDown");
    expect(screen.getByRole("button", { name: "Favorites" })).toHaveAttribute(
      "class",
      expect.stringContaining("MuiButton")
    );

    keyDown(root, "PageDown");
    expect(screen.getByRole("button", { name: "Recent" })).toBeInTheDocument();

    keyDown(root, "PageUp");
    expect(
      screen.getByRole("button", { name: "Favorites" })
    ).toBeInTheDocument();
  });
});

describe("ImmersiveLibrary platform filtering", () => {
  afterEach(cleanupLibraryTest);

  it("offers display-named platform controls and selects or clears them", () => {
    const { onSelectedPlatformChange } = renderLibrary(platformGames, {
      platforms: platformEntries,
    });

    fireEvent.click(screen.getByRole("button", { name: "Game Boy Advance" }));
    expect(onSelectedPlatformChange).toHaveBeenCalledWith("gba");
    expect(screen.queryByText("SNES Game")).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("immersive-grid")).getByText("GBA Favorite")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "All platforms" }));
    expect(onSelectedPlatformChange).toHaveBeenLastCalledWith(null);
    expect(
      within(screen.getByTestId("immersive-grid")).getByText("SNES Game")
    ).toBeInTheDocument();
  });

  it("keeps platform filtering composed with favorites and recent sections", () => {
    renderLibrary(platformGames, {
      initialPlatform: "gba",
      platforms: platformEntries,
    });

    fireEvent.click(screen.getByRole("button", { name: "Favorites" }));
    expect(
      within(screen.getByTestId("immersive-grid")).getByText("GBA Favorite")
    ).toBeInTheDocument();
    expect(screen.queryByText("SNES Game")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Recent" }));
    expect(
      within(screen.getByTestId("immersive-grid")).getByText("GBA Recent")
    ).toBeInTheDocument();
    expect(screen.queryByText("SNES Game")).not.toBeInTheDocument();
  });
});

describe("ImmersiveLibrary platform navigation", () => {
  afterEach(cleanupLibraryTest);

  it("moves between platform controls with arrows and activates one with Enter", () => {
    const { onSelectedPlatformChange } = renderLibrary(platformGames, {
      platforms: platformEntries,
    });
    const allPlatforms = screen.getByRole("button", { name: "All platforms" });
    const superNintendo = screen.getByRole("button", {
      name: "Super Nintendo",
    });

    allPlatforms.focus();
    keyDown(allPlatforms, "ArrowRight");
    expect(document.activeElement).toBe(superNintendo);

    keyDown(superNintendo, "Enter");
    expect(onSelectedPlatformChange).toHaveBeenCalledWith("snes");
  });

  it("resets focus to the first result and focuses the library for an empty result", async () => {
    const { onSelectedIndexChange } = renderLibrary(platformGames, {
      initialIndex: 2,
      platforms: platformEntries,
    });
    const gba = screen.getByRole("button", { name: "Game Boy Advance" });

    fireEvent.click(gba);
    await waitFor(() => {
      expect(onSelectedIndexChange).toHaveBeenCalledWith(0);
      expect(document.activeElement).toBe(
        screen.getByTestId("immersive-grid").querySelector("button")
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Super Nintendo" }));
    fireEvent.click(screen.getByRole("button", { name: "Favorites" }));
    await waitFor(() => {
      expect(screen.getByText("No games found.")).toBeInTheDocument();
      expect(document.activeElement).toBe(
        screen.getByTestId("immersive-library")
      );
    });
  });
});

describe("ImmersiveLibrary game selection", () => {
  afterEach(cleanupLibraryTest);

  it("opens the selected game with Enter", () => {
    const games = makeGames(5);
    const { onSelectGame } = renderLibrary(games, { initialIndex: 2 });
    const root = screen.getByTestId("immersive-library");

    keyDown(root, "Enter");
    expect(onSelectGame).toHaveBeenCalledWith(games[2]);
  });
});

describe("ImmersiveLibrary selected-game hero", () => {
  afterEach(cleanupLibraryTest);

  it("shows the selected game's metadata, genres, and summary", () => {
    const games = [
      {
        ...makeGames(1)[0],
        genres: ["Action", "Adventure"],
        name: "First Game",
        release_year: 1995,
        summary: "A summary for the selected game.",
      },
      {
        ...makeGames(1)[0],
        id: 2,
        name: "Second Game",
        platform_id: "gba",
      },
    ];
    renderLibrary(games, { initialIndex: 0, platforms: platformEntries });

    expect(
      screen.getByRole("heading", { name: "First Game" })
    ).toBeInTheDocument();
    expect(screen.getByText("Super Nintendo / 1995")).toBeInTheDocument();
    expect(screen.getByText("Action / Adventure")).toBeInTheDocument();
    expect(
      screen.getByText("A summary for the selected game.")
    ).toBeInTheDocument();

    keyDown(screen.getByTestId("immersive-library"), "ArrowRight");

    expect(
      screen.getByRole("heading", { name: "Second Game" })
    ).toBeInTheDocument();
  });
});

describe("ImmersiveLibrary game-name search", () => {
  afterEach(cleanupLibraryTest);

  it("provides an editable search control with a clear action", () => {
    const { onSearchChange } = renderLibrary();
    const search = screen.getByRole("textbox", {
      name: "Search games by name",
    });

    fireEvent.change(search, { target: { value: "mArIo" } });

    expect(search).toHaveValue("mArIo");
    expect(onSearchChange).toHaveBeenLastCalledWith("mArIo");
    fireEvent.click(screen.getByRole("button", { name: "Clear game search" }));

    expect(search).toHaveValue("");
    expect(onSearchChange).toHaveBeenLastCalledWith("");
    expect(document.activeElement).toBe(search);
  });

  it("isolates typing and editing from controller library shortcuts", async () => {
    vi.stubEnv("VITE_WINGOSY_DEBUG", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { onSelectedIndexChange, onSelectGame, onOpenSettings } =
      renderLibrary(makeGames(6), { initialIndex: 2 });
    const search = screen.getByRole("textbox", {
      name: "Search games by name",
    });
    search.focus();

    for (const key of [
      "ArrowRight",
      "Enter",
      "PageDown",
      "PageUp",
      "s",
      "Escape",
      "F11",
    ]) {
      controllerKeyDown(search, key);
    }
    fireEvent.change(search, { target: { value: "game" } });

    await waitFor(() => {
      if (document.activeElement !== search) {
        throw new Error("Search lost focus while handling controller input");
      }
    });
    expect(onSelectedIndexChange).not.toHaveBeenCalled();
    expect(onSelectGame).not.toHaveBeenCalled();
    expect(onOpenSettings).not.toHaveBeenCalled();
    const { calls } = info.mock;
    const suppressionCall = calls.find(
      ([message]) =>
        message === "[Wingosy][debug][controller] receiver suppressed"
    );
    if (!suppressionCall) {
      throw new Error("Expected a suppressed library controller action");
    }
    expect(suppressionCall[1]).toMatchObject({
      actionId: 21,
      outcome: "suppressed",
      reason: "text-input-focused",
      receiver: "library",
    });

    const root = screen.getByTestId("immersive-library");
    root.focus();
    controllerKeyDown(root, "ArrowRight");
    expect(onSelectedIndexChange).toHaveBeenLastCalledWith(3);
  });

  it("shows a search-specific empty state and restores the normal empty state when cleared", () => {
    renderLibrary([], { initialSearch: "missing" });

    expect(screen.getByText("No games match your search.")).toBeInTheDocument();
    expect(
      screen.getByText("Try a different game name or clear your search.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear game search" }));

    expect(screen.getByText("No games found.")).toBeInTheDocument();
    expect(
      screen.queryByText("No games match your search.")
    ).not.toBeInTheDocument();
  });
});

describe("ImmersiveLibrary composed search", () => {
  afterEach(cleanupLibraryTest);

  it("filters names within the selected platform", () => {
    renderLibrary(searchGames, {
      initialPlatform: "gba",
      initialSearch: "mArIo",
      platforms: searchPlatforms,
    });

    const grid = screen.getByTestId("immersive-grid");
    expect(
      screen.getByRole("textbox", { name: "Search games by name" })
    ).toHaveValue("mArIo");
    expect(grid).toHaveTextContent(
      /Mario Favorite.*Mario Recent.*Mario Other/u
    );
    expect(grid).not.toHaveTextContent(
      /Mario SNES|Zelda Favorite|Zelda Recent/u
    );
  });

  it("composes search with favorites and recent sections", () => {
    renderLibrary(searchGames, {
      initialPlatform: "gba",
      initialSearch: "mArIo",
      platforms: searchPlatforms,
    });
    const grid = screen.getByTestId("immersive-grid");

    fireEvent.click(screen.getByRole("button", { name: "Favorites" }));
    expect(within(grid).getByText("Mario Favorite")).toBeInTheDocument();
    expect(grid).not.toHaveTextContent(/Mario Recent|Mario Other/u);

    fireEvent.click(screen.getByRole("button", { name: "Recent" }));
    expect(within(grid).getByText("Mario Recent")).toBeInTheDocument();
    expect(grid).not.toHaveTextContent(
      /Mario Favorite|Mario Other|Mario SNES/u
    );
  });

  it("restores the selected platform results when search is cleared", () => {
    renderLibrary(searchGames, {
      initialPlatform: "gba",
      initialSearch: "mArIo",
      platforms: searchPlatforms,
    });

    fireEvent.click(screen.getByRole("button", { name: "Recent" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear game search" }));

    expect(
      screen.getByRole("textbox", { name: "Search games by name" })
    ).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Game Boy Advance" })
    ).toHaveAttribute("aria-pressed", "true");
    const grid = screen.getByTestId("immersive-grid");
    expect(grid).toHaveTextContent(/Zelda Recent|Mario Recent/u);
    expect(grid).not.toHaveTextContent(/Mario Other|Mario SNES/u);
  });
});
