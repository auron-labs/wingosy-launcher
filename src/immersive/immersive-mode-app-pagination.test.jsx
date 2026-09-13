import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  createDeferred,
  immersivePlatforms,
  invoke,
  renderImmersiveModeApp,
  resetImmersiveModeTest,
  resolveDeferred,
} from "./immersive-mode-app-test-fixtures";

/** @param {number} page @param {string|null} [platformId] @param {string|null} [searchQuery] */
const expectPageRequest = (page, platformId = null, searchQuery = null) => {
  expect(invoke).toHaveBeenCalledWith("get_games_page", {
    page,
    pageSize: 60,
    platformId,
    searchQuery,
  });
};

const expectSelectedGame = (index, gameId) => {
  expect(screen.getByTestId("selected-index")).toHaveTextContent(String(index));
  expect(screen.getByTestId(`game-${gameId}`)).toHaveAttribute(
    "data-focused",
    "true"
  );
};

const expectNoPageRequest = (page) => {
  expect(invoke.mock.calls.some(([, args]) => args?.page === page)).toBeFalsy();
};

describe("ImmersiveModeApp initial pagination", () => {
  afterEach(resetImmersiveModeTest);

  it("loads bounded pages as controller selection reaches the end without duplicates or overfetching", async () => {
    const firstPage = Array.from({ length: 60 }, (_, index) => ({
      id: index + 1,
      name: `Game ${index + 1}`,
      platform_id: "gba",
    }));
    const secondPage = [{ id: 61, name: "Game 61", platform_id: "gba" }];
    const nextPage = createDeferred();
    const launch = createDeferred();

    invoke.mockImplementation(async (command, args = {}) => {
      if (command === "get_games_page") {
        if (args.page === 1) {
          return { games: firstPage, total: 61 };
        }
        if (args.page === 2) {
          return await nextPage.promise;
        }
        throw new Error(`unexpected page ${String(args.page)}`);
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
      expect(screen.getByTestId("game-60")).toBeInTheDocument();
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
        searchQuery: null,
      });
    });
    expect(
      invoke.mock.calls.filter(([command]) => command === "get_games_page")
    ).toHaveLength(2);
    expectPageRequest(1);

    resolveDeferred(nextPage, { games: secondPage, total: 61 });
    await waitFor(() => {
      expect(screen.getByTestId("game-61")).toBeInTheDocument();
    });
    fireEvent.keyDown(screen.getByTestId("immersive-library"), {
      key: "ArrowRight",
    });
    expectSelectedGame(60, 61);
    expectNoPageRequest(3);

    fireEvent.click(screen.getByTestId("game-61"));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    resolveDeferred(launch, { success: true });
    await waitFor(() => {
      expect(screen.getByTestId("details-game")).toHaveTextContent("Game 61");
    });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expectSelectedGame(60, 61);
    expectNoPageRequest(3);
  });
});

describe("ImmersiveModeApp refresh pagination", () => {
  afterEach(resetImmersiveModeTest);

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
    const launch = createDeferred();

    invoke.mockImplementation(async (command, args = {}) => {
      if (command === "get_games_page") {
        if (args.page === 1) {
          pageOneCalls += 1;
          return { games: firstPage, total: 73 };
        }
        if (args.page === 2) {
          pageTwoCalls += 1;
          return { games: secondPage, total: 73 };
        }
        if (args.page === 3) {
          pageThreeCalls += 1;
          return {
            games: [{ id: 73, name: "Game 73", platform_id: "gba" }],
            total: 73,
          };
        }
        throw new Error(`unexpected page ${String(args.page)}`);
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
      expect(screen.getByTestId("game-60")).toBeInTheDocument();
    });
    const library = screen.getByTestId("immersive-library");
    for (let index = 0; index < 59; index += 1) {
      fireEvent.keyDown(library, { key: "ArrowRight" });
    }
    await waitFor(() => {
      expect(screen.getByTestId("game-72")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("game-61"));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    launch.resolve({ success: true });
    await waitFor(() => {
      expect(pageOneCalls).toBe(2);
    });

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => {
      expect(pageThreeCalls).toBe(1);
    });
    expect(pageTwoCalls).toBe(1);
  });
});

