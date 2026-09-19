import CloudSyncIcon from "@mui/icons-material/CloudSync";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Pagination from "@mui/material/Pagination";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useRef, useState } from "react";

import { isTextInputTarget } from "../immersive/controller-debug";
import { useRomDownloads } from "../rom-downloads-context-value";
import { filterAndSortGames } from "../utils/game-filters";
import GameCard from "./game-card";
import {
  LibraryFilters,
  LibraryHeader,
  LibraryLaunchAlert,
} from "./library-controls";

/** @typedef {import("../utils/game-filters").Game & {romm_id?: number|null}} LibraryGame */
/** @typedef {"name"|"recent"|"play_time"|"play_count"|"release_year"} LibrarySortBy */
/** @typedef {"all"|"favorites"|"recent"} LibraryFilterBy */
/** @typedef {"all"|"downloaded"|"not_downloaded"} LibraryAvailability */
/** @typedef {{gameId: number|string, retryable: boolean, guidance?: string, message: string}|null} LibraryLaunchError */
/** @typedef {{games: LibraryGame[], total: number, page: number, pageSize: number, onPageChange: (page: number) => void, loading: boolean, searchQuery: string, onSearchChange: (value: string) => void, onSelectGame: (game: LibraryGame) => void, onToggleFavorite: (gameId: number|string) => void, onLaunchGame: (gameId: number|string) => void, onNavigateLibrarySettings: () => void, onNavigateRommSettings: () => void, onOpenSettings?: (() => void)|null, onRetryLaunch?: (() => void)|null, launchError?: LibraryLaunchError, error?: string|null, onDismissError: () => void, sortBy?: LibrarySortBy|null, sortDescending?: boolean|null, filterBy?: LibraryFilterBy|null, availability?: LibraryAvailability|null, onSortChange?: ((value: LibrarySortBy) => void)|null, onSortDirectionChange?: ((value: boolean) => void)|null, onFilterChange?: ((value: LibraryFilterBy) => void)|null, onAvailabilityChange?: ((value: LibraryAvailability) => void)|null}} LibraryProps */

/** @returns {LibrarySortBy} Initial sort mode. */
const initialLibrarySortBy = () => "name";
/** @returns {LibraryFilterBy} Initial filter mode. */
const initialLibraryFilterBy = () => "all";
/** @returns {LibraryAvailability} Initial availability filter. */
const initialLibraryAvailability = () => "all";
/** @returns {HTMLInputElement|null} Initial search input. */
const initialSearchInput = () => null;

/** @param {{getProgress: ReturnType<typeof useRomDownloads>["getProgress"], getLaunchProgress: ReturnType<typeof useRomDownloads>["getLaunchProgress"], onLaunchGame: (gameId: number|string) => void, onPageChange: (page: number) => void, onSelectGame: (game: LibraryGame) => void, onToggleFavorite: (gameId: number|string) => void, page: number, pageCount: number, visibleGames: LibraryGame[]}} props Library results properties. */
const LibraryResults = ({
  getLaunchProgress,
  getProgress,
  onLaunchGame,
  onPageChange,
  onSelectGame,
  onToggleFavorite,
  page,
  pageCount,
  visibleGames,
}) => (
  <>
    <Box
      sx={{
        display: "grid",
        gap: 2.5,
        gridTemplateColumns: {
          lg: "repeat(5, 1fr)",
          md: "repeat(4, 1fr)",
          sm: "repeat(3, 1fr)",
          xl: "repeat(6, 1fr)",
          xs: "repeat(2, 1fr)",
        },
        pb: 3,
      }}
    >
      {visibleGames.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          onClick={() => {
            onSelectGame(game);
          }}
          onToggleFavorite={() => {
            onToggleFavorite(game.id);
          }}
          onLaunch={() => {
            onLaunchGame(game.id);
          }}
          downloadProgress={getProgress(game.id)}
          launchProgress={getLaunchProgress(game.id)}
        />
      ))}
    </Box>
    {pageCount > 1 && (
      <Pagination
        count={pageCount}
        page={page}
        onChange={(_event, nextPage) => {
          onPageChange(nextPage);
        }}
        showFirstButton
        showLastButton
        color="primary"
        sx={{ display: "flex", justifyContent: "center", pb: 4 }}
      />
    )}
  </>
);

