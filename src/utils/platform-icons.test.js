import { describe, expect, it } from "vitest";

import {
  packIconId,
  platformBadgeLabel,
  platformIconSource,
  rommPlatformIconCandidates,
} from "./platform-icons";

describe(platformBadgeLabel, () => {
  it("uses known platform initials instead of truncating ids", () => {
    expect(platformBadgeLabel("xbox360")).toBe("360");
    expect(platformBadgeLabel("psvita")).toBe("Vita");
    expect(platformBadgeLabel("switch")).toBe("NS");
  });

  it("falls back to a compact uppercase id for unknown platforms", () => {
    expect(platformBadgeLabel("superrare")).toBe("SUPERR");
  });

  it("returns an empty label for missing platform ids", () => {
    expect(platformBadgeLabel("")).toBe("");
    expect(platformBadgeLabel(null)).toBe("");
  });
});

describe(platformIconSource, () => {
  it("prefers a supported platform's bundled glyph over RomM artwork", () => {
    expect(
      platformIconSource({
        id: "ps2",
        logo_path: " https://romm.test/assets/ps2.svg ",
        name: "PlayStation 2",
      })
    ).toStrictEqual({ kind: "bundled", value: "wingosy-console:playstation2" });
  });

  it("prefers a supported platform's short mark over RomM artwork", () => {
    expect(
      platformIconSource({
        id: "gba",
        logo_path: "https://romm.test/assets/gba.svg",
        name: "Game Boy Advance",
      })
    ).toStrictEqual({ kind: "initials", value: "GBA" });
  });

  it("uses readable initials for an unknown platform instead of logo_path", () => {
    expect(
      platformIconSource({
        id: "future-console",
        logo_path: " https://romm.test/assets/future.svg ",
        name: "Future Console",
      })
    ).toStrictEqual({ kind: "initials", value: "FC" });
  });

  it("does not use shared manufacturer glyphs for different consoles", () => {
    expect(packIconId("nes")).toBeNull();
    expect(packIconId("snes")).toBeNull();
    expect(packIconId("dreamcast")).toBeNull();
    expect(packIconId("xbox360")).toBeNull();
  });

  it("uses distinct short marks for consoles without a dedicated glyph", () => {
    expect(platformIconSource({ id: "nes", name: "Nintendo" })).toStrictEqual({
      kind: "initials",
      value: "NES",
    });
    expect(platformIconSource({ id: "dreamcast", name: "Sega" })).toStrictEqual(
      {
        kind: "initials",
        value: "DC",
      }
    );
    expect(platformIconSource({ id: "xbox360", name: "Xbox" })).toStrictEqual({
      kind: "initials",
      value: "360",
    });
  });
});

describe(rommPlatformIconCandidates, () => {
  it("matches RomM's SVG then ICO fallback order", () => {
    expect(
      rommPlatformIconCandidates("gba", " https://romm.test/ ")
    ).toStrictEqual([
      "https://romm.test/assets/platforms/gba.svg",
      "https://romm.test/assets/platforms/gba.ico",
    ]);
  });

  it("maps Wingosy ids to RomM asset slugs", () => {
    expect(rommPlatformIconCandidates("gc", "https://romm.test")[0]).toBe(
      "https://romm.test/assets/platforms/ngc.svg"
    );
    expect(
      rommPlatformIconCandidates("dreamcast", "https://romm.test")[0]
    ).toBe("https://romm.test/assets/platforms/dc.svg");
  });

  it("returns no remote candidates without a configured server", () => {
    expect(rommPlatformIconCandidates("gba", "")).toStrictEqual([]);
    expect(rommPlatformIconCandidates("", "https://romm.test")).toStrictEqual(
      []
    );
  });
});
