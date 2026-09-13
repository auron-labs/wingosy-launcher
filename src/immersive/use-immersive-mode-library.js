import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { dedupeGames } from "./game-list";
import {
  getGamesPage,
  getImmersiveConfig,
  getPlatformsWithGames,
} from "./immersive-mode-ipc";

/** @typedef {import("./immersive-types").GamesPage} GamesPage */
/** @typedef {import("./immersive-types").ImmersiveConfig} ImmersiveConfig */
/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {import("./immersive-types").PlatformEntry} PlatformEntry */
/** @typedef {{getGamesPage: typeof getGamesPage, getImmersiveConfig: typeof getImmersiveConfig, getPlatformsWithGames: typeof getPlatformsWithGames}} ImmersiveLibraryIpc */

const defaultLibraryIpc = {
  getGamesPage,
  getImmersiveConfig,
  getPlatformsWithGames,
};

const GAMES_PER_PAGE = 60;
const LOAD_AHEAD = 12;

/** @returns {ImmersiveGame[]} Initial game list. */
const getInitialGames = () => [];
/** @returns {PlatformEntry[]} Initial platform list. */
const getInitialPlatforms = () => [];
/** @returns {string|null} Initial platform selection. */
const getInitialPlatform = () => null;
/** @returns {ImmersiveGame|null} Initial game selection. */
const getInitialGame = () => null;
/** @returns {string|null} Initial library error. */
const getInitialError = () => null;
/** @returns {{page: number, requestId: number}|null} Initial page request. */
const getInitialPageRequest = () => null;
/** @returns {number|string|null} Initial game identifier. */
const getInitialGameId = () => null;

/** @param {unknown} error Error from an IPC boundary. @returns {string} Error message. */
const getErrorMessage = (error) => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

/** @param {string} query Search query. @returns {string|null} IPC search query. */
const getSearchQuery = (query) => {
  const trimmed = query.trim();
  return trimmed === "" ? null : trimmed;
};

/** @param {{ipc: ImmersiveLibraryIpc, platformId: string|null, query: string}} options Library query. @returns {Promise<{gamesPage: GamesPage, platforms: PlatformEntry[], config: ImmersiveConfig}>} Library snapshot. */
const fetchLibrarySnapshot = async ({ ipc, platformId, query }) => {
  const [gamesPage, platforms, config] = await Promise.all([
    ipc.getGamesPage(1, platformId, getSearchQuery(query)),
    ipc.getPlatformsWithGames(),
    ipc.getImmersiveConfig(),
  ]);
  return { config, gamesPage, platforms };
};

/** @param {{gamesPage: GamesPage, currentGames: ImmersiveGame[], loadedCount: number}} options Page-one merge inputs. @returns {{games: ImmersiveGame[], loadedCount: number, total: number}} Merged page-one data. */
const mergeFirstPage = ({ gamesPage, currentGames, loadedCount }) => {
  const pageGames = gamesPage.games;
  const pageGameIds = new Set(pageGames.map((game) => game.id));
  const games = dedupeGames([
    ...dedupeGames(pageGames),
    ...currentGames.filter((game) => !pageGameIds.has(game.id)),
  ]).slice(0, Math.max(gamesPage.total, pageGames.length));
  return {
    games,
    loadedCount: Math.max(loadedCount, pageGames.length),
    total: gamesPage.total,
  };
};

/** @typedef {{gamesRef: {current: ImmersiveGame[]}, libraryRequestId: {current: number}, loadedGameCountRef: {current: number}, nextPageInFlightRef: {current: {page: number, requestId: number}|null}, nextPageRef: {current: number}, selectedGameIdRef: {current: number|string|null}, focusedGameIdRef: {current: number|string|null}}} LibraryRefs */

