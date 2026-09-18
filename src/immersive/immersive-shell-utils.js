import { convertFileSrc } from "@tauri-apps/api/core";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {import("./immersive-types").PlatformEntry} PlatformEntry */
/** @typedef {{id: string|null, label: string, subtitle?: string|null}} SpinePlatformOption */

export const IMMERSIVE_SPINE_WIDTH = "clamp(208px, 19%, 296px)";
export const IMMERSIVE_ACCENT_GLOW = "rgba(129, 140, 248, 0.55)";
export const IMMERSIVE_TITLE_FONT =
  "'Playfair Display', Georgia, 'Times New Roman', serif";

/** @param {string|null|undefined} path Candidate local path. @returns {boolean} Whether the path is local. */
const isLocalPath = (path) => {
  if (path === null || path === undefined || path === "") {
    return false;
  }
  return (
    /^[a-zA-Z]:/u.test(path) || path.startsWith("\\") || path.startsWith("/")
  );
};

/** @param {string|null|undefined} coverPath Cover path returned by the backend. @returns {string|null} Resolved cover source. */
export const getImmersiveCoverSrc = (coverPath) => {
  if (coverPath === null || coverPath === undefined || coverPath === "") {
    return null;
  }
  return isLocalPath(coverPath) ? convertFileSrc(coverPath) : coverPath;
};

/** @param {ImmersiveGame} game Game metadata. @returns {boolean} Whether the game is installed locally. */
export const isImmersiveInstalled = (game) => {
  const localPath =
    "local_file_path" in game ? game.local_file_path : undefined;
  if (localPath !== null && localPath !== undefined && localPath !== "") {
    return true;
  }
  return game.sync_state === "synced" || game.sync_state === "Synced";
};

/** @param {ImmersiveGame} game Game metadata. @returns {number|null} Release year when available. */
export const getImmersiveYear = (game) => {
  const raw = "release_year" in game ? game.release_year : null;
  if (raw === null || raw === undefined) {
    return null;
  }
  const year = Number(raw);
  return Number.isInteger(year) ? year : null;
};

/** @param {PlatformEntry[]} platforms Available platform entries. @returns {SpinePlatformOption[]} Spine platform options. */
export const toSpinePlatformOptions = (platforms) => [
  { id: null, label: "All platforms" },
  ...platforms.map(([platform]) => ({
    id: platform.id,
    label: platform.name === "" ? platform.id : platform.name,
  })),
];

/** @param {ImmersiveGame} game Game metadata. @returns {string[]} Genre labels when available. */
export const getImmersiveGenres = (game) => game.genres ?? [];

/** @param {number} value Position value. @returns {string} Zero-padded position. */
export const formatImmersivePosition = (value) =>
  String(value).padStart(2, "0");
