import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  parseImmersiveGame,
  parseImmersiveGamesPage,
} from "./immersive-data-parser";
import { useImmersiveModeLibrary } from "./use-immersive-mode-library";

const malformedGame = {
  genres: ["Action", 7, "", null, "Adventure"],
  id: 1,
  name: "Malformed metadata",
  platform_id: "gba",
  screenshot_paths: ["/screenshots/one.png", {}, "", null],
};

const noOpConfigLoaded = () => {
  // The parser boundary test does not need app configuration.
};
const noOpSetView = () => {
  // The parser boundary test does not navigate views.
};

describe("immersive data parser", () => {
  it("keeps only non-empty strings in game metadata lists", () => {
    const game = parseImmersiveGame(malformedGame);

    expect(game.genres).toStrictEqual(["Action", "Adventure"]);
    expect(game.screenshot_paths).toStrictEqual(["/screenshots/one.png"]);
  });

  it("normalizes every game before it enters a page result", () => {
    const page = parseImmersiveGamesPage({
      games: [malformedGame],
      total: 1,
    });

    expect(page.games[0]?.genres).toStrictEqual(["Action", "Adventure"]);
    expect(page.games[0]?.screenshot_paths).toStrictEqual([
      "/screenshots/one.png",
    ]);
  });

  it("normalizes page data before library rendering receives it", async () => {
    const ipc = {
      getGamesPage: vi.fn().mockResolvedValue({
        games: [malformedGame],
        total: 1,
      }),
      getImmersiveConfig: vi.fn().mockResolvedValue({}),
      getPlatformsWithGames: vi.fn().mockResolvedValue([]),
    };
    const { result } = renderHook(() =>
      useImmersiveModeLibrary({
        ipc,
        onConfigLoaded: noOpConfigLoaded,
        setView: noOpSetView,
        view: "library",
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBeFalsy();
    });
    expect(result.current.games[0]?.genres).toStrictEqual([
      "Action",
      "Adventure",
    ]);
    expect(result.current.games[0]?.screenshot_paths).toStrictEqual([
      "/screenshots/one.png",
    ]);
  });
});
