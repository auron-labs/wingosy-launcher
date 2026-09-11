import { useCallback, useEffect, useRef, useState } from "react";

import { getLaunchErrorPresentation } from "../immersive/launchError";
import { filterAndSortGames } from "../utils/gameFilters";
import { isText } from "../utils/value-guards";

/** @typedef {{getCurrentWindow: () => {isFullscreen: () => Promise<boolean>, onResized: (handler: () => void) => Promise<() => void>, startDragging: () => Promise<void>}, invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>, listen: (event: string, handler: (event: {payload?: unknown}) => void) => Promise<() => void>, openUrl: (url: string) => Promise<unknown>}} AppRuntime */
/** @typedef {{id: number|string, name: string, platform_id?: string, cover_path?: string|null, local_file_path?: string|null, source?: string, romm_id?: number|null, is_favorite?: boolean, last_played_at?: string|null, play_time_minutes?: number|null}} AppGame */
/** @typedef {{id: string|number, name: string}} AppPlatform */
/** @typedef {{gameId: number|string, guidance: string, message: string, retryable: boolean}} AppLaunchError */
/** @typedef {"name"|"recent"|"play_time"} AppSortBy */
/** @typedef {"all"|"favorites"|"recent"|"downloaded"|"not_downloaded"} AppFilterBy */
/** @typedef {{games: AppGame[], total: number}} GamePage */
/** @typedef {{success?: boolean, error?: string|{message?: string}, dry_run?: boolean, save_sync_messages?: unknown, save_sync_warnings?: unknown}} LaunchResult */

const GAMES_PER_PAGE = 60;

/** @param {unknown} error - Error value from an IPC boundary. */
const getErrorMessage = (error) =>
  isText(error)
    ? error
    : error instanceof Error
      ? error.message
      : String(error);

/** @param {{platformId: string|null, query: string, requestedPage: number, requestedSortBy: AppSortBy, requestedFilterBy: AppFilterBy, runtime: AppRuntime}} options - Library query dependencies. */
const fetchGames = async ({
  runtime,
  platformId,
  query,
  requestedPage,
  requestedSortBy,
  requestedFilterBy,
}) => {
  const usesClientPage =
    requestedSortBy !== "name" || requestedFilterBy !== "all";
  if (usesClientPage) {
    /** @type {AppGame[]} */
    const games = await runtime.invoke("get_games_filtered", {
      favoritesOnly: requestedFilterBy === "favorites",
      platformId,
      searchQuery: query || null,
      sortBy: requestedSortBy === "recent" ? "last_played" : requestedSortBy,
    });
    const visibleGames = filterAndSortGames(games, {
      filterBy: requestedFilterBy,
      platformId,
      searchQuery: query,
      sortBy: requestedSortBy,
    });
    return { games: visibleGames, total: visibleGames.length };
  }
  /** @type {GamePage} */
  const result = await runtime.invoke("get_games_page", {
    page: requestedPage,
    pageSize: GAMES_PER_PAGE,
    platformId,
    searchQuery: query || null,
  });
  return result;
};

/** @param {[AppPlatform, number][]} platforms - Loaded platform entries. @param {AppGame[]} games - Loaded games. @param {number|string} gameId - Target game identifier. */
const getPlatformLabel = (platforms, games, gameId) => {
  const game = games.find((item) => item.id === gameId);
  return platforms.find(([platform]) => platform.id === game?.platform_id)?.[0]
    ?.name;
};

/** @type {AppGame[]} */
const EMPTY_GAMES = [];

/** @returns {string|null} */
const initialSelectedPlatform = () => null;

/** @returns {AppGame|null} */
const initialSelectedGame = () => null;

/** @returns {AppSortBy} */
const initialSort = () => "name";

/** @returns {AppFilterBy} */
const initialFilter = () => "all";

/** @returns {AppLaunchError|null} */
const initialLaunchError = () => null;

/** @param {{gameId: number|string, games: AppGame[], platforms: [AppPlatform, number][], result: LaunchResult, setError: (message: string|null) => void, setLibraryLaunchError: (error: AppLaunchError|null) => void}} options - Launch result dependencies. */