/** @param {{hasLocalFilter: boolean, onNavigateLibrarySettings: () => void, onNavigateRommSettings: () => void, onShowAll: () => void}} props Empty library properties. */
const LibraryEmptyState = ({
  hasLocalFilter,
  onNavigateLibrarySettings,
  onNavigateRommSettings,
  onShowAll,
}) => (
  <Box
    sx={{
      alignItems: "center",
      color: "text.secondary",
      display: "flex",
      flexDirection: "column",
      height: "60vh",
      justifyContent: "center",
    }}
  >
    <Typography variant="h6" gutterBottom>
      {hasLocalFilter ? "No games match this filter" : "No games found"}
    </Typography>
    <Typography variant="body2" sx={{ mb: 3 }}>
      {hasLocalFilter
        ? "Try another filter, clear your search, or show all games."
        : "Scan a local ROM folder or sync from your RomM server."}
    </Typography>
    {hasLocalFilter ? (
      <Button variant="outlined" onClick={onShowAll}>
        Show all games
      </Button>
    ) : (
      <Box sx={{ display: "flex", gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<FolderOpenIcon />}
          onClick={onNavigateLibrarySettings}
        >
          Scan ROM Folder
        </Button>
        <Button
          variant="outlined"
          startIcon={<CloudSyncIcon />}
          onClick={onNavigateRommSettings}
          color="info"
        >
          Sync from RomM
        </Button>
      </Box>
    )}
  </Box>
);

/** @param {{loading: boolean, visibleGames: LibraryGame[], hasLocalFilter: boolean, onNavigateLibrarySettings: () => void, onNavigateRommSettings: () => void, onShowAll: () => void, results: import("react").ReactNode}} props Library body properties. @returns {import("react").ReactNode} Library body. */
const LibraryBody = ({
  hasLocalFilter,
  loading,
  onNavigateLibrarySettings,
  onNavigateRommSettings,
  onShowAll,
  results,
  visibleGames,
}) => {
  if (loading) {
    return (
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          height: "60vh",
          justifyContent: "center",
        }}
      >
        <CircularProgress color="primary" />
        <Typography variant="body2" color="text.secondary">
          Loading your library...
        </Typography>
      </Box>
    );
  }
  if (visibleGames.length === 0) {
    return (
      <LibraryEmptyState
        hasLocalFilter={hasLocalFilter}
        onNavigateLibrarySettings={onNavigateLibrarySettings}
        onNavigateRommSettings={onNavigateRommSettings}
        onShowAll={onShowAll}
      />
    );
  }
  return results;
};

/** @param {{current: HTMLInputElement|null}} searchInputRef Search input reference. @param {(value: string) => void} onSearchChange Search setter. */
const useLibrarySearchShortcut = (searchInputRef, onSearchChange) => {
  useEffect(() => {
    /** @param {KeyboardEvent} event Keyboard input. */
    const focusSearch = (event) => {
      const hasModifier =
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;
      if (
        event.key === "/" &&
        !hasModifier &&
        !isTextInputTarget(event.target)
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select?.();
        return;
      }
      if (
        event.key === "Escape" &&
        document.activeElement === searchInputRef.current
      ) {
        event.preventDefault();
        onSearchChange("");
        return;
      }
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== "f"
      ) {
        return;
      }
      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select?.();
    };

    window.addEventListener("keydown", focusSearch);
    return () => {
      window.removeEventListener("keydown", focusSearch);
    };
  }, [onSearchChange, searchInputRef]);
};

/** @param {{sortBy: LibrarySortBy|null, filterBy: LibraryFilterBy|null, availability: LibraryAvailability|null}} controls Library query controls. @returns {boolean} Whether the app owns query filtering. */
const hasControlledLibraryQuery = ({ sortBy, filterBy, availability }) =>
  [availability, filterBy, sortBy].some(
    (value) => value !== null && value !== undefined
  );