/** @param {{refs: LibraryRefs, config: ImmersiveConfig, merged: {games: ImmersiveGame[], loadedCount: number, total: number}, platforms: PlatformEntry[], onConfigLoaded: (config: ImmersiveConfig) => void, setGames: (games: ImmersiveGame[]) => void, setPlatforms: (platforms: PlatformEntry[]) => void, setGameTotal: (total: number) => void, setLoadedGameCount: (count: number) => void, setSelectedIndex: (index: number) => void, setSelectedGame: (game: ImmersiveGame|null|((current: ImmersiveGame|null) => ImmersiveGame|null)) => void}} options Loaded library data. */
const applyLoadedLibrary = ({
  config,
  merged,
  onConfigLoaded,
  platforms,
  refs,
  setGameTotal,
  setGames,
  setLoadedGameCount,
  setPlatforms,
  setSelectedGame,
  setSelectedIndex,
}) => {
  const { games, loadedCount, total } = merged;
  refs.loadedGameCountRef.current = loadedCount;
  setLoadedGameCount(loadedCount);
  refs.gamesRef.current = games;
  setGames(games);
  setGameTotal(total);
  refs.nextPageRef.current =
    Math.floor(Math.max(0, loadedCount - 1) / GAMES_PER_PAGE) + 2;
  const preservedGameId =
    refs.selectedGameIdRef.current ?? refs.focusedGameIdRef.current;
  const selectedIndex = games.findIndex((game) => game.id === preservedGameId);
  if (selectedIndex !== -1) {
    setSelectedIndex(selectedIndex);
  }
  setSelectedGame((current) => {
    if (current === null) {
      return current;
    }
    const selectedId = refs.selectedGameIdRef.current ?? current.id;
    return games.find((game) => game.id === selectedId) ?? current;
  });
  setPlatforms(platforms);
  onConfigLoaded(config);
};

/** @param {LibraryRefs} refs Library refs. @param {{page: number, requestId: number}} request Page request. */
const releasePageRequest = (refs, request) => {
  if (refs.nextPageInFlightRef.current === request) {
    refs.nextPageInFlightRef.current = null;
  }
};

/** @param {{ipc: ImmersiveLibraryIpc, refs: LibraryRefs, platformId: string|null, query: string, onConfigLoaded: (config: ImmersiveConfig) => void, setError: (error: string|null) => void, setGameTotal: (total: number) => void, setGames: (games: ImmersiveGame[]|((current: ImmersiveGame[]) => ImmersiveGame[])) => void, setLoadedGameCount: (count: number) => void, setLoading: (loading: boolean) => void, setPlatforms: (platforms: PlatformEntry[]) => void, setSelectedGame: (game: ImmersiveGame|null|((current: ImmersiveGame|null) => ImmersiveGame|null)) => void, setSelectedIndex: (index: number) => void}} options First-page loading options. @returns {Promise<ImmersiveGame[]>} Loaded games. */
const loadFirstPage = async ({
  ipc,
  onConfigLoaded,
  platformId,
  query,
  refs,
  setError,
  setGameTotal,
  setGames,
  setLoadedGameCount,
  setLoading,
  setPlatforms,
  setSelectedGame,
  setSelectedIndex,
}) => {
  const requestId = refs.libraryRequestId.current + 1;
  refs.libraryRequestId.current = requestId;
  refs.nextPageInFlightRef.current = null;
  setLoading(true);
  setError(null);
  try {
    const snapshot = await fetchLibrarySnapshot({ ipc, platformId, query });
    if (requestId !== refs.libraryRequestId.current) {
      return [];
    }
    const merged = mergeFirstPage({
      currentGames: refs.gamesRef.current,
      gamesPage: snapshot.gamesPage,
      loadedCount: refs.loadedGameCountRef.current,
    });
    applyLoadedLibrary({
      ...snapshot,
      merged,
      onConfigLoaded,
      refs,
      setGameTotal,
      setGames,
      setLoadedGameCount,
      setPlatforms,
      setSelectedGame,
      setSelectedIndex,
    });
    setLoading(false);
    return merged.games;
  } catch (loadError) {
    if (requestId === refs.libraryRequestId.current) {
      setError(getErrorMessage(loadError));
      setLoading(false);
    }
    return [];
  }
};

