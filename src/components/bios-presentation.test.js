import { describe, expect, it } from "vitest";

import {
  getBiosTotals,
  orderBiosGroupsByLibraryRelevance,
} from "./bios-presentation";

describe("BIOS presentation", () => {
  it("counts unavailable RomM files separately from downloadable files", () => {
    const totals = getBiosTotals([
      { is_downloaded: false, missing_from_fs: false },
      { is_downloaded: true, missing_from_fs: false },
      { is_downloaded: false, missing_from_fs: true },
    ]);

    expect(totals).toStrictEqual({
      available: 2,
      downloaded: 1,
      listed: 3,
      missing: 1,
      unavailable: 1,
    });
  });

  it("puts platforms used by the library before unrelated firmware", () => {
    const groups = [
      { items: [], name: "PlayStation 2", slug: "ps2" },
      { items: [], name: "Game Boy Advance", slug: "gba" },
      { items: [], name: "Nintendo Entertainment System", slug: "nes" },
    ];

    const ordered = orderBiosGroupsByLibraryRelevance(groups, [
      [{ id: "gba" }, 12],
      [{ id: "nes" }, 2],
    ]);

    expect(ordered.map((group) => group.slug)).toStrictEqual([
      "gba",
      "nes",
      "ps2",
    ]);
  });

  it("falls back to alphabetical platform order without library context", () => {
    const ordered = orderBiosGroupsByLibraryRelevance([
      { items: [], name: "PlayStation 2", slug: "ps2" },
      { items: [], name: "Sega Dreamcast", slug: "dreamcast" },
    ]);

    expect(ordered.map((group) => group.name)).toStrictEqual([
      "PlayStation 2",
      "Sega Dreamcast",
    ]);
  });
});
