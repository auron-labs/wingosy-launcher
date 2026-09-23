import { useCallback, useEffect, useRef, useState } from "react";

import { getLaunchErrorPresentation } from "../immersive/launch-error";
import { useLibraryNavigation } from "./use-app-library-navigation";

/** @typedef {import("./app-runtime").AppRuntime} AppRuntime */
/** @typedef {import("../components/game/game-details-types").GameDetailsGame} AppGame */
/** @typedef {{id: string|number, name: string}} AppPlatform */
/** @typedef {{gameId: number|string, guidance: string, message: string, retryable: boolean}} AppLaunchError */
/** @typedef {"name"|"recent"|"play_time"|"play_count"|"release_year"} AppSortBy */
/** @typedef {"all"|"favorites"|"recent"} AppFilterBy */
/** @typedef {"all"|"downloaded"|"not_downloaded"} AppAvailability */
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
  if (!Array.isArray(messages)) {
    return [];
  }
  /** @type {Set<string>} */
  const distinctMessages = new Set();
  for (const value of messages) {
    if (Object.prototype.toString.call(value) !== "[object String]") {
      continue;
    }
    const message = String(value).trim();
    if (message === "") {
      continue;
    }
    distinctMessages.add(
      SWITCH_SAVE_TRANSFER_MESSAGE.test(message)
        ? "Cloud save sync completed."
        : message
    );
  }
  return [...distinctMessages];
};

/** @param {{platformId: string|null, query: string, requestedPage: number, requestedSortBy: AppSortBy, requestedSortDescending: boolean, requestedFilterBy: AppFilterBy, requestedAvailability: AppAvailability, runtime: AppRuntime}} options - Library query dependencies. */
const fetchGames = async ({
  runtime,
  platformId,
  query,
  requestedPage,
  requestedSortBy,
  requestedSortDescending,
  requestedFilterBy,
  requestedAvailability,
}) => {
  const result = await runtime.invoke("get_games_page", {
    availability: requestedAvailability,
    filterBy: requestedFilterBy,
    page: requestedPage,
    pageSize: GAMES_PER_PAGE,
    platformId,
    searchQuery: query || null,
    sortBy: requestedSortBy === "recent" ? "last_played" : requestedSortBy,
    sortDescending: requestedSortDescending,
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

/** @param {{result: GamePage, requestedPage: number, setGames: import("react").Dispatch<import("react").SetStateAction<AppGame[]>>, setGameTotal: (value: number) => void, setPage: (page: number) => void, setSelectedGame: import("react").Dispatch<import("react").SetStateAction<AppGame|null>>}} options Applies an accepted page and refreshes the selected game when present. */
const commitGamesPage = ({
  result,
  requestedPage,
  setGames,
  setGameTotal,
  setPage,
  setSelectedGame,
}) => {
  const lastPage = Math.max(1, Math.ceil(result.total / GAMES_PER_PAGE));
  if (requestedPage > lastPage) {
    setPage(lastPage);
    return;
  }
  setGames(result.games);
  setGameTotal(result.total);
  setSelectedGame((current) => {
    if (!current) {
      return current;
    }
    return result.games.find((game) => game.id === current.id) ?? current;
  });
};

/** @param {boolean|null} showSetup Current setup state. @param {() => Promise<void>} refreshGames Library refresh callback. */
const useLibraryStartupRefresh = (showSetup, refreshGames) => {
  useEffect(() => {
    if (showSetup === false) {
      queueMicrotask(() => {
        void refreshGames();
      });
    }
  }, [refreshGames, showSetup]);
};

/** @param {{runtime: AppRuntime, showSetup: boolean|null, page: number, selectedPlatform: string|null, searchQuery: string, librarySortBy: AppSortBy, librarySortDescending: boolean, libraryFilterBy: AppFilterBy, libraryAvailability: AppAvailability, setPage: (page: number) => void, setSelectedGame: (value: AppGame|null | ((current: AppGame|null) => AppGame|null)) => void}} options Library refresh dependencies. */
const useLibraryRefresh = ({
  runtime,
  showSetup,
  page,
  selectedPlatform,
  searchQuery,
  librarySortBy,
  librarySortDescending,
  libraryFilterBy,
  libraryAvailability,
  setPage,
  setSelectedGame,
}) => {
  const [games, setGames] = useState(EMPTY_GAMES);
  const [gameTotal, setGameTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const gamesRequestId = useRef(0);
  const refreshGames = useCallback(
    async ({
      platformId = selectedPlatform,
      query = searchQuery,
      requestedPage = page,
      requestedSortBy = librarySortBy,
      requestedSortDescending = librarySortDescending,
      requestedFilterBy = libraryFilterBy,
      requestedAvailability = libraryAvailability,
    } = {}) => {
      const requestId = gamesRequestId.current + 1;
      gamesRequestId.current = requestId;
      setLoading(true);
      try {
        const result = await fetchGames({
          platformId,
          query,
          requestedAvailability,
          requestedFilterBy,
          requestedPage,
          requestedSortBy,
          requestedSortDescending,
          runtime,
        });
        if (requestId !== gamesRequestId.current) {
          return;
        }
        commitGamesPage({
          requestedPage,
          result,
          setGameTotal,
          setGames,
          setPage,
          setSelectedGame,
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
      libraryAvailability,
      librarySortBy,
      librarySortDescending,
      page,
      runtime,
      searchQuery,
      selectedPlatform,
      setPage,
      setSelectedGame,
    ]
  );

  useLibraryStartupRefresh(showSetup, refreshGames);

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
    libraryAvailability: navigation.libraryAvailability,
    libraryFilterBy: navigation.libraryFilterBy,
    librarySortBy: navigation.librarySortBy,
    librarySortDescending: navigation.librarySortDescending,
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
    handleLibraryAvailabilityChange: navigation.handleLibraryAvailabilityChange,
    handleLibraryFilterChange: navigation.handleLibraryFilterChange,
    handleLibrarySortChange: navigation.handleLibrarySortChange,
    handleLibrarySortDirectionChange:
      navigation.handleLibrarySortDirectionChange,
    handleNavigate: navigation.handleNavigate,
    handlePageChange: navigation.handlePageChange,
    handleSearchChange: navigation.handleSearchChange,
    handleSelectGame: navigation.handleSelectGame,
    handleSelectPlatform: navigation.handleSelectPlatform,
    libraryAvailability: navigation.libraryAvailability,
    libraryFilterBy: navigation.libraryFilterBy,
    libraryScrollRef: navigation.libraryScrollRef,
    librarySortBy: navigation.librarySortBy,
    librarySortDescending: navigation.librarySortDescending,
    loading: data.loading,
    page: navigation.page,
    searchQuery: navigation.searchQuery,
    selectedGame: navigation.selectedGame,
    selectedPlatform: navigation.selectedPlatform,
    settingsInitialSection: navigation.settingsInitialSection,
    view: navigation.view,
  };
};