/** @param {{ipc: ImmersiveLibraryIpc, refs: LibraryRefs, gameTotal: number, searchQuery: string, selectedPlatform: string|null, setError: (error: string|null) => void, setGameTotal: (total: number) => void, setGames: (games: ImmersiveGame[]|((current: ImmersiveGame[]) => ImmersiveGame[])) => void, setLoadedGameCount: (count: number) => void}} options Next-page loading options. @returns {Promise<void>} Completed page load. */
const loadNextLibraryPage = async ({
  gameTotal,
  ipc,
  refs,
  searchQuery,
  selectedPlatform,
  setError,
  setGameTotal,
  setGames,
  setLoadedGameCount,
}) => {
  if (
    refs.nextPageInFlightRef.current !== null ||
    refs.loadedGameCountRef.current >= gameTotal
  ) {
    return;
  }
  const requestId = refs.libraryRequestId.current;
  const page = refs.nextPageRef.current;
  const request = { page, requestId };
  refs.nextPageInFlightRef.current = request;
  try {
    const result = await ipc.getGamesPage(
      page,
      selectedPlatform,
      getSearchQuery(searchQuery)
    );
    if (requestId !== refs.libraryRequestId.current) {
      releasePageRequest(refs, request);
      return;
    }
    const pageGames = result.games;
    const loadedCount = refs.loadedGameCountRef.current + pageGames.length;
    refs.loadedGameCountRef.current = loadedCount;
    setLoadedGameCount(loadedCount);
    setGames((current) => {
      const nextGames = dedupeGames([...current, ...pageGames]);
      refs.gamesRef.current = nextGames;
      return nextGames;
    });
    setGameTotal(result.total ?? loadedCount);
    refs.nextPageRef.current = page + 1;
  } catch (loadError) {
    if (requestId === refs.libraryRequestId.current) {
      setError(getErrorMessage(loadError));
    }
  }
  releasePageRequest(refs, request);
};

const useLibraryState = () => {
  const [games, setGames] = useState(getInitialGames);
  const [gameTotal, setGameTotal] = useState(0);
  const [platforms, setPlatforms] = useState(getInitialPlatforms);
  const [selectedPlatform, setSelectedPlatform] = useState(getInitialPlatform);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGame, setSelectedGame] = useState(getInitialGame);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(getInitialError);
  const [loadedGameCount, setLoadedGameCount] = useState(0);
  return {
    error,
    gameTotal,
    games,
    loadedGameCount,
    loading,
    platforms,
    searchQuery,
    selectedGame,
    selectedIndex,
    selectedPlatform,
    setError,
    setGameTotal,
    setGames,
    setLoadedGameCount,
    setLoading,
    setPlatforms,
    setSearchQuery,
    setSelectedGame,
    setSelectedIndex,
    setSelectedPlatform,
  };
};

/** @param {{gameTotal: number, games: ImmersiveGame[], loadedGameCount: number, selectedIndex: number, view: string, loading: boolean, loadNextPage: () => Promise<void>}} options Lazy-page dependencies. */
const useLazyLibraryLoading = ({
  gameTotal,
  games,
  loadedGameCount,
  selectedIndex,
  view,
  loading,
  loadNextPage,
}) => {
  useEffect(() => {
    if (
      view !== "library" ||
      loading ||
      loadedGameCount >= gameTotal ||
      selectedIndex < games.length - LOAD_AHEAD
    ) {
      return;
    }
    void loadNextPage();
  }, [
    gameTotal,
    games.length,
    loadNextPage,
    loadedGameCount,
    loading,
    selectedIndex,
    view,
  ]);
};

