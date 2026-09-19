import { useCallback, useEffect, useRef, useState } from "react";

import { getLaunchErrorPresentation } from "../immersive/launch-error";
import { filterAndSortGames } from "../utils/game-filters";
import { useLibraryNavigation } from "./use-app-library-navigation";

/** @typedef {import("./app-runtime").AppRuntime} AppRuntime */
/** @typedef {import("../components/game/game-details-types").GameDetailsGame} AppGame */
/** @typedef {{id: string|number, name: string}} AppPlatform */
/** @typedef {{gameId: number|string, guidance: string, message: string, retryable: boolean}} AppLaunchError */
/** @typedef {"name"|"recent"|"play_time"} AppSortBy */
/** @typedef {"all"|"favorites"|"recent"|"downloaded"|"not_downloaded"} AppFilterBy */
/** @typedef {{games: AppGame[], total: number}} GamePage */
/** @typedef {{success?: boolean, error?: string|{message?: string}, dry_run?: boolean, save_sync_messages?: unknown[], save_sync_warnings?: string[]}} LaunchResult */

const GAMES_PER_PAGE = 60;
const SWITCH_SAVE_TRANSFER_MESSAGE =
  /^(?:Uploaded Switch save for .+ to RomM|Restored Switch save .+ from RomM) \(slot: .+\)$/iu;

/** @param {unknown} error - Error value from an IPC boundary. */
const getErrorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

/** @param {unknown} messages Launch save-sync messages. @returns {string[]} Safe, distinct success notifications. */
const getSaveSyncMessages = (messages) => {
  if (!Array.isArray(messages)) return [];
  const distinctMessages = new Set();
  for (const value of messages) {
    if (typeof value !== "string") continue;
    const message = value.trim();
    if (message === "") continue;
    distinctMessages.add(
      SWITCH_SAVE_TRANSFER_MESSAGE.test(message)
        ? "Cloud save sync completed."
        : message
    );
  }
  return [...distinctMessages];
};

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

/**
 * @param {object} options - Launch result dependencies.
 * @param {number|string} options.gameId - Target game identifier.
 * @param {AppGame[]} options.games - Loaded games.
 * @param {[AppPlatform, number][]} options.platforms - Loaded platforms.
 * @param {LaunchResult} options.result - Launch result.
 * @param {(message: string|null) => void} options.setError - Error setter.
 * @param {(error: AppLaunchError|null) => void} options.setLibraryLaunchError - Launch error setter.
 */
const updateLaunchStatus = ({
  gameId,
  games,
  platforms,
  result,
  setError,
  setLibraryLaunchError,
}) => {
  if (
    result.success === false &&
    result.error !== undefined &&
    result.error !== null
  ) {
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
    result.save_sync_warnings.length > 0
  ) {
    const warnings = result.save_sync_warnings;
    setLibraryLaunchError(null);
    setError(warnings.join("\n"));
    return;
  }
  setLibraryLaunchError(null);
  setError(null);
};

/** @type {AppGame[]} */
const EMPTY_GAMES = [];

/** @returns {AppLaunchError|null} Initial launch error. */
const initialLaunchError = () => null;