/** @param {LibraryFilterBy|null} filterBy Active primary filter. @param {{current: HTMLInputElement|null}} searchInputRef Search input reference. */
const useFavoriteSearchFocus = (filterBy, searchInputRef) => {
  useEffect(() => {
    if (filterBy === "favorites") {
      searchInputRef.current?.focus();
    }
  }, [filterBy, searchInputRef]);
};

/** @param {LibraryFilterBy|null} filterBy Active primary filter. @param {{current: HTMLInputElement|null}} searchInputRef Search input reference. @param {(value: string) => void} onSearchChange Search setter. */
const useLibraryControlEffects = (filterBy, searchInputRef, onSearchChange) => {
  useLibrarySearchShortcut(searchInputRef, onSearchChange);
  useFavoriteSearchFocus(filterBy, searchInputRef);
};

/** @param {(value: string) => void} onSearchChange Search setter. @param {(value: LibraryFilterBy) => void} handleFilterChange Primary filter setter. @param {(value: LibraryAvailability) => void} handleAvailabilityChange Availability setter. */
const resetLibraryFilters = (
  onSearchChange,
  handleFilterChange,
  handleAvailabilityChange
) => {
  onSearchChange("");
  handleFilterChange("all");
  handleAvailabilityChange("all");
};

/** @param {(value: string) => void} onSearchChange Search setter. @param {(value: LibraryFilterBy) => void} handleFilterChange Primary filter setter. @param {(value: LibraryAvailability) => void} handleAvailabilityChange Availability setter. @returns {() => void} Empty-state reset handler. */
const createShowAllHandler =
  (onSearchChange, handleFilterChange, handleAvailabilityChange) => () => {
    resetLibraryFilters(
      onSearchChange,
      handleFilterChange,
      handleAvailabilityChange
    );
  };

/** @param {{availability: LibraryAvailability, filterBy: LibraryFilterBy, games: LibraryGame[], hasControlledQuery: boolean, searchQuery: string, sortBy: LibrarySortBy, sortDescending: boolean}} options Library result inputs. @returns {LibraryGame[]} Games to render. */
const getVisibleLibraryGames = ({
  availability,
  filterBy,
  games,
  hasControlledQuery,
  searchQuery,
  sortBy,
  sortDescending,
}) => {
  if (hasControlledQuery) {
    return games;
  }
  return filterAndSortGames(games, {
    availability,
    filterBy,
    searchQuery,
    sortBy,
    sortDescending,
  });
};

/** @param {{onAvailabilityChange: ((value: LibraryAvailability) => void)|null, onFilterChange: ((value: LibraryFilterBy) => void)|null, onSortChange: ((value: LibrarySortBy) => void)|null, onSortDirectionChange: ((value: boolean) => void)|null, setLocalAvailability: (value: LibraryAvailability) => void, setLocalFilterBy: (value: LibraryFilterBy) => void, setLocalSortBy: (value: LibrarySortBy) => void, setLocalSortDescending: (value: boolean) => void}} options Library control action dependencies. */
const useLibraryControlActions = ({
  onAvailabilityChange,
  onFilterChange,
  onSortChange,
  onSortDirectionChange,
  setLocalAvailability,
  setLocalFilterBy,
  setLocalSortBy,
  setLocalSortDescending,
}) => {
  /** @param {LibrarySortBy} nextSortBy Next sort mode. */
  const handleSortChange = (nextSortBy) => {
    setLocalSortBy(nextSortBy);
    setLocalSortDescending(nextSortBy !== "name");
    onSortChange?.(nextSortBy);
  };

  /** @param {boolean} nextSortDescending Next sort direction. */
  const handleSortDirectionChange = (nextSortDescending) => {
    setLocalSortDescending(nextSortDescending);
    onSortDirectionChange?.(nextSortDescending);
  };

  /** @param {LibraryFilterBy} nextFilterBy Next filter mode. */
  const handleFilterChange = (nextFilterBy) => {
    setLocalFilterBy(nextFilterBy);
    onFilterChange?.(nextFilterBy);
  };

  /** @param {LibraryAvailability} nextAvailability Next availability filter. */
  const handleAvailabilityChange = (nextAvailability) => {
    setLocalAvailability(nextAvailability);
    onAvailabilityChange?.(nextAvailability);
  };

  return {
    handleAvailabilityChange,
    handleFilterChange,
    handleSortChange,
    handleSortDirectionChange,
  };
};

