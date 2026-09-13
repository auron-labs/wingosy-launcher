import { cleanup, fireEvent, render, act } from "@testing-library/react";
import { vi } from "vitest";

import { MuiTestProvider } from "../test/mui-harness";
import { attachControllerAction } from "./controller-debug";
import { LibraryWrapper } from "./immersive-library-test-wrapper";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {import("./immersive-types").PlatformEntry} PlatformEntry */

/** @typedef {{initialIndex?: number, initialPlatform?: string|null, initialSearch?: string, onSelectGame?: (game: ImmersiveGame) => void, onSelectedIndexChange?: (index: number) => void, onSelectedPlatformChange?: (platform: string|null) => void, onSearchChange?: (query: string) => void, onOpenSettings?: () => void, games: ImmersiveGame[], platforms?: PlatformEntry[]}} LibraryWrapperProps */

/** @param {number} count Game count. @returns {ImmersiveGame[]} Games. */
export const makeGames = (count) =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    is_favorite: false,
    name: `Game ${i + 1}`,
    platform_id: "snes",
    sync_state: "synced",
  }));

/** @param {number} count Game count. @returns {ImmersiveGame[]} Games. */
export const makeFavoriteGames = (count) =>
  Array.from({ length: count }, (_, i) => ({
    id: 100 + i,
    is_favorite: true,
    name: `Favorite ${i + 1}`,
    platform_id: "snes",
    sync_state: "synced",
  }));

export const setViewportWidth = (width) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
    writable: true,
  });
  act(() => {
    window.dispatchEvent(new Event("resize"));
  });
};

/** @param {ImmersiveGame[]} [games] Games to render. @param {Omit<LibraryWrapperProps, "games">} [props] Wrapper overrides. */
export const renderLibrary = (games = makeGames(12), props = {}) => {
  const onSelectGame = vi.fn();
  const onSelectedIndexChange = vi.fn();
  const onSelectedPlatformChange = vi.fn();
  const onSearchChange = vi.fn();
  const onOpenSettings = vi.fn();
  const utils = render(
    <MuiTestProvider>
      <LibraryWrapper
        games={games}
        onSelectGame={(game) => {
          onSelectGame(game);
        }}
        onSelectedIndexChange={(index) => {
          onSelectedIndexChange(index);
        }}
        onSelectedPlatformChange={(platform) => {
          onSelectedPlatformChange(platform);
        }}
        onSearchChange={(query) => {
          onSearchChange(query);
        }}
        onOpenSettings={() => {
          onOpenSettings();
        }}
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
};

/** @param {HTMLElement} container Event target. @param {string} key Key name. */
export const keyDown = (container, key) => {
  act(() => {
    fireEvent.keyDown(container, { key });
  });
};

/** @param {HTMLElement} container Event target. @param {string} key Key name. */
export const controllerKeyDown = (container, key) => {
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
  void act(() => container.dispatchEvent(event));
};

/** Reset library DOM, viewport, and test spies. */
export const cleanupLibraryTest = () => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  setViewportWidth(1280);
};
