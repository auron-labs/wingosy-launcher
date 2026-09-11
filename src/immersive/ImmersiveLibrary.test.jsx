import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MuiTestProvider } from "../test/muiHarness";
import { attachControllerAction } from "./controllerDebug";
import ImmersiveLibrary from "./ImmersiveLibrary";

vi.mock(import("@tauri-apps/api/core"), () => ({
  convertFileSrc: (path) => path,
  invoke: vi.fn(),
}));

vi.mock(import("../RomDownloadsContext"), () => ({
  useRomDownloads: () => ({ activeCount: 0, getProgress: () => null }),
}));

vi.mock(import("../ThemeContext"), () => ({
  useAppTheme: () => ({
    colors: {
      focusGlow: "rgba(92,107,192,0.4)",
      primary: "#5C6BC0",
      primaryLight: "#8E99F3",
    },
  }),
}));

function makeGames(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    is_favorite: false,
    name: `Game ${i + 1}`,
    platform_id: "snes",
    sync_state: "synced",
  }));
}

function makeFavoriteGames(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: 100 + i,
    is_favorite: true,
    name: `Favorite ${i + 1}`,
    platform_id: "snes",
    sync_state: "synced",
  }));
}

function setViewportWidth(width) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
    writable: true,
  });
  act(() => {
    window.dispatchEvent(new Event("resize"));
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  setViewportWidth(1280);
});

function LibraryWrapper({
  initialIndex = 0,
  initialPlatform = null,
  initialSearch = "",
  onSelectGame,
  onSelectedIndexChange,
  onSelectedPlatformChange,
  onSearchChange,
  onOpenSettings,
  games,
  platforms = [],
  ...rest
}) {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [selectedPlatform, setSelectedPlatform] = useState(initialPlatform);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const handleChange = (next) => {
    setSelectedIndex(next);
    onSelectedIndexChange?.(next);
  };
  const handlePlatformChange = (next) => {
    setSelectedPlatform(next);
    setSelectedIndex(0);
    onSelectedIndexChange?.(0);
    onSelectedPlatformChange?.(next);
  };
  const handleSearchChange = (next) => {
    setSearchQuery(next);
    onSearchChange?.(next);
  };
  return (
    <ImmersiveLibrary
      loading={false}
      error={null}
      games={games}
      platforms={platforms}
      selectedPlatform={selectedPlatform}
      onSelectedPlatformChange={handlePlatformChange}
      searchQuery={searchQuery}
      onSearchChange={handleSearchChange}
      selectedIndex={selectedIndex}
      onSelectedIndexChange={handleChange}
      onSelectGame={onSelectGame}
      onExitImmersive={vi.fn()}
      onOpenSettings={onOpenSettings || vi.fn()}
      onOpenDownloads={vi.fn()}
      {...rest}
    />
  );
}

function renderLibrary(games = makeGames(12), props = {}) {
  const onSelectGame = vi.fn();
  const onSelectedIndexChange = vi.fn();
  const onSelectedPlatformChange = vi.fn();
  const onSearchChange = vi.fn();
  const onOpenSettings = vi.fn();
  const utils = render(
    <MuiTestProvider>
      <LibraryWrapper
        games={games}
        onSelectGame={onSelectGame}
        onSelectedIndexChange={onSelectedIndexChange}
        onSelectedPlatformChange={onSelectedPlatformChange}
        onSearchChange={onSearchChange}
        onOpenSettings={onOpenSettings}
        {...props}
      />
    </MuiTestProvider>
  );
  return {
    ...utils,
    onOpenSettings,
    onSearchChange,
    onSelectGame,
    onSelectedIndexChange,
    onSelectedPlatformChange,
  };
}

function keyDown(container, key) {
  act(() => {
    fireEvent.keyDown(container, { key });
  });
}

function controllerKeyDown(container, key) {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key,
  });
  attachControllerAction(event, {
    actionId: 21,
    controllerIndex: 4,
    deferred: false,
    elapsedSincePreviousMs: null,
    key,
    phase: "edge",
  });
  act(() => container.dispatchEvent(event));
}

describe("ImmersiveLibrary responsive grid", () => {
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
  function navigateTest(width, columns) {
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
  }

  it("navigates with 6 columns on wide screens", () => {
    navigateTest(1280, 6);
  });

  it("navigates with 4 columns on medium screens", () => {
    navigateTest(1000, 4);
  });

  it("navigates with 3 columns on small screens", () => {
    navigateTest(800, 3);
  });

  it("navigates with 2 columns on narrow screens", () => {
    navigateTest(500, 2);
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

    expect(info).toHaveBeenCalledWith(
      "[Wingosy][debug][controller] receiver handled",
      expect.objectContaining({
        actionId: 21,
        afterFocus: expect.objectContaining({ tag: "button", role: "button" }),
        beforeFocus: expect.objectContaining({ testId: "immersive-library" }),
        key: "ArrowRight",
        outcome: "handled",
        reason: "focus-moved",
        receiver: "library",
        targetFocus: expect.objectContaining({ tag: "div", index: "1" }),
      })
    );
  });
});

