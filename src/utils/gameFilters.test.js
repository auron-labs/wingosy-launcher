import { describe, expect, it } from "vitest";

import {
  filterAndSortGames,
  filterVisibleGames,
  isGameDownloaded,
  normalizeSyncState,
  sortGames,
} from "./gameFilters";

const games = [
  {
    id: 1,
    last_played_at: "2026-08-01T12:00:00Z",
    local_file_path: "/roms/mario.nsp",
    name: "Super Mario Odyssey",
    platform_id: "switch",
    play_time_minutes: 90,
    source: "RomM",
  },
  {
    id: 2,
    is_favorite: true,
    last_played_at: "2026-08-10T12:00:00Z",
    name: "Pokémon Scarlet",
    platform_id: "switch",
    play_time_minutes: 30,
    source: "RomM",
  },
  {
    id: 3,
    name: "Pokémon Pinball",
    platform_id: "gba",
    play_time_minutes: 240,
    source: "Local",
  },
  {
    id: 4,
    last_played_at: "2026-07-01T12:00:00Z",
    name: "Pokémon White",
    platform_id: "nds",
    play_time_minutes: 10,
    source: "RomM",
  },
];

describe(filterVisibleGames, () => {
  it("shows only games from the selected platform", () => {
    expect(filterVisibleGames(games, "switch", "")).toStrictEqual([
      games[0],
      games[1],
    ]);
  });

  it("combines platform and case-insensitive search filters", () => {
    expect(filterVisibleGames(games, "switch", "POKÉMON")).toStrictEqual([
      games[1],
    ]);
  });

  it("returns every game when no filters are active", () => {
    expect(filterVisibleGames(games, null, "")).toStrictEqual(games);
  });

  it("filters favorites and downloaded status", () => {
    expect(filterVisibleGames(games, null, "", "favorites")).toStrictEqual([
      games[1],
    ]);
    expect(filterVisibleGames(games, null, "", "downloaded")).toStrictEqual([
      games[0],
      games[2],
    ]);
    expect(filterVisibleGames(games, null, "", "not_downloaded")).toStrictEqual(
      [games[1], games[3]]
    );
  });
});

describe("downloaded game state", () => {
  it("normalizes sync state casing and whitespace for the shared predicate", () => {
    expect(normalizeSyncState("  RemoteOnly ")).toBe("remote_only");
    expect(
      isGameDownloaded({ source: "RomM", sync_state: " Synced " })
    ).toBeTruthy();
    expect(
      isGameDownloaded({ local_file_path: "   ", source: "RomM" })
    ).toBeFalsy();
  });

  it("includes a just-downloaded game before the library refreshes", () => {
    expect(
      isGameDownloaded({ source: "RomM" }, { justDownloaded: true })
    ).toBeTruthy();
  });
});

describe(sortGames, () => {
  it("sorts names alphabetically without changing the input", () => {
    expect(sortGames(games, "name").map((game) => game.id)).toStrictEqual([
      3, 2, 4, 1,
    ]);
    expect(games.map((game) => game.id)).toStrictEqual([1, 2, 3, 4]);
  });

  it("puts recently played games first and unplayed games last", () => {
    expect(sortGames(games, "recent").map((game) => game.id)).toStrictEqual([
      2, 1, 4, 3,
    ]);
  });

  it("sorts by total play time descending", () => {
    expect(sortGames(games, "play_time").map((game) => game.id)).toStrictEqual([
      3, 1, 2, 4,
    ]);
  });
});

describe(filterAndSortGames, () => {
  it("applies the selected filter before sorting", () => {
    expect(
      filterAndSortGames(games, {
        filterBy: "favorites",
        platformId: "switch",
        searchQuery: "pokémon",
        sortBy: "recent",
      })
    ).toStrictEqual([games[1]]);
  });
});
