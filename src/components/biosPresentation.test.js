import { describe, expect, it } from "vitest";
import { getBiosTotals, orderBiosGroupsByLibraryRelevance } from "./biosPresentation";

describe("BIOS presentation", () => {
  it("counts unavailable RomM files separately from downloadable files", () => {
    const totals = getBiosTotals([
      { is_downloaded: false, missing_from_fs: false },
      { is_downloaded: true, missing_from_fs: false },
      { is_downloaded: false, missing_from_fs: true },
    ]);

    expect(totals).toEqual({
      listed: 3,
      available: 2,
      downloaded: 1,
      missing: 1,
      unavailable: 1,
    });
  });

  it("puts platforms used by the library before unrelated firmware", () => {
    const groups = [
      { slug: "ps2", name: "PlayStation 2" },
      { slug: "gba", name: "Game Boy Advance" },
      { slug: "nes", name: "Nintendo Entertainment System" },
    ];

    const ordered = orderBiosGroupsByLibraryRelevance(groups, [
      [{ id: "gba" }, 12],
      [{ id: "nes" }, 2],
    ]);

    expect(ordered.map((group) => group.slug)).toEqual(["gba", "nes", "ps2"]);
  });

  it("falls back to alphabetical platform order without library context", () => {
    const ordered = orderBiosGroupsByLibraryRelevance([
      { slug: "ps2", name: "PlayStation 2" },
      { slug: "dreamcast", name: "Sega Dreamcast" },
    ]);

    expect(ordered.map((group) => group.name)).toEqual(["PlayStation 2", "Sega Dreamcast"]);
  });
});
