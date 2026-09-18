import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useRomDownloads } from "../rom-downloads-context-value";
import { useAppTheme } from "../theme-context";
import { filterVisibleGames } from "../utils/game-filters";
import { isTextInputTarget } from "./controller-debug";
import {
  focusFirstGame,
  handleLibraryKeyDown,
} from "./immersive-library-keyboard";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {import("./immersive-types").PlatformEntry} PlatformEntry */

/**
 * @typedef {Object} ImmersiveLibraryProps
 * @property {boolean} loading Whether games are loading.
 * @property {string|null} error Current library error.
 * @property {ImmersiveGame[]} games Games shown in the library.
 * @property {PlatformEntry[]} [platforms] Available platforms.
 * @property {string|null} [selectedPlatform] Selected platform identifier.
 * @property {(platformId: string|null) => void} [onSelectedPlatformChange] Changes the selected platform.
 * @property {string} [searchQuery] Current search query.
 * @property {(query: string) => void} [onSearchChange] Changes the search query.
 * @property {number} selectedIndex Focused game index.
 * @property {(index: number, game?: ImmersiveGame) => void} onSelectedIndexChange Changes focused game.
 * @property {(game: ImmersiveGame) => void} onSelectGame Selects a game.
 * @property {() => void|Promise<void>} onExitImmersive Leaves immersive mode.
 * @property {() => void} onOpenSettings Opens settings.
 * @property {() => void} [onOpenDownloads] Opens downloads.
 * @property {{current: HTMLDivElement|null}} [controllerRouteRef] App-owned controller route target.
 */

/** @typedef {{loading: boolean, games: ImmersiveGame[], platforms: PlatformEntry[], selectedPlatform: string|null, searchQuery: string, selectedIndex: number, onSelectedIndexChange: (index: number, game?: ImmersiveGame) => void, controllerRouteRef?: {current: HTMLDivElement|null}}} LibraryDataOptions */
/** @typedef {{colors: Record<string, string>, section: string, setSectionAndReset: (section: string) => void, platformOptions: {id: string|null, label: string}[], selectedPlatform: string|null, platformButtonRefs: {current: (HTMLButtonElement|null)[]}, onSelectedPlatformChange: (platform: string|null) => void, activeCount: number, onOpenDownloads?: () => void, onOpenSettings: () => void, onExitImmersive: () => void, searchInputRef: {current: HTMLInputElement|null}, searchQuery: string, onSearchChange: (query: string) => void, error: string|null, loading: boolean, visibleGames: ImmersiveGame[], gridRef: {current: HTMLElement|null}, columns: number, selectedIndex: number, getProgress: (id: number|string) => object|null, onSelectedIndexChange: (index: number, game?: ImmersiveGame) => void, onSelectGame: (game: ImmersiveGame) => void, scrollRef: {current: HTMLElement|null}, rootRef: {current: HTMLElement|null}, handleKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void, onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void}} LibraryController */

/** @type {PlatformEntry[]} */
const EMPTY_PLATFORMS = [];

/** @returns {HTMLElement|null} Initial game grid. */
const initialGridRef = () => null;
/** @returns {HTMLElement|null} Initial library root. */
const initialRootRef = () => null;
/** @returns {HTMLElement|null} Initial scroll container. */
const initialScrollRef = () => null;
/** @returns {HTMLInputElement|null} Initial search input. */
const initialSearchInputRef = () => null;