/** @typedef {{setView: (view: string) => void, setSelectedGame: (game: ImmersiveGame|null) => void, setSelectedIndex: (index: number) => void, setGames: (games: ImmersiveGame[]) => void, setGameTotal: (total: number) => void, setLoading: (loading: boolean) => void, setError: (error: string|null) => void, setSearchQuery: (query: string) => void, setSelectedPlatform: (platform: string|null) => void, selectedPlatform: string|null, searchQuery: string, gamesRef: {current: ImmersiveGame[]}, focusedGameIdRef: {current: number|string|null}, selectedGameIdRef: {current: number|string|null}, libraryRequestId: {current: number}, nextPageInFlightRef: {current: {page: number, requestId: number}|null}, nextPageRef: {current: number}}} SelectionOptions */

/** @param {SelectionOptions} options Selection state. @returns {{handleSelectGame: (game: ImmersiveGame) => void, handleSelectedIndexChange: (index: number, game?: ImmersiveGame) => void, handleSelectedPlatformChange: (platform: string|null) => void, handleSearchChange: (query: string) => void}} Selection handlers. */
const useLibrarySelectionHandlers = ({
  focusedGameIdRef,
  gamesRef,
  libraryRequestId,
  nextPageInFlightRef,
  nextPageRef,
  searchQuery,
  selectedGameIdRef,
  selectedPlatform,
  setError,
  setGameTotal,
  setGames,
  setLoading,
  setSearchQuery,
  setSelectedGame,
  setSelectedIndex,
  setSelectedPlatform,
  setView,
}) => {
  const resetLibrarySelection = () => {
    libraryRequestId.current += 1;
    nextPageInFlightRef.current = null;
    nextPageRef.current = 2;
    gamesRef.current = [];
    focusedGameIdRef.current = null;
    selectedGameIdRef.current = null;
    setGames([]);
    setGameTotal(0);
    setSelectedIndex(0);
    setLoading(true);
    setError(null);
  };
  const handleSelectGame =
    /** @param {ImmersiveGame} game Selected game. */
    (game) => {
      selectedGameIdRef.current = game.id;
      focusedGameIdRef.current = game.id;
      setSelectedGame(game);
      setView("details");
    };
  const handleSelectedPlatformChange =
    /** @param {string|null} platform Selected platform. */
    (platform) => {
      if (platform === selectedPlatform) {
        return;
      }
      resetLibrarySelection();
      setSelectedPlatform(platform);
    };
  const handleSearchChange =
    /** @param {string} query Search query. */
    (query) => {
      if (query === searchQuery) {
        return;
      }
      resetLibrarySelection();
      setSearchQuery(query);
    };
  const handleSelectedIndexChange =
    /** @param {number} index Selected index. @param {ImmersiveGame} [game] Focused game. */
    (index, game) => {
      const selectedId = game?.id ?? gamesRef.current[index]?.id ?? null;
      focusedGameIdRef.current = selectedId;
      setSelectedIndex(index);
    };
  return {
    handleSearchChange,
    handleSelectGame,
    handleSelectedIndexChange,
    handleSelectedPlatformChange,
  };
};

const useLibraryRefs = () => {
  const focusedGameIdRef = useRef(getInitialGameId());
  const gamesRef = useRef(getInitialGames());
  const libraryRequestId = useRef(0);
  const loadedGameCountRef = useRef(0);
  const nextPageInFlightRef = useRef(getInitialPageRequest());
  const nextPageRef = useRef(2);
  const selectedGameIdRef = useRef(getInitialGameId());
  const refs = useMemo(
    () => ({
      focusedGameIdRef,
      gamesRef,
      libraryRequestId,
      loadedGameCountRef,
      nextPageInFlightRef,
      nextPageRef,
      selectedGameIdRef,
    }),
    [
      focusedGameIdRef,
      gamesRef,
      libraryRequestId,
      loadedGameCountRef,
      nextPageInFlightRef,
      nextPageRef,
      selectedGameIdRef,
    ]
  );
  return refs;
};

