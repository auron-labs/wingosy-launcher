/**
 * Sidebar: RomM platform artwork with a bundled console icon fallback
 * (`src/data/consoleIconSet.json`, Simple Icons-derived, CC0).
 * Regenerate: `bun add -d @iconify-json/simple-icons` then `bun scripts/extract-console-icons.mjs`.
 */

/** @type {Record<string, string>} */
export const PLATFORM_COLORS = {
  "3ds": "#d12228",
  arcade: "#ff6b00",
  default: "#6366f1",
  dreamcast: "#f47920",
  gb: "#8b956d",
  gba: "#6b5a9e",
  gbc: "#8b008b",
  gc: "#6a5acd",
  genesis: "#1a5c9b",
  n64: "#00a651",
  nds: "#b8b8b8",
  nes: "#e60012",
  pc: "#00bcf2",
  ps2: "#003087",
  ps3: "#003087",
  ps4: "#003087",
  ps5: "#003087",
  psp: "#003087",
  psvita: "#003087",
  psx: "#003087",
  saturn: "#0072c6",
  snes: "#7b5aa6",
  switch: "#e60012",
  wii: "#00a4e4",
  wiiu: "#009ac7",
  xbox: "#107c10",
  xbox360: "#107c10",
};

/** Short labels when no bundled icon and RomM logo missing or failed (clearer than slicing names). */
const PLATFORM_INITIALS = new Map(
  Object.entries({
    "3ds": "3DS",
    arcade: "ARC",
    dreamcast: "DC",
    gb: "GB",
    gba: "GBA",
    gbc: "GBC",
    gc: "GC",
    genesis: "MD",
    n64: "N64",
    nds: "DS",
    nes: "NES",
    pc: "PC",
    ps2: "PS2",
    ps3: "PS3",
    ps4: "PS4",
    ps5: "PS5",
    psp: "PSP",
    psvita: "Vita",
    psx: "PS1",
    saturn: "SAT",
    snes: "SNES",
    switch: "NS",
    wii: "Wii",
    wiiu: "Wii U",
    xbox: "XB",
    xbox360: "360",
  })
);

/**
 * Icon slug in `consoleIconSet.json` (Simple Icons names).
 *
 * Only use glyphs that identify one platform. Manufacturer marks such as
 * Nintendo, Sega, and Xbox are deliberately not shared across several systems:
 * a compact platform mark is less misleading than showing the same logo for
 * NES, SNES, N64, Game Boy, and DS.
 */
const PLATFORM_PACK_SLUG = new Map(
  Object.entries({
    "3ds": "nintendo3ds",
    arcade: "retroarch",
    gc: "nintendogamecube",
    pc: "windows",
    ps2: "playstation2",
    ps3: "playstation3",
    ps4: "playstation4",
    ps5: "playstation5",
    psp: "playstationportable",
    psvita: "playstationvita",
    psx: "playstation",
    switch: "nintendoswitch",
    xbox: "xbox",
  })
);

const PACK_PREFIX = "wingosy-console";

/** Wingosy ids that differ from RomM's platform asset filenames. */
const ROMM_PLATFORM_ASSET_SLUG = new Map(
  Object.entries({
    dreamcast: "dc",
    gc: "ngc",
  })
);

/**
 * RomM's platform component tries SVG first and then ICO. Return the same
 * candidates so Wingosy displays the console/device artwork from RomM rather
 * than the wide `logo_path` wordmarks returned by older API responses.
 * @param {string|null} [platformId] Wingosy platform identifier.
 * @param {string|null} [serverUrl] Configured RomM address.
 */
export const rommPlatformIconCandidates = (platformId, serverUrl) => {
  const id = platformId?.trim().toLowerCase() ?? "";
  const base = serverUrl?.trim().replace(/\/+$/u, "") ?? "";
  if (!id || !base) {
    return [];
  }

  const slug = ROMM_PLATFORM_ASSET_SLUG.get(id) ?? id;
  const encodedSlug = encodeURIComponent(slug);
  return [
    `${base}/assets/platforms/${encodedSlug}.svg`,
    `${base}/assets/platforms/${encodedSlug}.ico`,
  ];
};

/**
 * Iconify id for the bundled pack, or null if unknown.
 * @param {string} platformId Wingosy platform identifier.
 */
export const packIconId = (platformId) => {
  const slug = PLATFORM_PACK_SLUG.get(platformId);
  if (slug === undefined) {
    return null;
  }
  return `${PACK_PREFIX}:${slug}`;
};

/** @typedef {{id: string, name?: string|null, short_name?: string|null, logo_path?: string|null}} IconPlatform */

/** @param {IconPlatform} platform Platform needing a text label. */
export const platformInitials = (platform) => {
  const { id } = platform;
  const knownLabel = PLATFORM_INITIALS.get(id);
  if (knownLabel !== undefined) {
    return knownLabel;
  }
  const raw = (
    (platform.short_name ?? "") ||
    (platform.name ?? "") ||
    id
  ).trim();
  if (raw.length <= 4) {
    return raw.toUpperCase();
  }
  const parts = raw.split(/[\s-]+/u).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return raw.slice(0, 3).toUpperCase();
};

/**
 * Select a legible sidebar icon for a platform.
 *
 * This is the local fallback after RomM's square platform assets are exhausted.
 * Do not use `logo_path`: older RomM versions often return a wide, dark wordmark
 * there rather than the console/device artwork used by RomM's own platform list.
 * @param {IconPlatform} platform Platform needing an icon.
 */
export const platformIconSource = (platform) => {
  const bundledId = packIconId(platform.id);
  if (bundledId !== null) {
    return { kind: "bundled", value: bundledId };
  }

  return { kind: "initials", value: platformInitials(platform) };
};

/** @param {string|null} [platformId] Platform identifier shown on a game card. */
export const platformBadgeLabel = (platformId) => {
  if (platformId === null || platformId === undefined || platformId === "") {
    return "";
  }
  const knownLabel = PLATFORM_INITIALS.get(platformId);
  if (knownLabel !== undefined) {
    return knownLabel;
  }
  return platformId.toUpperCase().slice(0, 6);
};