/** @param {{gridRef: {current: HTMLElement|null}, loading: boolean, rootRef: {current: HTMLElement|null}, searchInputRef: {current: HTMLInputElement|null}, selectedIndex: number, visibleGames: ImmersiveGame[]}} options Library focus dependencies. */
const useLibraryFocusEffects = ({
  gridRef,
  loading,
  rootRef,
  searchInputRef,
  selectedIndex,
  visibleGames,
}) => {
  useEffect(() => {
    /** @type {number|null} */
    let id = null;
    if (!loading) {
      id = window.requestAnimationFrame(() => {
        if (searchInputRef.current === document.activeElement) {
          return;
        }
        if (visibleGames.length === 0) {
          rootRef.current?.focus?.();
          return;
        }
        focusFirstGame(gridRef.current);
      });
    }
    return () => {
      if (id !== null) {
        window.cancelAnimationFrame(id);
      }
    };
  }, [gridRef, loading, rootRef, searchInputRef, visibleGames.length]);

  useEffect(() => {
    /** @type {number|null} */
    let id = null;
    if (!loading && visibleGames.length > 0) {
      id = window.requestAnimationFrame(() => {
        const element = gridRef.current?.querySelector?.(
          `[data-immersive-index="${selectedIndex}"]`
        );
        if (!element) {
          return;
        }
        try {
          element.scrollIntoView?.({ block: "nearest", inline: "nearest" });
        } catch {
          // Ignore unavailable scrolling in test DOMs.
        }
      });
    }
    return () => {
      if (id !== null) {
        window.cancelAnimationFrame(id);
      }
    };
  }, [gridRef, loading, selectedIndex, visibleGames.length]);
};

/** @param {number} width Viewport width. */
const getColumnsForWidth = (width) => {
  if (width >= 1200) {
    return 6;
  }
  if (width >= 900) {
    return 4;
  }
  if (width >= 600) {
    return 3;
  }
  return 2;
};