/** @param {{ipc: ImmersiveLibraryIpc, state: ReturnType<typeof useLibraryState>, onConfigLoaded: (config: ImmersiveConfig) => void}} options Page-loading options. @returns {{loadData: (platformId?: string|null, query?: string) => Promise<ImmersiveGame[]>, loadNextPage: () => Promise<void>, refs: LibraryRefs}} Page-loading callbacks. */
const useLibraryData = ({ ipc, state, onConfigLoaded }) => {
  const refs = useLibraryRefs();
  const {
    gameTotal,
    searchQuery,
    selectedPlatform,
    setError,
    setGameTotal,
    setGames,
    setLoadedGameCount,
    setLoading,
    setPlatforms,
    setSelectedGame,
    setSelectedIndex,
  } = state;
  const loadData = useCallback(
    /** @param {string|null} [platformId] Platform filter. @param {string} [query] Search query. */
    async (platformId = selectedPlatform, query = searchQuery) =>
      await loadFirstPage({
        ipc,
        onConfigLoaded,
        platformId,
        query,
        refs,
        setError,
        setGameTotal,
        setGames,
        setLoadedGameCount,
        setLoading,
        setPlatforms,
        setSelectedGame,
        setSelectedIndex,
      }),
    [
      ipc,
      onConfigLoaded,
      refs,
      searchQuery,
      selectedPlatform,
      setError,
      setGameTotal,
      setGames,
      setLoadedGameCount,
      setLoading,
      setPlatforms,
      setSelectedGame,
      setSelectedIndex,
    ]
  );
  const loadNextPage = useCallback(async () => {
    await loadNextLibraryPage({
      gameTotal,
      ipc,
      refs,
      searchQuery,
      selectedPlatform,
      setError,
      setGameTotal,
      setGames,
      setLoadedGameCount,
    });
  }, [
    gameTotal,
    ipc,
    refs,
    searchQuery,
    selectedPlatform,
    setError,
    setGameTotal,
    setGames,
    setLoadedGameCount,
  ]);
  useEffect(() => {
    const loadInitialData = async () => {
      await loadData();
    };
    void loadInitialData();
  }, [loadData]);
  return { loadData, loadNextPage, refs };
};

/** @param {{ipc?: ImmersiveLibraryIpc, view: string, setView: (view: string) => void, onConfigLoaded: (config: ImmersiveConfig) => void}} options Library controller options. */
export const useImmersiveModeLibrary = ({
  ipc = defaultLibraryIpc,
  view,
  setView,
  onConfigLoaded,
}) => {
  const state = useLibraryState();
  const data = useLibraryData({ ipc, onConfigLoaded, state });
  useLazyLibraryLoading({
    gameTotal: state.gameTotal,
    games: state.games,
    loadNextPage: data.loadNextPage,
    loadedGameCount: state.loadedGameCount,
    loading: state.loading,
    selectedIndex: state.selectedIndex,
    view,
  });
  const selectionHandlers = useLibrarySelectionHandlers({
    ...data.refs,
    searchQuery: state.searchQuery,
    selectedPlatform: state.selectedPlatform,
    setError: state.setError,
    setGameTotal: state.setGameTotal,
    setGames: state.setGames,
    setLoading: state.setLoading,
    setSearchQuery: state.setSearchQuery,
    setSelectedGame: state.setSelectedGame,
    setSelectedIndex: state.setSelectedIndex,
    setSelectedPlatform: state.setSelectedPlatform,
    setView,
  });
  return {
    error: state.error,
    gameTotal: state.gameTotal,
    games: state.games,
    gamesRef: data.refs.gamesRef,
    ...selectionHandlers,
    loadData: data.loadData,
    loading: state.loading,
    platforms: state.platforms,
    searchQuery: state.searchQuery,
    selectedGame: state.selectedGame,
    selectedIndex: state.selectedIndex,
    selectedPlatform: state.selectedPlatform,
    setError: state.setError,
    setGames: state.setGames,
    setSelectedGame: state.setSelectedGame,
  };
};