/** @param {Pick<LibraryProps, "games"|"searchQuery"|"onSearchChange"|"sortBy"|"sortDescending"|"filterBy"|"availability"|"onSortChange"|"onSortDirectionChange"|"onFilterChange"|"onAvailabilityChange">} props Library control properties. */
const useLibraryControls = ({
  availability: controlledAvailability = null,
  filterBy: controlledFilterBy = null,
  games,
  onAvailabilityChange = null,
  onFilterChange = null,
  onSearchChange,
  onSortChange = null,
  onSortDirectionChange = null,
  searchQuery,
  sortBy: controlledSortBy = null,
  sortDescending: controlledSortDescending = null,
}) => {
  const [localSortBy, setLocalSortBy] = useState(initialLibrarySortBy);
  const [localSortDescending, setLocalSortDescending] = useState(false);
  const [localFilterBy, setLocalFilterBy] = useState(initialLibraryFilterBy);
  const [localAvailability, setLocalAvailability] = useState(
    initialLibraryAvailability
  );
  const sortBy = controlledSortBy ?? localSortBy;
  const sortDescending = controlledSortDescending ?? localSortDescending;
  const filterBy = controlledFilterBy ?? localFilterBy;
  const availability = controlledAvailability ?? localAvailability;
  const searchInputRef = useRef(initialSearchInput());
  const hasControlledQuery = hasControlledLibraryQuery({
    availability: controlledAvailability,
    filterBy: controlledFilterBy,
    sortBy: controlledSortBy,
  });
  useLibraryControlEffects(controlledFilterBy, searchInputRef, onSearchChange);
  const actions = useLibraryControlActions({
    onAvailabilityChange,
    onFilterChange,
    onSortChange,
    onSortDirectionChange,
    setLocalAvailability,
    setLocalFilterBy,
    setLocalSortBy,
    setLocalSortDescending,
  });
  const visibleGames = useMemo(
    () =>
      getVisibleLibraryGames({
        availability,
        filterBy,
        games,
        hasControlledQuery,
        searchQuery,
        sortBy,
        sortDescending,
      }),
    [
      availability,
      filterBy,
      games,
      hasControlledQuery,
      searchQuery,
      sortBy,
      sortDescending,
    ]
  );

  return {
    ...actions,
    availability,
    filterBy,
    hasLocalFilter:
      searchQuery.trim() !== "" || filterBy !== "all" || availability !== "all",
    searchInputRef,
    sortBy,
    sortDescending,
    visibleGames,
  };
};

/** @param {{availability: LibraryAvailability, error?: string|null, filterBy: LibraryFilterBy, handleAvailabilityChange: (value: LibraryAvailability) => void, handleFilterChange: (value: LibraryFilterBy) => void, handleSortChange: (value: LibrarySortBy) => void, handleSortDirectionChange: (value: boolean) => void, launchError?: LibraryLaunchError, onDismissError: () => void, onOpenSettings?: (() => void)|null, onRetryLaunch?: (() => void)|null, onSearchChange: (value: string) => void, resultCount: number, searchInputRef: {current: HTMLInputElement|null}, searchQuery: string, sortBy: LibrarySortBy, sortDescending: boolean}} props Library control panel properties. */
const LibraryControlPanel = ({
  availability,
  error,
  filterBy,
  handleAvailabilityChange,
  handleFilterChange,
  handleSortChange,
  handleSortDirectionChange,
  launchError = null,
  onDismissError,
  onOpenSettings = null,
  onRetryLaunch = null,
  onSearchChange,
  resultCount,
  searchInputRef,
  searchQuery,
  sortBy,
  sortDescending,
}) => (
  <>
    <LibraryLaunchAlert
      error={error}
      launchError={launchError}
      onDismissError={onDismissError}
      onOpenSettings={onOpenSettings}
      onRetryLaunch={onRetryLaunch}
    />
    <LibraryHeader
      onSearchChange={onSearchChange}
      searchInputRef={searchInputRef}
      searchQuery={searchQuery}
    />
    <LibraryFilters
      availability={availability}
      filterBy={filterBy}
      handleAvailabilityChange={handleAvailabilityChange}
      handleFilterChange={handleFilterChange}
      handleSortChange={handleSortChange}
      handleSortDirectionChange={handleSortDirectionChange}
      resultCount={resultCount}
      sortBy={sortBy}
      sortDescending={sortDescending}
    />
  </>
);