const useColumnCount = () => {
  const [columns, setColumns] = useState(() =>
    getColumnsForWidth(window.innerWidth)
  );

  useEffect(() => {
    const handleResize = () => {
      setColumns(getColumnsForWidth(window.innerWidth));
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return columns;
};

/** @param {{games: ImmersiveGame[], selectedPlatform: string|null, searchQuery: string, section: string}} options Game-list dependencies. */
const useVisibleGames = ({ games, searchQuery, section, selectedPlatform }) => {
  const filteredGames = useMemo(
    () => filterVisibleGames(games, selectedPlatform, searchQuery),
    [games, searchQuery, selectedPlatform]
  );
  const favorites = useMemo(
    () => filteredGames.filter((game) => game.is_favorite === true),
    [filteredGames]
  );
  const recent = useMemo(() => {
    const played = filteredGames.filter(
      (game) =>
        game.last_played_at !== null &&
        game.last_played_at !== undefined &&
        game.last_played_at !== ""
    );
    return played
      .toSorted((a, b) => {
        const ax = String(a.last_played_at ?? "");
        const bx = String(b.last_played_at ?? "");
        return bx.localeCompare(ax);
      })
      .slice(0, 24);
  }, [filteredGames]);
  return useMemo(() => {
    if (section === "favorites") {
      return favorites;
    }
    if (section === "recent") {
      return recent;
    }
    return filteredGames;
  }, [favorites, filteredGames, recent, section]);
};

/** @param {LibraryDataOptions} options Library data dependencies. */
const useLibraryData = ({
  loading,
  games,
  platforms,
  selectedPlatform,
  searchQuery,
  selectedIndex,
  onSelectedIndexChange,
  controllerRouteRef,
}) => {
  const [section, setSection] = useState("all");
  const gridRef = useRef(initialGridRef());
  const localRootRef = useRef(initialRootRef());
  const rootRef = controllerRouteRef ?? localRootRef;
  const scrollRef = useRef(initialScrollRef());
  const searchInputRef = useRef(initialSearchInputRef());
  /** @type {(HTMLButtonElement|null)[]} */
  const initialPlatformButtonRefs = [];
  const platformButtonRefs = useRef(initialPlatformButtonRefs);
  const columns = useColumnCount();
  const platformOptions = useMemo(
    () => [
      { id: null, label: "All platforms" },
      ...platforms.map(([platform]) => ({
        id: platform.id,
        label: platform.name === "" ? platform.id : platform.name,
      })),
    ],
    [platforms]
  );
  const visibleGames = useVisibleGames({
    games,
    searchQuery,
    section,
    selectedPlatform,
  });

  useEffect(() => {
    if (selectedIndex >= visibleGames.length) {
      onSelectedIndexChange(Math.max(0, visibleGames.length - 1));
    }
  }, [selectedIndex, visibleGames.length, onSelectedIndexChange]);

  useLibraryFocusEffects({
    gridRef,
    loading,
    rootRef,
    searchInputRef,
    selectedIndex,
    visibleGames,
  });

  return {
    columns,
    gridRef,
    platformButtonRefs,
    platformOptions,
    rootRef,
    scrollRef,
    searchInputRef,
    section,
    setSection,
    visibleGames,
  };
};

/** @param {{data: ReturnType<typeof useLibraryData>, loading: boolean, onOpenSettings: () => void, onSelectGame: (game: ImmersiveGame) => void, onSelectedIndexChange: (index: number, game?: ImmersiveGame) => void, selectedIndex: number}} options Library interaction dependencies. */
const useLibraryInteractions = ({
  data,
  loading,
  onOpenSettings,
  onSelectGame,
  onSelectedIndexChange,
  selectedIndex,
}) => {
  const setSectionAndReset = useCallback(
    /** @param {string} next Next section. */
    (next) => {
      data.setSection(next);
      onSelectedIndexChange(0);
      data.rootRef.current?.focus?.();
    },
    [data, onSelectedIndexChange]
  );
  const cycleSection = useCallback(
    /** @param {number} delta Section movement. */
    (delta) => {
      const sections = ["all", "favorites", "recent"];
      const index = sections.indexOf(data.section);
      const next =
        sections[(index + delta + sections.length) % sections.length] ?? "all";
      setSectionAndReset(next);
      focusFirstGame(data.gridRef.current);
    },
    [data, setSectionAndReset]
  );
  const handleKeyDown = useCallback(
    /** @param {React.KeyboardEvent<HTMLDivElement>} event Keyboard event. */
    (event) => {
      handleLibraryKeyDown(event.nativeEvent, {
        cycleSection,
        data,
        loading,
        onOpenSettings,
        onSelectGame,
        onSelectedIndexChange,
        selectedIndex,
      });
    },
    [
      cycleSection,
      data,
      loading,
      onOpenSettings,
      onSelectGame,
      onSelectedIndexChange,
      selectedIndex,
    ]
  );
  const onPointerDown = useCallback(
    /** @param {React.PointerEvent<HTMLDivElement>} event Pointer event. */
    (event) => {
      if (!isTextInputTarget(event.target)) {
        data.rootRef.current?.focus?.();
      }
    },
    [data]
  );
  return { cycleSection, handleKeyDown, onPointerDown, setSectionAndReset };
};

/** @param {ImmersiveLibraryProps} props Immersive library properties. */
export const useImmersiveLibraryController = ({
  loading,
  error,
  games,
  platforms = EMPTY_PLATFORMS,
  selectedPlatform = null,
  onSelectedPlatformChange = () => null,
  searchQuery = "",
  onSearchChange = () => null,
  selectedIndex,
  onSelectedIndexChange,
  onSelectGame,
  onExitImmersive,
  onOpenSettings,
  onOpenDownloads,
  controllerRouteRef,
}) => {
  const { colors } = useAppTheme();
  const { getProgress, activeCount } = useRomDownloads();
  const data = useLibraryData({
    controllerRouteRef,
    games,
    loading,
    onSelectedIndexChange,
    platforms,
    searchQuery,
    selectedIndex,
    selectedPlatform,
  });
  const interactions = useLibraryInteractions({
    data,
    loading,
    onOpenSettings,
    onSelectGame,
    onSelectedIndexChange,
    selectedIndex,
  });

  return {
    activeCount,
    colors,
    columns: data.columns,
    error,
    getProgress,
    gridRef: data.gridRef,
    handleKeyDown: interactions.handleKeyDown,
    loading,
    onExitImmersive: () => {
      void onExitImmersive();
    },
    onOpenDownloads,
    onOpenSettings,
    onPointerDown: interactions.onPointerDown,
    onSearchChange,
    onSelectGame,
    onSelectedIndexChange,
    onSelectedPlatformChange,
    platformButtonRefs: data.platformButtonRefs,
    platformOptions: data.platformOptions,
    rootRef: data.rootRef,
    scrollRef: data.scrollRef,
    searchInputRef: data.searchInputRef,
    searchQuery,
    section: data.section,
    selectedIndex,
    selectedPlatform,
    setSectionAndReset: interactions.setSectionAndReset,
    visibleGames: data.visibleGames,
  };
};