/** @param {{runtime: AppRuntime, showSetup: boolean|null, platforms: [AppPlatform, number][], loadData: () => Promise<void>, setError: (message: string|null) => void}} options - Library dependencies. */
export const useAppLibrary = ({
  runtime,
  showSetup,
  platforms,
  loadData,
  setError,
}) => {
  const [games, setGames] = useState(EMPTY_GAMES);
  const [gameTotal, setGameTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedPlatform, setSelectedPlatform] = useState(
    initialSelectedPlatform
  );
  const [selectedGame, setSelectedGame] = useState(initialSelectedGame);
  const [view, setView] = useState("library");
  const [settingsInitialSection, setSettingsInitialSection] =
    useState("general");
  const [searchQuery, setSearchQuery] = useState("");
  const [librarySortBy, setLibrarySortBy] = useState(initialSort);
  const [libraryFilterBy, setLibraryFilterBy] = useState(initialFilter);
  const [loading, setLoading] = useState(true);
  const [saveSyncMessages, setSaveSyncMessages] = useState([]);
  const [libraryLaunchError, setLibraryLaunchError] =
    useState(initialLaunchError);
  const gamesRequestId = useRef(0);
  const launchInFlightRef = useRef(new Set());
  const libraryScrollRef = useRef(null);

  const refreshGames = useCallback(
    async (
      platformId = selectedPlatform,
      query = searchQuery,
      requestedPage = page,
      requestedSortBy = librarySortBy,
      requestedFilterBy = libraryFilterBy
    ) => {
      const requestId = gamesRequestId.current + 1;
      gamesRequestId.current = requestId;
      setLoading(true);
      try {
        const result = await fetchGames({
          platformId,
          query,
          requestedFilterBy,
          requestedPage,
          requestedSortBy,
          runtime,
        });
        if (requestId !== gamesRequestId.current) {
          return;
        }
        const resultTotal = result.total;
        const lastPage = Math.max(1, Math.ceil(resultTotal / GAMES_PER_PAGE));
        if (requestedPage > lastPage) {
          setPage(lastPage);
          return;
        }
        const firstGame = (requestedPage - 1) * GAMES_PER_PAGE;
        setGames(result.games.slice(firstGame, requestedPage * GAMES_PER_PAGE));
        setGameTotal(resultTotal);
        setSelectedGame((current) => {
          if (!current) {
            return current;
          }
          return result.games.find((game) => game.id === current.id) ?? current;
        });
      } catch (error) {
        console.error("Failed to refresh games:", error);
      } finally {
        if (requestId === gamesRequestId.current) {
          setLoading(false);
        }
      }
    },
    [
      libraryFilterBy,
      librarySortBy,
      page,
      runtime,
      searchQuery,
      selectedPlatform,
    ]
  );

  useEffect(() => {
    if (showSetup === false) {
      void refreshGames(selectedPlatform, searchQuery, page);
    }
  }, [page, refreshGames, searchQuery, selectedPlatform, showSetup]);

  const reloadLibrary = useCallback(async () => {
    await Promise.all([loadData(), refreshGames()]);
  }, [loadData, refreshGames]);

  const handleToggleFavorite = useCallback(
    async (gameId) => {
      try {
        const newState = await runtime.invoke("toggle_favorite", { gameId });
        setGames((current) =>
          current.map((game) =>
            game.id === gameId
              ? { ...game, is_favorite: newState === true }
              : game
          )
        );
        setSelectedGame((current) =>
          current?.id === gameId
            ? { ...current, is_favorite: newState === true }
            : current
        );
      } catch (error) {
        setError(getErrorMessage(error));
      }
    },
    [runtime, setError]
  );

  /** @param {number|string} gameId - Game to launch. */
  const handleLaunchGame = useCallback(
    async (gameId) => {
      if (launchInFlightRef.current.has(gameId)) {
        return null;
      }
      launchInFlightRef.current.add(gameId);
      try {
        /** @type {LaunchResult} */
        const result = await runtime.invoke("prepare_and_launch_game", {
          gameId,
        });
        const messages = Array.isArray(result.save_sync_messages)
          ? result.save_sync_messages.filter(
              (message) => isText(message) && message.trim() !== ""
            )
          : [];
        setSaveSyncMessages(messages);
        updateLaunchStatus({
          gameId,
          games,
          platforms,
          result,
          setError,
          setLibraryLaunchError,
        });
        if (result.dry_run !== true) {
          await refreshGames();
        }
        return result;
      } catch (error) {
        const platformLabel = getPlatformLabel(platforms, games, gameId);
        const presentation = getLaunchErrorPresentation(
          getErrorMessage(error),
          platformLabel
        );
        setLibraryLaunchError({ gameId, ...presentation });
        setError(presentation.message);
        setSaveSyncMessages([]);
        return null;
      } finally {
        launchInFlightRef.current.delete(gameId);
      }
    },
    [games, platforms, refreshGames, runtime, setError]
  );

  /** @param {number|string} gameId - Game whose details changed. */
  const handleGameUpdate = useCallback(
    async (gameId) => {
      try {
        /** @type {AppGame} */
        const updated = await runtime.invoke("get_game_details", { gameId });
        setSelectedGame(updated);
        setGames((current) =>
          current.map((game) => (game.id === gameId ? updated : game))
        );
      } catch (error) {
        console.error("Failed to refresh after download:", error);
      }
    },
    [runtime]
  );

  /** @param {AppGame} game - Game selected from the library. */
  const handleSelectGame = useCallback((game) => {
    setSelectedGame(game);
    setView("details");
  }, []);

  /** @param {string|null} platformId - Platform selected in the sidebar. */
  const handleSelectPlatform = useCallback((platformId) => {
    setPage(1);
    setSelectedPlatform(platformId);
    setLibraryFilterBy("all");
    setView("library");
    setSelectedGame(null);
  }, []);

  /** @param {string} query - Current search text. */
  const handleSearchChange = useCallback((query) => {
    setPage(1);
    setSearchQuery(query);
  }, []);

  /** @param {AppSortBy} sortBy - Requested sort mode. */
  const handleLibrarySortChange = useCallback((sortBy) => {
    setPage(1);
    setLibrarySortBy(sortBy);
  }, []);

  /** @param {AppFilterBy} filterBy - Requested filter mode. */
  const handleLibraryFilterChange = useCallback((filterBy) => {
    setPage(1);
    setLibraryFilterBy(filterBy);
  }, []);

  /** @param {number} nextPage - Page selected in pagination. */
  const handlePageChange = useCallback((nextPage) => {
    setPage(nextPage);
    libraryScrollRef.current?.scrollTo({ top: 0 });
  }, []);

  /** @param {string} newView - Destination view. @param {{filterBy?: AppFilterBy, settingsSection?: string}} [options] - Navigation options. */
  const handleNavigate = useCallback((newView, options) => {
    setView(newView);
    if (newView === "library" || newView === "downloads") {
      setSelectedGame(null);
    }
    if (newView === "library" && options?.filterBy) {
      setPage(1);
      setSelectedPlatform(null);
      setSearchQuery("");
      setLibraryFilterBy(options.filterBy);
    }
    if (newView === "settings") {
      setSettingsInitialSection(options?.settingsSection ?? "general");
    }
  }, []);

  const handleDismissError = useCallback(() => {
    setError(null);
    setLibraryLaunchError(null);
  }, [setError]);

  const handleBackFromGameDetails = useCallback(async () => {
    handleNavigate("library");
    await reloadLibrary();
  }, [handleNavigate, reloadLibrary]);

  /** @param {string} section - Settings section to open. */
  const handleOpenSettings = useCallback(
    (section) => {
      handleNavigate("settings", { settingsSection: section });
    },
    [handleNavigate]
  );

  const handleCloseMessages = useCallback(() => {
    setSaveSyncMessages([]);
  }, []);

  return {
    gameTotal,
    games,
    handleBackFromGameDetails,
    handleCloseMessages,
    handleDismissError,
    handleGameUpdate,
    handleLaunchGame,
    handleLibraryFilterChange,
    handleLibrarySortChange,
    handleNavigate,
    handleOpenSettings,
    handlePageChange,
    handleSearchChange,
    handleSelectGame,
    handleSelectPlatform,
    handleToggleFavorite,
    libraryFilterBy,
    libraryLaunchError,
    libraryScrollRef,
    librarySortBy,
    loading,
    page,
    reloadLibrary,
    saveSyncMessages,
    searchQuery,
    selectedGame,
    selectedPlatform,
    settingsInitialSection,
    view,
  };
};

const updateLaunchStatus = ({
  gameId,
  games,
  platforms,
  result,
  setError,
  setLibraryLaunchError,
}) => {
  if (result.success === false && result.error) {
    const platformLabel = getPlatformLabel(platforms, games, gameId);
    const presentation = getLaunchErrorPresentation(
      result.error,
      platformLabel
    );
    setLibraryLaunchError({ gameId, ...presentation });
    setError(presentation.message);
    return;
  }
  if (
    Array.isArray(result.save_sync_warnings) &&
    result.save_sync_warnings.length
  ) {
    const warnings = result.save_sync_warnings.filter(isText);
    setLibraryLaunchError(null);
    setError(warnings.join("\n"));
    return;
  }
  setLibraryLaunchError(null);
  setError(null);
};
