import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import ImmersiveLibrary from "./ImmersiveLibrary";
import { MuiTestProvider } from "../test/muiHarness";
import { attachControllerAction } from "./controllerDebug";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  convertFileSrc: (path) => path,
}));

vi.mock("../RomDownloadsContext", () => ({
  useRomDownloads: () => ({ getProgress: () => null, activeCount: 0 }),
}));

vi.mock("../ThemeContext", () => ({
  useAppTheme: () => ({
    colors: {
      primary: "#5C6BC0",
      primaryLight: "#8E99F3",
      focusGlow: "rgba(92,107,192,0.4)",
    },
  }),
}));

function makeGames(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Game ${i + 1}`,
    platform_id: "snes",
    is_favorite: false,
    sync_state: "synced",
  }));
}

function makeFavoriteGames(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: 100 + i,
    name: `Favorite ${i + 1}`,
    platform_id: "snes",
    is_favorite: true,
    sync_state: "synced",
  }));
}

function setViewportWidth(width) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
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
  onSelectGame,
  onSelectedIndexChange,
  games,
  ...rest
}) {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const handleChange = (next) => {
    setSelectedIndex(next);
    onSelectedIndexChange?.(next);
  };
  return (
    <ImmersiveLibrary
      loading={false}
      error={null}
      games={games}
      selectedIndex={selectedIndex}
      onSelectedIndexChange={handleChange}
      onSelectGame={onSelectGame}
      onExitImmersive={vi.fn()}
      onOpenSettings={vi.fn()}
      onOpenDownloads={vi.fn()}
      {...rest}
    />
  );
}

function renderLibrary(games = makeGames(12), props = {}) {
  const onSelectGame = vi.fn();
  const onSelectedIndexChange = vi.fn();
  const utils = render(
    <MuiTestProvider>
      <LibraryWrapper
        games={games}
        onSelectGame={onSelectGame}
        onSelectedIndexChange={onSelectedIndexChange}
        {...props}
      />
    </MuiTestProvider>
  );
  return { ...utils, onSelectGame, onSelectedIndexChange };
}

function keyDown(container, key) {
  act(() => {
    fireEvent.keyDown(container, { key });
  });
}

function controllerKeyDown(container, key) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  });
  attachControllerAction(event, {
    actionId: 21,
    key,
    controllerIndex: 4,
    phase: "edge",
    elapsedSincePreviousMs: null,
    deferred: false,
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
    expect(grid).toHaveStyle({ gridTemplateColumns: `repeat(${expected}, minmax(0, 1fr))` });
  });
});

describe("ImmersiveLibrary keyboard navigation", () => {
  function navigateTest(width, columns) {
    setViewportWidth(width);
    const { onSelectedIndexChange } = renderLibrary(makeGames(20), { initialIndex: 0 });
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

  it("navigates with 6 columns on wide screens", () => navigateTest(1280, 6));
  it("navigates with 4 columns on medium screens", () => navigateTest(1000, 4));
  it("navigates with 3 columns on small screens", () => navigateTest(800, 3));
  it("navigates with 2 columns on narrow screens", () => navigateTest(500, 2));

  it("handles partial final rows", () => {
    setViewportWidth(800);
    const { onSelectedIndexChange } = renderLibrary(makeGames(7), { initialIndex: 4 });
    const root = screen.getByTestId("immersive-library");

    keyDown(root, "ArrowDown");
    expect(onSelectedIndexChange).toHaveBeenLastCalledWith(6);

    onSelectedIndexChange.mockClear();
    keyDown(root, "ArrowRight");
    expect(onSelectedIndexChange).not.toHaveBeenCalled();
  });

  it("handles libraries smaller than one row", () => {
    setViewportWidth(1280);
    const { onSelectedIndexChange } = renderLibrary(makeGames(2), { initialIndex: 0 });
    const root = screen.getByTestId("immersive-library");

    keyDown(root, "ArrowDown");
    expect(onSelectedIndexChange).toHaveBeenLastCalledWith(1);

    onSelectedIndexChange.mockClear();
    keyDown(root, "ArrowRight");
    expect(onSelectedIndexChange).not.toHaveBeenCalled();
  });

  it("logs correlated focus descriptors when a navigation target cannot take focus", () => {
    vi.stubEnv("VITE_WINGOSY_DEBUG", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    renderLibrary(makeGames(3));
    const root = screen.getByTestId("immersive-library");
    root.focus();

    controllerKeyDown(root, "ArrowRight");

    expect(info).toHaveBeenCalledWith(
      "[Wingosy][debug][controller] receiver ignored",
      expect.objectContaining({
        actionId: 21,
        receiver: "library",
        key: "ArrowRight",
        outcome: "ignored",
        reason: "focus-target-not-focused",
        beforeFocus: expect.objectContaining({ testId: "immersive-library" }),
        afterFocus: expect.objectContaining({ testId: "immersive-library" }),
        targetFocus: expect.objectContaining({ tag: "div", index: "1" }),
      }),
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
    expect(screen.getByRole("button", { name: "Favorites" })).toBeInTheDocument();
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