/** @param {{runtime: AppRuntime, showSetup: boolean|null, page: number, selectedPlatform: string|null, searchQuery: string, librarySortBy: AppSortBy, libraryFilterBy: AppFilterBy, setPage: (page: number) => void, setSelectedGame: (value: AppGame|null | ((current: AppGame|null) => AppGame|null)) => void}} options Library refresh dependencies. */
const useLibraryRefresh = ({
  runtime,
  showSetup,
  page,
  selectedPlatform,
  searchQuery,
  librarySortBy,
  libraryFilterBy,
  setPage,
  setSelectedGame,
}) => {
  const [games, setGames] = useState(EMPTY_GAMES);
  const [gameTotal, setGameTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const gamesRequestId = useRef(0);
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
        const lastPage = Math.max(1, Math.ceil(result.total / GAMES_PER_PAGE));
        if (requestedPage > lastPage) {
          setPage(lastPage);
          setLoading(false);
          return;
        }
        const firstGame = (requestedPage - 1) * GAMES_PER_PAGE;
        setGames(result.games.slice(firstGame, requestedPage * GAMES_PER_PAGE));
        setGameTotal(result.total);
        setSelectedGame((current) => {
          if (!current) {
            return current;
          }
          return result.games.find((game) => game.id === current.id) ?? current;
        });
      } catch (error) {
        console.error("Failed to refresh games:", error);
      }
      if (requestId === gamesRequestId.current) {
        setLoading(false);
      }
    },
    [
      libraryFilterBy,
      librarySortBy,
      page,
      runtime,
      searchQuery,
      selectedPlatform,
      setPage,
      setSelectedGame,
    ]
  );

  useEffect(() => {
    if (showSetup === false) {
      queueMicrotask(() => {
        void refreshGames(selectedPlatform, searchQuery, page);
      });
    }
  }, [page, refreshGames, searchQuery, selectedPlatform, showSetup]);

  return { gameTotal, games, loading, refreshGames, setGames };
};

/** @param {{runtime: AppRuntime, setError: (message: string|null) => void, setGames: import("react").Dispatch<import("react").SetStateAction<AppGame[]>>, setSelectedGame: import("react").Dispatch<import("react").SetStateAction<AppGame|null>>}} options Favorite action dependencies. */
const useLibraryFavoriteAction = ({
  runtime,
  setError,
  setGames,
  setSelectedGame,
}) =>
  useCallback(
    /** @param {number|string} gameId Game to update. */
    async (gameId) => {
      try {
        const newState = await runtime.invoke("toggle_favorite", { gameId });
        setGames((current) =>
          current.map((game) =>
            game.id === gameId ? { ...game, is_favorite: newState } : game
          )
        );
        setSelectedGame((current) => {
          if (!current || current.id !== gameId) {
            return current;
          }
          return { ...current, is_favorite: newState };
        });
      } catch (error) {
        setError(getErrorMessage(error));
      }
    },
    [runtime, setError, setGames, setSelectedGame]
  );

/** @param {{games: AppGame[], platforms: [AppPlatform, number][], refreshGames: () => Promise<void>, runtime: AppRuntime, setError: (message: string|null) => void, setLibraryLaunchError: (error: AppLaunchError|null) => void, setSaveSyncMessages: (messages: string[]) => void}} options Launch action dependencies. */
const useLibraryLaunchAction = ({
  games,
  platforms,
  refreshGames,
  runtime,
  setError,
  setLibraryLaunchError,
  setSaveSyncMessages,
}) => {
  const launchInFlightRef = useRef(new Set());
  return useCallback(
    /** @param {number|string} gameId Game to launch. */
    async (gameId) => {
      if (launchInFlightRef.current.has(gameId)) {
        return null;
      }
      launchInFlightRef.current.add(gameId);
      try {
        const result = await runtime.invoke("prepare_and_launch_game", {
          gameId,
        });
        const messages = getSaveSyncMessages(result.save_sync_messages);
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
        launchInFlightRef.current.delete(gameId);
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
        launchInFlightRef.current.delete(gameId);
        return null;
      }
    },
    [
      games,
      platforms,
      refreshGames,
      runtime,
      setError,
      setLibraryLaunchError,
      setSaveSyncMessages,
    ]
  );
};

/** @param {{runtime: AppRuntime, setGames: import("react").Dispatch<import("react").SetStateAction<AppGame[]>>, setSelectedGame: import("react").Dispatch<import("react").SetStateAction<AppGame|null>>}} options Game update dependencies. */
const useLibraryGameUpdate = ({ runtime, setGames, setSelectedGame }) =>
  useCallback(
    /** @param {number|string} gameId Game whose details changed. */
    async (gameId) => {
      try {
        const updated = await runtime.invoke("get_game_details", { gameId });
        setSelectedGame(updated);
        setGames((current) =>
          current.map((game) => (game.id === gameId ? updated : game))
        );
      } catch (error) {
        console.error("Failed to refresh after download:", error);
      }
    },
    [runtime, setGames, setSelectedGame]
  );

