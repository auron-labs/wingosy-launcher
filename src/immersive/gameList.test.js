import { describe, expect, it } from "vitest";
import { dedupeGames } from "./gameList";

describe("dedupeGames", () => {
  it("keeps one tile for repeated games on the same platform", () => {
    const first = { id: 1, name: "Bonk's Adventure", platform_id: "nes" };
    const duplicate = { id: 2, name: "  BONK'S   ADVENTURE ", platform_id: "NES" };

    expect(dedupeGames([first, duplicate])).toEqual([first]);
  });

  it("keeps same-named games when they belong to different platforms", () => {
    const nesGame = { id: 1, name: "Tetris", platform_id: "nes" };
    const gameBoyGame = { id: 2, name: "Tetris", platform_id: "gb" };

    expect(dedupeGames([nesGame, gameBoyGame])).toEqual([nesGame, gameBoyGame]);
  });

  it("still collapses repeated record ids when metadata differs", () => {
    const first = { id: 1, name: "Original Name", platform_id: "nes" };
    const refreshed = { id: 1, name: "Updated Name", platform_id: "snes" };

    expect(dedupeGames([first, refreshed])).toEqual([first]);
  });
});
