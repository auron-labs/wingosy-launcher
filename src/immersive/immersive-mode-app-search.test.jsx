import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  dispatchControllerKeyTo,
  initialGames,
  invoke,
  renderImmersiveModeApp,
  resetImmersiveModeTest,
  resolveDeferred,
} from "./immersive-mode-app-test-fixtures";

/** @param {string|null} searchQuery @param {string|null} [platformId] @param {number} [page] */
const expectSearchRequest = (searchQuery, platformId = null, page = 1) => {
  expect(invoke).toHaveBeenCalledWith("get_games_page", {
    page,
    pageSize: 60,
    platformId,
    searchQuery,
  });
};

/** @param {number} currentId @param {number|null} [staleId] */
const expectSearchState = (currentId, staleId = null) => {
  expect(screen.getByTestId(`game-${currentId}`)).toBeInTheDocument();
  if (staleId !== null) {
    expect(screen.queryByTestId(`game-${staleId}`)).not.toBeInTheDocument();
  }
  expect(screen.getByTestId("selected-index")).toHaveTextContent("0");
};

const expectClearedSearch = (search) => {
  expect(search).toHaveValue("");
  expectSearchRequest(null);
};

describe("ImmersiveModeApp name search", () => {
  afterEach(resetImmersiveModeTest);

  it("passes partial, case-insensitive name searches to the complete-library query and clears them", async () => {
    const marioResult = [
      { id: 3, name: "Super Mario World", platform_id: "snes" },
    ];
    invoke.mockImplementation((command, args = {}) => {
      if (command === "get_games_page") {
        if (args.searchQuery === "mAr") {
          return { games: marioResult, total: 1 };
        }
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
    const library = screen.getByTestId("immersive-library");
    fireEvent.keyDown(library, { key: "ArrowRight" });
    expect(screen.getByTestId("selected-index")).toHaveTextContent("1");

    const search = screen.getByRole("textbox", {
      name: "Search games by name",
    });
    search.focus();
    fireEvent.change(search, { target: { value: "mAr" } });

    await waitFor(() => {
      expect(screen.getByTestId("game-3")).toBeInTheDocument();
    });
    expectSearchState(3, 1);
    expectSearchRequest("mAr");
    expect(search).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Clear game search" }));
    await waitFor(() => {
      expect(screen.getByTestId("game-1")).toBeInTheDocument();
    });
    expectClearedSearch(search);
  });
});

describe("ImmersiveModeApp platform name search", () => {
  afterEach(resetImmersiveModeTest);

  it("keeps the active name query on selected-platform page requests", async () => {
    const marioGba = [{ id: 4, name: "Mario Advance", platform_id: "gba" }];
    invoke.mockImplementation((command, args = {}) => {
      if (command === "get_games_page") {
        if (args.searchQuery === "mario") {
          return { games: marioGba, total: 1 };
        }
        return { games: initialGames, total: initialGames.length };
      }
      if (command === "get_platforms_with_games") {
        return [
          [{ id: "gba", name: "Game Boy Advance" }, 61],
          [{ id: "snes", name: "Super Nintendo" }, 2],
        ];
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
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search games by name" }),
      {
        target: { value: "mario" },
      }
    );
    await waitFor(() => {
      expect(screen.queryByTestId("game-1")).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Game Boy Advance" }));

    await waitFor(() => {
      expect(screen.getByTestId("game-4")).toBeInTheDocument();
    });
    expectSearchRequest("mario", "gba");
    expect(screen.getByTestId("selected-index")).toHaveTextContent("0");
  });
});

describe("ImmersiveModeApp lazy name search", () => {
  afterEach(resetImmersiveModeTest);

  it("lazy-loads later pages using the active name query", async () => {
    const firstPage = Array.from({ length: 60 }, (_, index) => ({
      id: index + 10,
      name: `Mario Match ${index + 1}`,
      platform_id: "gba",
    }));
    const secondPage = [{ id: 70, name: "Mario Match 61", platform_id: "gba" }];
    const secondPageRequest = Promise.withResolvers();

    invoke.mockImplementation(async (command, args = {}) => {
      if (command === "get_games_page") {
        if (args.searchQuery === "mario" && args.page === 1) {
          return { games: firstPage, total: 61 };
        }
        if (args.searchQuery === "mario" && args.page === 2) {
          return await secondPageRequest.promise;
        }
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
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search games by name" }),
      {
        target: { value: "mario" },
      }
    );
    await waitFor(() => {
      expect(screen.getByTestId("game-69")).toBeInTheDocument();
    });

    const library = screen.getByTestId("immersive-library");
    for (let index = 0; index < 59; index += 1) {
      fireEvent.keyDown(library, { key: "ArrowRight" });
    }
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("get_games_page", {
        page: 2,
        pageSize: 60,
        platformId: null,
        searchQuery: "mario",
      });
    });
    resolveDeferred(secondPageRequest, { games: secondPage, total: 61 });
    await waitFor(() => {
      expect(screen.getByTestId("game-70")).toBeInTheDocument();
    });
  });
});

describe("ImmersiveModeApp stale filtered pages", () => {
  afterEach(resetImmersiveModeTest);

  it("does not append a stale filtered page after the search query changes", async () => {
    const oldFirstPage = Array.from({ length: 60 }, (_, index) => ({
      id: index + 100,
      name: `Old Match ${index + 1}`,
      platform_id: "gba",
    }));
    const oldSecondPage = [
      { id: 160, name: "Old Match 61", platform_id: "gba" },
    ];
    const newFirstPage = [{ id: 200, name: "New Match", platform_id: "gba" }];
    const oldSecondPageRequest = Promise.withResolvers();

    invoke.mockImplementation(async (command, args = {}) => {
      if (command === "get_games_page") {
        if (args.searchQuery === "old" && args.page === 1) {
          return { games: oldFirstPage, total: 61 };
        }
        if (args.searchQuery === "old" && args.page === 2) {
          return await oldSecondPageRequest.promise;
        }
        if (args.searchQuery === "new" && args.page === 1) {
          return { games: newFirstPage, total: 1 };
        }
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
    const search = screen.getByRole("textbox", {
      name: "Search games by name",
    });
    fireEvent.change(search, { target: { value: "old" } });
    await waitFor(() => {
      expect(screen.getByTestId("game-159")).toBeInTheDocument();
    });

    const library = screen.getByTestId("immersive-library");
    for (let index = 0; index < 59; index += 1) {
      fireEvent.keyDown(library, { key: "ArrowRight" });
    }
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("get_games_page", {
        page: 2,
        pageSize: 60,
        platformId: null,
        searchQuery: "old",
      });
    });

    fireEvent.change(search, { target: { value: "new" } });
    await waitFor(() => {
      expect(screen.getByTestId("game-200")).toBeInTheDocument();
    });
    expectSearchState(200, 159);

    resolveDeferred(oldSecondPageRequest, { games: oldSecondPage, total: 61 });
    expectSearchState(200, 160);
  });
});

describe("ImmersiveModeApp stale name queries", () => {
  afterEach(resetImmersiveModeTest);

  it("ignores an older name-query response after a newer query starts", async () => {
    const oldQuery = Promise.withResolvers();
    const newQuery = Promise.withResolvers();
    invoke.mockImplementation(async (command, args = {}) => {
      if (command === "get_games_page") {
        if (args.searchQuery === "old") {
          return await oldQuery.promise;
        }
        if (args.searchQuery === "new") {
          return await newQuery.promise;
        }
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
    const search = screen.getByRole("textbox", {
      name: "Search games by name",
    });
    fireEvent.change(search, { target: { value: "old" } });
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("get_games_page", {
        page: 1,
        pageSize: 60,
        platformId: null,
        searchQuery: "old",
      });
    });
    fireEvent.change(search, { target: { value: "new" } });
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("get_games_page", {
        page: 1,
        pageSize: 60,
        platformId: null,
        searchQuery: "new",
      });
    });

    resolveDeferred(newQuery, {
      games: [{ id: 8, name: "New Result", platform_id: "gba" }],
      total: 1,
    });
    await waitFor(() => {
      expect(screen.getByTestId("game-8")).toBeInTheDocument();
    });
    resolveDeferred(oldQuery, {
      games: [{ id: 9, name: "Old Result", platform_id: "gba" }],
      total: 1,
    });
    expectSearchState(8, 9);
  });
});

describe("ImmersiveModeApp search shortcuts", () => {
  afterEach(resetImmersiveModeTest);

  it("suppresses immersive shell shortcuts while the game-name search is focused", async () => {
    const onExit = vi.fn();
    invoke.mockImplementation((command) => {
      if (command === "get_games_page") {
        return { games: initialGames, total: 2 };
      }
      if (command === "get_platforms_with_games") {
        return [];
      }
      if (command === "get_config") {
        return { display: { big_picture: true } };
      }
      return null;
    });

    renderImmersiveModeApp({ onExit });
    await waitFor(() => {
      expect(screen.getByTestId("game-1")).toBeInTheDocument();
    });
    const search = screen.getByRole("textbox", {
      name: "Search games by name",
    });
    search.focus();
    dispatchControllerKeyTo(search, "h", {
      action: {
        actionId: 51,
        controllerIndex: 1,
        deferred: false,
        elapsedSincePreviousMs: null,
        key: "h",
        phase: "edge",
      },
    });
    dispatchControllerKeyTo(search, "Escape", {
      action: {
        actionId: 52,
        controllerIndex: 1,
        deferred: false,
        elapsedSincePreviousMs: null,
        key: "Escape",
        phase: "edge",
      },
    });
    dispatchControllerKeyTo(search, "F11", {
      action: {
        actionId: 53,
        controllerIndex: 1,
        deferred: false,
        elapsedSincePreviousMs: null,
        key: "F11",
        phase: "edge",
      },
    });

    expect(screen.getByTestId("immersive-hints")).toHaveTextContent("true");
    expect(onExit).not.toHaveBeenCalled();
    expect(search).not.toHaveFocus();
  });
});