/** @param {{runtime: AppRuntime, platforms: [AppPlatform, number][], loadData: () => Promise<void>, setError: (message: string|null) => void, navigation: ReturnType<typeof useLibraryNavigation>, data: ReturnType<typeof useLibraryRefresh>}} options Library action dependencies. */
const useLibraryAppActions = ({
  runtime,
  platforms,
  loadData,
  setError,
  navigation,
  data,
}) => {
  const { handleNavigate } = navigation;
  const { refreshGames } = data;
  /** @type {string[]} */
  const initialSaveSyncMessages = [];
  const [saveSyncMessages, setSaveSyncMessages] = useState(
    initialSaveSyncMessages
  );
  const [libraryLaunchError, setLibraryLaunchError] =
    useState(initialLaunchError);
  const handleToggleFavorite = useLibraryFavoriteAction({
    runtime,
    setError,
    setGames: data.setGames,
    setSelectedGame: navigation.setSelectedGame,
  });
  const handleLaunchGame = useLibraryLaunchAction({
    games: data.games,
    platforms,
    refreshGames: data.refreshGames,
    runtime,
    setError,
    setLibraryLaunchError,
    setSaveSyncMessages,
  });
  const handleGameUpdate = useLibraryGameUpdate({
    runtime,
    setGames: data.setGames,
    setSelectedGame: navigation.setSelectedGame,
  });
  const reloadLibrary = useCallback(async () => {
    await Promise.all([loadData(), refreshGames()]);
  }, [loadData, refreshGames]);

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
    /** @param {string} section Settings section to open. */
    (section) => {
      handleNavigate("settings", { settingsSection: section });
    },
    [handleNavigate]
  );

  const handleCloseMessages = useCallback(() => {
    setSaveSyncMessages([]);
  }, []);

  return {
    handleBackFromGameDetails,
    handleCloseMessages,
    handleDismissError,
    handleGameUpdate,
    handleLaunchGame,
    handleOpenSettings,
    handleToggleFavorite,
    libraryLaunchError,
    reloadLibrary,
    saveSyncMessages,
  };
};

/** @param {{runtime: AppRuntime, showSetup: boolean|null, platforms: [AppPlatform, number][], loadData: () => Promise<void>, setError: (message: string|null) => void}} options Library dependencies. */
export const useAppLibrary = ({
  runtime,
  showSetup,
  platforms,
  loadData,
  setError,
}) => {
  const navigation = useLibraryNavigation();
  const data = useLibraryRefresh({
    libraryFilterBy: navigation.libraryFilterBy,
    librarySortBy: navigation.librarySortBy,
    page: navigation.page,
    runtime,
    searchQuery: navigation.searchQuery,
    selectedPlatform: navigation.selectedPlatform,
    setPage: navigation.setPage,
    setSelectedGame: navigation.setSelectedGame,
    showSetup,
  });
  const actions = useLibraryAppActions({
    data,
    loadData,
    navigation,
    platforms,
    runtime,
    setError,
  });

  return {
    ...actions,
    gameTotal: data.gameTotal,
    games: data.games,
    handleLibraryFilterChange: navigation.handleLibraryFilterChange,
    handleLibrarySortChange: navigation.handleLibrarySortChange,
    handleNavigate: navigation.handleNavigate,
    handlePageChange: navigation.handlePageChange,
    handleSearchChange: navigation.handleSearchChange,
    handleSelectGame: navigation.handleSelectGame,
    handleSelectPlatform: navigation.handleSelectPlatform,
    libraryFilterBy: navigation.libraryFilterBy,
    libraryScrollRef: navigation.libraryScrollRef,
    librarySortBy: navigation.librarySortBy,
    loading: data.loading,
    page: navigation.page,
    searchQuery: navigation.searchQuery,
    selectedGame: navigation.selectedGame,
    selectedPlatform: navigation.selectedPlatform,
    settingsInitialSection: navigation.settingsInitialSection,
    view: navigation.view,
  };
};
