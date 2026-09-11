/** @typedef {"name"|"recent"|"play_time"|"last_played"} GameSortBy */
/** @typedef {"all"|"favorites"|"recent"|"downloaded"|"not_downloaded"} GameFilterBy */
/** @typedef {{id?: number|string, name?: string|null, platform_id?: string|null, source?: string|null, sync_state?: string|null, local_file_path?: string|null, is_favorite?: boolean, last_played_at?: string|Date|null, play_time_minutes?: number|null}} Game */

export const GAME_SORT_OPTIONS = [
  { label: "Name", value: "name" },
  { label: "Recently played", value: "recent" },
  { label: "Play time", value: "play_time" },
];

export const GAME_FILTER_OPTIONS = [
  { label: "All games", value: "all" },
  { label: "Favorites", value: "favorites" },
  { label: "Recent", value: "recent" },
  { label: "Downloaded", value: "downloaded" },
  { label: "Not downloaded", value: "not_downloaded" },
];

/**
 * @param {string|number|null|undefined} value - Sync state value.
 */
export const normalizeSyncState = (value) =>
  (value?.toString() ?? "")
    .trim()
    .replaceAll(/(?<lower>[a-z])(?<upper>[A-Z])/gu, "$<lower>_$<upper>")
    .toLowerCase();

/**
 * @param {Game} game - Game to inspect.
 * @param {{justDownloaded?: boolean}} [options] - Download state options.
 */
export const isGameDownloaded = (game, { justDownloaded = false } = {}) => {
  const hasLocalFile = justDownloaded || Boolean(game.local_file_path?.trim());
  const isLocalGame =
    game.source !== null &&
    game.source !== undefined &&
    game.source !== "" &&
    game.source !== "RomM";
  const isSynced = normalizeSyncState(game.sync_state) === "synced";

  return hasLocalFile || isLocalGame || isSynced;
};

/**
 * @param {Game} game - Game to inspect.
 * @param {GameFilterBy} filterBy - Filter mode.
 */
const matchesGameFilter = (game, filterBy) => {
  switch (filterBy) {
    case "favorites": {
      return game.is_favorite === true;
    }
    case "downloaded": {
      return isGameDownloaded(game);
    }
    case "not_downloaded": {
      return !isGameDownloaded(game);
    }
    case "recent": {
      return (
        game.last_played_at !== null &&
        game.last_played_at !== undefined &&
        game.last_played_at !== ""
      );
    }
    case "all": {
      return true;
    }
    default: {
      return true;
    }
  }
};

/**
 * @param {Game} game - Game to inspect.
 * @param {string} normalizedQuery - Lowercase search query.
 */
const matchesSearch = (game, normalizedQuery) =>
  normalizedQuery === "" ||
  (game.name ?? "").toLocaleLowerCase().includes(normalizedQuery);

/**
 * @param {Game[]} games - Games to filter.
 * @param {string|null} platformId - Optional platform identifier.
 * @param {string} searchQuery - Search text.
 * @param {GameFilterBy} [filterBy] - Optional local filter.
 */
export const filterVisibleGames = (
  games,
  platformId,
  searchQuery,
  filterBy = "all"
) => {
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

  return games.filter(
    (game) =>
      (platformId === null ||
        platformId === "" ||
        game.platform_id === platformId) &&
      matchesSearch(game, normalizedQuery) &&
      matchesGameFilter(game, filterBy)
  );
};

/** @param {Game} game - Game to inspect. */
const lastPlayedTimestamp = (game) => {
  const { last_played_at: lastPlayedAt } = game;
  if (
    lastPlayedAt === null ||
    lastPlayedAt === undefined ||
    lastPlayedAt === ""
  ) {
    return Number.NEGATIVE_INFINITY;
  }
  if (lastPlayedAt instanceof Date) {
    return lastPlayedAt.getTime();
  }

  const timestamp = Date.parse(lastPlayedAt);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
};

/**
 * @param {Game} a - First game.
 * @param {Game} b - Second game.
 */
const compareNames = (a, b) =>
  (a.name ?? "").localeCompare(b.name ?? "", undefined, {
    numeric: true,
    sensitivity: "base",
  });

/** @param {Game} game - Game to inspect. */
const playTimeMinutes = (game) => {
  const value = game.play_time_minutes ?? 0;
  return Number.isFinite(value) ? value : 0;
};

/**
 * @param {Game[]} games - Games to sort.
 * @param {GameSortBy} [sortBy] - Sort mode.
 */
export const sortGames = (games, sortBy = "name") =>
  games.toSorted((a, b) => {
    if (sortBy === "recent" || sortBy === "last_played") {
      return (
        lastPlayedTimestamp(b) - lastPlayedTimestamp(a) || compareNames(a, b)
      );
    }

    if (sortBy === "play_time") {
      return playTimeMinutes(b) - playTimeMinutes(a) || compareNames(a, b);
    }

    return compareNames(a, b);
  });

/**
 * @param {Game[]} games - Games to filter and sort.
 * @param {{platformId?: string|null, searchQuery?: string, filterBy?: GameFilterBy, sortBy?: GameSortBy}} [options] - Filter and sort options.
 */
export const filterAndSortGames = (
  games,
  {
    platformId = null,
    searchQuery = "",
    filterBy = "all",
    sortBy = "name",
  } = {}
) =>
  sortGames(
    filterVisibleGames(games, platformId, searchQuery, filterBy),
    sortBy
  );
