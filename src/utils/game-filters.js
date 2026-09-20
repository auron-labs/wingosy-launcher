/** @typedef {"name"|"recent"|"play_time"|"play_count"|"release_year"|"last_played"} GameSortBy */
/** @typedef {"all"|"favorites"|"recent"|"downloaded"|"not_downloaded"} GameFilterBy */
/** @typedef {{source?: string|null, sync_state?: string|null, local_file_path?: string|null, is_favorite?: boolean, last_played_at?: string|Date|null, play_count?: number|null, play_time_minutes?: number|null, release_year?: number|null}} GameState */
/** @typedef {GameState & {id: number|string, name: string, platform_id: string}} Game */

/** @type {Array<{label: string, value: "name"|"recent"|"play_time"|"play_count"|"release_year"}>} */
export const GAME_SORT_OPTIONS = [
  { label: "Name", value: "name" },
  { label: "Recently played", value: "recent" },
  { label: "Play time", value: "play_time" },
  { label: "Most played", value: "play_count" },
  { label: "Release year", value: "release_year" },
];

/** @type {Array<{label: string, value: "all"|"favorites"|"recent"}>} */
export const GAME_FILTER_OPTIONS = [
  { label: "All games", value: "all" },
  { label: "Favorites", value: "favorites" },
  { label: "Recent", value: "recent" },
];

/** @type {Array<{label: string, value: "all"|"downloaded"|"not_downloaded"}>} */
export const GAME_AVAILABILITY_OPTIONS = [
  { label: "All games", value: "all" },
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
 * @param {GameState} game - Game to inspect.
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
  const value = game.play_time_minutes ?? Number.NaN;
  return Number.isFinite(value) ? value : null;
};

/** @param {Game} game - Game to inspect. */
const playCount = (game) => {
  const value = game.play_count ?? Number.NaN;
  return Number.isFinite(value) ? value : null;
};

/** @param {Game} game - Game to inspect. */
const releaseYear = (game) => {
  const value = game.release_year ?? Number.NaN;
  return Number.isFinite(value) ? value : null;
};

/** @param {number|null} left - First value. @param {number|null} right - Second value. @param {boolean} descending - Sort direction. */
const compareNullableNumbers = (left, right, descending) => {
  if (left === null) {
    return right === null ? 0 : 1;
  }
  if (right === null) {
    return -1;
  }
  return descending ? right - left : left - right;
};

/**
 * @param {Game[]} games - Games to sort.
 * @param {GameSortBy} [sortBy] - Sort mode.
 * @param {boolean} [descending] - Sort direction.
 */
export const sortGames = (
  games,
  sortBy = "name",
  descending = sortBy !== "name"
) =>
  games.toSorted((a, b) => {
    if (sortBy === "recent" || sortBy === "last_played") {
      return (
        compareNullableNumbers(
          lastPlayedTimestamp(a) === Number.NEGATIVE_INFINITY
            ? null
            : lastPlayedTimestamp(a),
          lastPlayedTimestamp(b) === Number.NEGATIVE_INFINITY
            ? null
            : lastPlayedTimestamp(b),
          descending
        ) || compareNames(a, b)
      );
    }

    if (sortBy === "play_time") {
      return (
        compareNullableNumbers(
          playTimeMinutes(a),
          playTimeMinutes(b),
          descending
        ) || compareNames(a, b)
      );
    }

    if (sortBy === "play_count") {
      return (
        compareNullableNumbers(playCount(a), playCount(b), descending) ||
        compareNames(a, b)
      );
    }

    if (sortBy === "release_year") {
      return (
        compareNullableNumbers(releaseYear(a), releaseYear(b), descending) ||
        compareNames(a, b)
      );
    }

    const nameOrder = compareNames(a, b);
    return descending ? -nameOrder : nameOrder;
  });

/**
 * @param {Game[]} games - Games to filter and sort.
 * @param {{platformId?: string|null, searchQuery?: string, filterBy?: GameFilterBy, availability?: GameFilterBy, sortBy?: GameSortBy, sortDescending?: boolean}} [options] - Filter and sort options.
 */
export const filterAndSortGames = (
  games,
  {
    platformId = null,
    searchQuery = "",
    filterBy = "all",
    availability = "all",
    sortBy = "name",
    sortDescending = sortBy !== "name",
  } = {}
) =>
  sortGames(
    filterVisibleGames(
      filterVisibleGames(games, platformId, searchQuery, filterBy),
      null,
      "",
      availability
    ),
    sortBy,
    sortDescending
  );