describe("ImmersiveLibrary sections switching", () => {
  it("switches sections and resets selection to zero", () => {
    const { onSelectedIndexChange } = renderLibrary(
      [...makeGames(4), ...makeFavoriteGames(2)],
      { initialIndex: 3 }
    );

    fireEvent.click(screen.getByRole("button", { name: "Favorites" }));
    expect(onSelectedIndexChange).toHaveBeenCalledWith(0);
    expect(screen.getByText("Favorite 1")).toBeInTheDocument();
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
  const platforms = [
    [{ id: "snes", name: "Super Nintendo", short_name: "SNES" }, 1],
    [{ id: "gba", name: "Game Boy Advance", short_name: "GBA" }, 2],
  ];
  const games = [
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

  it("offers display-named platform controls and selects or clears them", () => {
    const { onSelectedPlatformChange } = renderLibrary(games, { platforms });

    expect(
      screen.getByRole("button", { name: "All platforms" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Super Nintendo" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Game Boy Advance" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Game Boy Advance" }));
    expect(onSelectedPlatformChange).toHaveBeenCalledWith("gba");
    expect(screen.queryByText("SNES Game")).not.toBeInTheDocument();
    expect(screen.getByText("GBA Favorite")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "All platforms" }));
    expect(onSelectedPlatformChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByText("SNES Game")).toBeInTheDocument();
  });

  it("keeps platform filtering composed with favorites and recent sections", () => {
    renderLibrary(games, { initialPlatform: "gba", platforms });

    fireEvent.click(screen.getByRole("button", { name: "Favorites" }));
    expect(screen.getByText("GBA Favorite")).toBeInTheDocument();
    expect(screen.queryByText("SNES Game")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Recent" }));
    expect(screen.getByText("GBA Recent")).toBeInTheDocument();
    expect(screen.queryByText("SNES Game")).not.toBeInTheDocument();
  });

  it("moves between platform controls with arrows and activates one with Enter", () => {
    const { onSelectedPlatformChange } = renderLibrary(games, { platforms });
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
    const { onSelectedIndexChange } = renderLibrary(games, {
      initialIndex: 2,
      platforms,
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
  it("opens the selected game with Enter", () => {
    const games = makeGames(5);
    const { onSelectGame } = renderLibrary(games, { initialIndex: 2 });
    const root = screen.getByTestId("immersive-library");

    keyDown(root, "Enter");
    expect(onSelectGame).toHaveBeenCalledWith(games[2]);
  });
});

describe("ImmersiveLibrary game-name search", () => {
  it("provides an editable search control with a clear action", () => {
    const { onSearchChange } = renderLibrary();
    const search = screen.getByRole("textbox", {
      name: "Search games by name",
    });

    fireEvent.change(search, { target: { value: "mArIo" } });

    expect(search).toHaveValue("mArIo");
    expect(onSearchChange).toHaveBeenLastCalledWith("mArIo");
    expect(
      screen.getByRole("button", { name: "Clear game search" })
    ).toBeInTheDocument();

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
      expect(document.activeElement).toBe(search);
    });
    expect(onSelectedIndexChange).not.toHaveBeenCalled();
    expect(onSelectGame).not.toHaveBeenCalled();
    expect(onOpenSettings).not.toHaveBeenCalled();
    expect(screen.getByText("Game 1")).toBeInTheDocument();
    expect(info).toHaveBeenCalledWith(
      "[Wingosy][debug][controller] receiver suppressed",
      expect.objectContaining({
        actionId: 21,
        outcome: "suppressed",
        reason: "text-input-focused",
        receiver: "library",
      })
    );

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

  it("keeps name search composed with platform and library sections", () => {
    const games = [
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
    const platforms = [
      [{ id: "gba", name: "Game Boy Advance" }, 3],
      [{ id: "snes", name: "Super Nintendo" }, 1],
    ];

    renderLibrary(games, {
      initialPlatform: "gba",
      initialSearch: "mArIo",
      platforms,
    });

    expect(
      screen.getByRole("textbox", { name: "Search games by name" })
    ).toHaveValue("mArIo");
    expect(screen.getByText("Mario Favorite")).toBeInTheDocument();
    expect(screen.getByText("Mario Recent")).toBeInTheDocument();
    expect(screen.getByText("Mario Other")).toBeInTheDocument();
    expect(screen.queryByText("Mario SNES")).not.toBeInTheDocument();
    expect(screen.queryByText("Zelda Favorite")).not.toBeInTheDocument();
    expect(screen.queryByText("Zelda Recent")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Favorites" }));
    expect(screen.getByText("Mario Favorite")).toBeInTheDocument();
    expect(screen.queryByText("Mario Recent")).not.toBeInTheDocument();
    expect(screen.queryByText("Mario Other")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Recent" }));
    expect(screen.getByText("Mario Recent")).toBeInTheDocument();
    expect(screen.queryByText("Mario Favorite")).not.toBeInTheDocument();
    expect(screen.queryByText("Mario Other")).not.toBeInTheDocument();
    expect(screen.queryByText("Mario SNES")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear game search" }));

    expect(
      screen.getByRole("textbox", { name: "Search games by name" })
    ).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Game Boy Advance" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Zelda Recent")).toBeInTheDocument();
    expect(screen.getByText("Mario Recent")).toBeInTheDocument();
    expect(screen.queryByText("Mario Other")).not.toBeInTheDocument();
    expect(screen.queryByText("Mario SNES")).not.toBeInTheDocument();
  });
});