describe("ImmersiveModeApp stale pagination", () => {
  afterEach(resetImmersiveModeTest);

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
    const stalePageRequest = createDeferred();
    const refresh = createDeferred();
    const replacementPageRequest = createDeferred();

    invoke.mockImplementation(async (command, args = {}) => {
      if (command === "get_games_page") {
        if (args.page === 1) {
          pageOneCalls += 1;
          if (pageOneCalls === 1) {
            return { games: firstPage, total: 61 };
          }
          return await refresh.promise;
        }
        if (args.page === 2) {
          pageTwoCalls += 1;
          if (pageTwoCalls === 1) {
            return await stalePageRequest.promise;
          }
          return await replacementPageRequest.promise;
        }
        throw new Error(`unexpected page ${String(args.page)}`);
      }
      if (command === "get_platforms_with_games") {
        return [];
      }
      if (command === "get_config") {
        return { display: { big_picture: true } };
      }
      if (command === "prepare_and_launch_game") {
        return { success: true };
      }
      return null;
    });

    renderImmersiveModeApp();
    await waitFor(() => {
      expect(screen.getByTestId("game-60")).toBeInTheDocument();
    });
    const library = screen.getByTestId("immersive-library");
    for (let index = 0; index < 59; index += 1) {
      fireEvent.keyDown(library, { key: "ArrowRight" });
    }
    fireEvent.click(screen.getByTestId("game-60"));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => {
      expect(pageOneCalls).toBe(2);
    });
    resolveDeferred(refresh, { games: firstPage, total: 61 });
    await waitFor(() => {
      expect(pageTwoCalls).toBe(2);
    });

    resolveDeferred(stalePageRequest, { games: stalePage, total: 61 });
    fireEvent.keyDown(screen.getByTestId("immersive-library"), {
      key: "ArrowLeft",
    });
    expect(pageTwoCalls).toBe(2);

    resolveDeferred(replacementPageRequest, { games: secondPage, total: 61 });
    await waitFor(() => {
      expect(screen.getByTestId("game-61")).toBeInTheDocument();
    });
    expect(screen.getAllByTestId("game-61")).toHaveLength(1);
    expect(screen.queryByTestId("game-999")).not.toBeInTheDocument();
    expectNoPageRequest(3);
  });
});

describe("ImmersiveModeApp platform pagination", () => {
  afterEach(resetImmersiveModeTest);

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
    const gbaSecondPage = [
      { id: 161, name: "GBA Game 61", platform_id: "gba" },
    ];
    const gbaSecondPageRequest = createDeferred();

    invoke.mockImplementation(async (command, args = {}) => {
      if (command === "get_games_page") {
        if (args.platformId === "gba" && args.page === 1) {
          return { games: gbaFirstPage, total: 61 };
        }
        if (args.platformId === "gba" && args.page === 2) {
          return await gbaSecondPageRequest.promise;
        }
        if (args.platformId === null && args.page === 1) {
          return { games: allGames, total: 60 };
        }
        throw new Error(`unexpected request ${JSON.stringify(args)}`);
      }
      if (command === "get_platforms_with_games") {
        return immersivePlatforms;
      }
      if (command === "get_config") {
        return { display: { big_picture: true } };
      }
      return null;
    });

    renderImmersiveModeApp();
    await waitFor(() => {
      expect(screen.getByText("All Game 1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Game Boy Advance" }));
    await waitFor(() => {
      expect(screen.getByText("GBA Game 60")).toBeInTheDocument();
    });

    const library = screen.getByTestId("immersive-library");
    for (let index = 0; index < 59; index += 1) {
      fireEvent.keyDown(library, { key: "ArrowRight" });
    }
    expectPageRequest(2, "gba");

    resolveDeferred(gbaSecondPageRequest, { games: gbaSecondPage, total: 61 });
    await waitFor(() => {
      expect(screen.getByTestId("game-161")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "All platforms" }));
    await waitFor(() => {
      expect(screen.getByText("All Game 1")).toBeInTheDocument();
    });
    expectPageRequest(1);
  });
});

describe("ImmersiveModeApp stale platform responses", () => {
  afterEach(resetImmersiveModeTest);

  it("ignores a stale platform response after a newer selection", async () => {
    const gbaRequest = createDeferred();
    const snesRequest = createDeferred();
    invoke.mockImplementation(async (command, args = {}) => {
      if (command === "get_games_page") {
        if (args.platformId === null) {
          return {
            games: [{ id: 1, name: "All Game", platform_id: "gba" }],
            total: 1,
          };
        }
        if (args.platformId === "gba") {
          return await gbaRequest.promise;
        }
        if (args.platformId === "snes") {
          return await snesRequest.promise;
        }
      }
      if (command === "get_platforms_with_games") {
        return immersivePlatforms;
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
    fireEvent.click(screen.getByRole("button", { name: "Game Boy Advance" }));
    fireEvent.click(screen.getByRole("button", { name: "Super Nintendo" }));

    resolveDeferred(gbaRequest, {
      games: [{ id: 2, name: "Stale GBA", platform_id: "gba" }],
      total: 1,
    });
    resolveDeferred(snesRequest, {
      games: [{ id: 3, name: "Current SNES", platform_id: "snes" }],
      total: 1,
    });

    await waitFor(() => {
      expect(screen.getByTestId("game-3")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("game-2")).not.toBeInTheDocument();
    expect(screen.getByTestId("selected-index")).toHaveTextContent("0");
  });
});