/** @param {LibraryProps & {getProgress: ReturnType<typeof useRomDownloads>["getProgress"], getLaunchProgress: ReturnType<typeof useRomDownloads>["getLaunchProgress"], availability: LibraryAvailability, filterBy: LibraryFilterBy, sortBy: LibrarySortBy, sortDescending: boolean, handleAvailabilityChange: (value: LibraryAvailability) => void, handleFilterChange: (value: LibraryFilterBy) => void, handleSortChange: (value: LibrarySortBy) => void, handleSortDirectionChange: (value: boolean) => void, hasLocalFilter: boolean, resultCount: number, pageCount: number, searchInputRef: {current: HTMLInputElement|null}, visibleGames: LibraryGame[]}} props Library content properties. */
const LibraryContent = ({
  page,
  onPageChange,
  loading,
  onSearchChange,
  onSelectGame,
  onToggleFavorite,
  onLaunchGame,
  onNavigateLibrarySettings,
  onNavigateRommSettings,
  getProgress,
  getLaunchProgress,
  handleAvailabilityChange,
  handleFilterChange,
  hasLocalFilter,
  pageCount,
  resultCount,
  visibleGames,
  ...controlProps
}) => (
  <Box sx={{ p: 3 }}>
    <LibraryControlPanel
      {...controlProps}
      handleAvailabilityChange={handleAvailabilityChange}
      handleFilterChange={handleFilterChange}
      onSearchChange={onSearchChange}
      resultCount={resultCount}
    />
    <LibraryBody
      hasLocalFilter={hasLocalFilter}
      loading={loading}
      onNavigateLibrarySettings={onNavigateLibrarySettings}
      onNavigateRommSettings={onNavigateRommSettings}
      onShowAll={createShowAllHandler(
        onSearchChange,
        handleFilterChange,
        handleAvailabilityChange
      )}
      results={
        <LibraryResults
          getLaunchProgress={getLaunchProgress}
          getProgress={getProgress}
          onLaunchGame={onLaunchGame}
          onPageChange={onPageChange}
          onSelectGame={onSelectGame}
          onToggleFavorite={onToggleFavorite}
          page={page}
          pageCount={pageCount}
          visibleGames={visibleGames}
        />
      }
      visibleGames={visibleGames}
    />
  </Box>
);

/** @param {LibraryProps} props Library properties. */
const Library = (props) => {
  const { getProgress, getLaunchProgress } = useRomDownloads();
  const controls = useLibraryControls(props);
  const usesExternalQuery = [
    props.availability,
    props.filterBy,
    props.sortBy,
  ].some((value) => value !== null && value !== undefined);
  const resultCount =
    usesExternalQuery ||
    (controls.filterBy === "all" && controls.availability === "all")
      ? props.total
      : controls.visibleGames.length;
  const pageCount =
    usesExternalQuery ||
    (controls.filterBy === "all" && controls.availability === "all")
      ? Math.ceil(props.total / props.pageSize)
      : 1;

  return (
    <LibraryContent
      {...props}
      {...controls}
      getLaunchProgress={getLaunchProgress}
      getProgress={getProgress}
      pageCount={pageCount}
      resultCount={resultCount}
    />
  );
};

export default Library;
