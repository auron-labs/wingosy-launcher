export const GAME_SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "recent", label: "Recently played" },
  { value: "play_time", label: "Play time" },
];

export const GAME_FILTER_OPTIONS = [
  { value: "all", label: "All games" },
  { value: "favorites", label: "Favorites" },
  { value: "recent", label: "Recent" },
  { value: "downloaded", label: "Downloaded" },
  { value: "not_downloaded", label: "Not downloaded" },
];

export function normalizeSyncState(value) {
  return (
    value?.toString().trim().replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase() || ""
  );
}

export function isGameDownloaded(game, { justDownloaded = false } = {}) {
  const hasLocalFile = justDownloaded || (
    typeof game?.local_file_path === "string" && game.local_file_path.trim()
  );
  const isLocalGame = game?.source && game.source !== "RomM";
  const isSynced = normalizeSyncState(game?.sync_state) === "synced";

  return Boolean(hasLocalFile || isLocalGame || isSynced);
}

export function filterVisibleGames(games, platformId, searchQuery, filterBy = "all") {
  const normalizedQuery = searchQuery?.trim().toLocaleLowerCase() || "";

  return games.filter((game) => {
    if (platformId && game.platform_id !== platformId) {
      return false;
    }

    if (normalizedQuery && !game.name?.toLocaleLowerCase().includes(normalizedQuery)) {
      return false;
    }

    if (filterBy === "favorites" && !game.is_favorite) {
      return false;
    }

    if (filterBy === "downloaded" && !isGameDownloaded(game)) {
      return false;
    }

    if (filterBy === "not_downloaded" && isGameDownloaded(game)) {
      return false;
    }

    if (filterBy === "recent" && !game.last_played_at) {
      return false;
    }

    return true;
  });
}

function lastPlayedTimestamp(game) {
  if (!game?.last_played_at) return Number.NEGATIVE_INFINITY;
  if (game.last_played_at instanceof Date) return game.last_played_at.getTime();

  const timestamp = Date.parse(game.last_played_at);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function compareNames(a, b) {
  return (a?.name || "").localeCompare(b?.name || "", undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

export function sortGames(games, sortBy = "name") {
  return [...games].sort((a, b) => {
    if (sortBy === "recent" || sortBy === "last_played") {
      return lastPlayedTimestamp(b) - lastPlayedTimestamp(a) || compareNames(a, b);
    }

    if (sortBy === "play_time") {
      return (Number(b?.play_time_minutes) || 0) - (Number(a?.play_time_minutes) || 0) || compareNames(a, b);
    }

    return compareNames(a, b);
  });
}

export function filterAndSortGames(
  games,
  { platformId = null, searchQuery = "", filterBy = "all", sortBy = "name" } = {},
) {
  return sortGames(filterVisibleGames(games, platformId, searchQuery, filterBy), sortBy);
}
