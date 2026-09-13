import CloudSyncIcon from "@mui/icons-material/CloudSync";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Pagination from "@mui/material/Pagination";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useRef, useState } from "react";

import { useRomDownloads } from "../rom-downloads-context-value";
import { filterAndSortGames } from "../utils/game-filters";
import GameCard from "./game-card";
import {
  LibraryFilters,
  LibraryHeader,
  LibraryLaunchAlert,
} from "./library-controls";

/** @typedef {import("../utils/game-filters").Game & {romm_id?: number|null}} LibraryGame */
/** @typedef {"name"|"recent"|"play_time"} LibrarySortBy */
/** @typedef {"all"|"favorites"|"recent"|"downloaded"|"not_downloaded"} LibraryFilterBy */
/** @typedef {{gameId: number|string, retryable: boolean, guidance?: string, message: string}|null} LibraryLaunchError */
/** @typedef {{games: LibraryGame[], total: number, page: number, pageSize: number, onPageChange: (page: number) => void, loading: boolean, searchQuery: string, onSearchChange: (value: string) => void, onSelectGame: (game: LibraryGame) => void, onToggleFavorite: (gameId: number|string) => void, onLaunchGame: (gameId: number|string) => void, onNavigateLibrarySettings: () => void, onNavigateRommSettings: () => void, onOpenSettings?: (() => void)|null, onRetryLaunch?: (() => void)|null, launchError?: LibraryLaunchError, error?: string|null, onDismissError: () => void, sortBy?: LibrarySortBy|null, filterBy?: LibraryFilterBy|null, onSortChange?: ((value: LibrarySortBy) => void)|null, onFilterChange?: ((value: LibraryFilterBy) => void)|null}} LibraryProps */

/** @returns {LibrarySortBy} Initial sort mode. */
const initialLibrarySortBy = () => "name";
/** @returns {LibraryFilterBy} Initial filter mode. */
const initialLibraryFilterBy = () => "all";
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
        ? "Try another filter or show all games."
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

/** @param {Pick<LibraryProps, "games"|"searchQuery"|"sortBy"|"filterBy"|"onSortChange"|"onFilterChange">} props Library control properties. */
const useLibraryControls = ({
  filterBy: controlledFilterBy = null,
  games,
  onFilterChange = null,
  onSortChange = null,
  searchQuery,
  sortBy: controlledSortBy = null,
}) => {
  const [localSortBy, setLocalSortBy] = useState(initialLibrarySortBy);
  const [localFilterBy, setLocalFilterBy] = useState(initialLibraryFilterBy);
  const sortBy = controlledSortBy ?? localSortBy;
  const filterBy = controlledFilterBy ?? localFilterBy;
  const searchInputRef = useRef(initialSearchInput());
  const visibleGames = useMemo(
    () => filterAndSortGames(games, { filterBy, searchQuery, sortBy }),
    [games, searchQuery, filterBy, sortBy]
  );

  useEffect(() => {
    /** @param {KeyboardEvent} event Keyboard input. */
    const focusSearch = (event) => {
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
  }, []);

  useEffect(() => {
    if (controlledFilterBy === "favorites") {
      searchInputRef.current?.focus();
    }
  }, [controlledFilterBy]);

  /** @param {LibrarySortBy} nextSortBy Next sort mode. */
  const handleSortChange = (nextSortBy) => {
    setLocalSortBy(nextSortBy);
    onSortChange?.(nextSortBy);
  };

  /** @param {LibraryFilterBy} nextFilterBy Next filter mode. */
  const handleFilterChange = (nextFilterBy) => {
    setLocalFilterBy(nextFilterBy);
    onFilterChange?.(nextFilterBy);
  };

  return {
    filterBy,
    handleFilterChange,
    handleSortChange,
    hasLocalFilter: filterBy !== "all",
    searchInputRef,
    sortBy,
    visibleGames,
  };
};

/** @param {LibraryProps & {getProgress: ReturnType<typeof useRomDownloads>["getProgress"], getLaunchProgress: ReturnType<typeof useRomDownloads>["getLaunchProgress"], filterBy: LibraryFilterBy, sortBy: LibrarySortBy, handleFilterChange: (value: LibraryFilterBy) => void, handleSortChange: (value: LibrarySortBy) => void, hasLocalFilter: boolean, resultCount: number, pageCount: number, searchInputRef: {current: HTMLInputElement|null}, visibleGames: LibraryGame[]}} props Library content properties. */
const LibraryContent = ({
  page,
  onPageChange,
  loading,
  searchQuery,
  onSearchChange,
  onSelectGame,
  onToggleFavorite,
  onLaunchGame,
  onNavigateLibrarySettings,
  onNavigateRommSettings,
  onOpenSettings = null,
  onRetryLaunch = null,
  launchError = null,
  error,
  onDismissError,
  getProgress,
  getLaunchProgress,
  handleFilterChange,
  handleSortChange,
  hasLocalFilter,
  pageCount,
  resultCount,
  searchInputRef,
  sortBy,
  filterBy,
  visibleGames,
}) => (
  <Box sx={{ p: 3 }}>
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
      filterBy={filterBy}
      handleFilterChange={handleFilterChange}
      handleSortChange={handleSortChange}
      resultCount={resultCount}
      sortBy={sortBy}
    />
    <LibraryBody
      hasLocalFilter={hasLocalFilter}
      loading={loading}
      onNavigateLibrarySettings={onNavigateLibrarySettings}
      onNavigateRommSettings={onNavigateRommSettings}
      onShowAll={() => {
        handleFilterChange("all");
      }}
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
  const usesExternalFilter =
    props.filterBy !== null && props.filterBy !== undefined;
  const resultCount =
    usesExternalFilter || controls.filterBy === "all"
      ? props.total
      : controls.visibleGames.length;
  const pageCount =
    usesExternalFilter || controls.filterBy === "all"
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
