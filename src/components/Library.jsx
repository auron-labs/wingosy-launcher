import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import Pagination from "@mui/material/Pagination";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import CloudSyncIcon from "@mui/icons-material/CloudSync";
import GameCard from "./GameCard";
import KeyboardHint from "./KeyboardHint";
import { tauriDragRegionProps, tauriDragRegionSx, tauriNoDragProps, tauriNoDragSx } from "../utils/isTauri";
import { useRomDownloads } from "../RomDownloadsContext";
import { filterAndSortGames, GAME_FILTER_OPTIONS, GAME_SORT_OPTIONS } from "../utils/gameFilters";

export default function Library({
  games,
  total,
  page,
  pageSize,
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
  sortBy: controlledSortBy = null,
  filterBy: controlledFilterBy = null,
  onSortChange = null,
  onFilterChange = null,
}) {
  const { getProgress, getLaunchProgress } = useRomDownloads();
  const [localSortBy, setLocalSortBy] = useState("name");
  const [localFilterBy, setLocalFilterBy] = useState("all");
  const sortBy = controlledSortBy ?? localSortBy;
  const filterBy = controlledFilterBy ?? localFilterBy;
  const usesExternalFilter = controlledFilterBy !== null;
  const searchInputRef = useRef(null);
  const visibleGames = useMemo(
    () => filterAndSortGames(games, { searchQuery, filterBy, sortBy }),
    [games, searchQuery, filterBy, sortBy],
  );
  const resultCount = usesExternalFilter || filterBy === "all" ? total : visibleGames.length;
  const pageCount = usesExternalFilter || filterBy === "all" ? Math.ceil(total / pageSize) : 1;

  useEffect(() => {
    function focusSearch(event) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "f") return;
      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select?.();
    }

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const hasLocalFilter = filterBy !== "all";
  const hasSearch = Boolean(searchQuery);

  function handleSortChange(nextSortBy) {
    setLocalSortBy(nextSortBy);
    onSortChange?.(nextSortBy);
  }

  function handleFilterChange(nextFilterBy) {
    setLocalFilterBy(nextFilterBy);
    onFilterChange?.(nextFilterBy);
  }

  return (
    <Box sx={{ p: 3 }}>
      {error && (
        <Alert
          severity="error"
          onClose={onDismissError}
          sx={{ mb: 2 }}
          action={launchError ? (
            <Stack direction="row" spacing={0.5}>
              {onOpenSettings ? (
                <Button color="inherit" size="small" onClick={onOpenSettings}>
                  Open Settings
                </Button>
              ) : null}
              {launchError.retryable && onRetryLaunch ? (
                <Button color="inherit" size="small" onClick={onRetryLaunch}>
                  Retry
                </Button>
              ) : null}
            </Stack>
          ) : undefined}
        >
          {error}
          {launchError?.guidance ? (
            <Typography variant="body2" sx={{ display: "block", mt: 0.5 }}>
              {launchError.guidance}
            </Typography>
          ) : null}
        </Alert>
      )}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          mb: 3,
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          {...tauriDragRegionProps()}
          sx={{ flexShrink: 0, lineHeight: 1.2, ...tauriDragRegionSx }}
        >
          Library
        </Typography>
        <Box
          {...tauriDragRegionProps()}
          sx={{
            display: { xs: "none", sm: "block" },
            flex: 1,
            minWidth: 16,
            minHeight: 40,
            alignSelf: "stretch",
            ...tauriDragRegionSx,
          }}
        />
        <TextField
          {...tauriNoDragProps()}
          size="small"
          placeholder="Search games..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          sx={{
            width: "100%",
            maxWidth: { sm: 420 },
            flexShrink: 0,
            ...tauriNoDragSx,
          }}
          inputRef={searchInputRef}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title={hasSearch ? "Clear search" : "Clear search (no search entered)"}>
                    <span>
                      <IconButton
                        aria-label="Clear search"
                        onClick={() => onSearchChange("")}
                        disabled={!hasSearch}
                        edge="end"
                        size="small"
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </InputAdornment>
              ),
            },
          }}
        />
      </Stack>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ mb: 3, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between" }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", minHeight: 32 }}>
          <Typography variant="body2" color="text.secondary" data-testid="library-result-count">
            {resultCount} result{resultCount === 1 ? "" : "s"}
          </Typography>
          <KeyboardHint>Ctrl+F / ⌘F to search</KeyboardHint>
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <FormControl size="small" sx={{ minWidth: { sm: 180 } }}>
            <InputLabel id="library-sort-label">Sort by</InputLabel>
            <Select
              labelId="library-sort-label"
              id="library-sort"
              value={sortBy}
              label="Sort by"
              onChange={(event) => handleSortChange(event.target.value)}
            >
              {GAME_SORT_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: { sm: 180 } }}>
            <InputLabel id="library-filter-label">Filter</InputLabel>
            <Select
              labelId="library-filter-label"
              id="library-filter"
              value={filterBy}
              label="Filter"
              onChange={(event) => handleFilterChange(event.target.value)}
            >
              {GAME_FILTER_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Stack>

      {loading ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "60vh",
            gap: 2,
          }}
        >
          <CircularProgress color="primary" />
          <Typography variant="body2" color="text.secondary">
            Loading your library...
          </Typography>
        </Box>
      ) : visibleGames.length === 0 ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "60vh",
            color: "text.secondary",
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
            <Button variant="outlined" onClick={() => handleFilterChange("all")}>
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
      ) : (
        <>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(2, 1fr)",
                sm: "repeat(3, 1fr)",
                md: "repeat(4, 1fr)",
                lg: "repeat(5, 1fr)",
                xl: "repeat(6, 1fr)",
              },
              gap: 2.5,
              pb: 3,
            }}
          >
            {visibleGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                onClick={() => onSelectGame(game)}
                onToggleFavorite={() => onToggleFavorite(game.id)}
                onLaunch={() => onLaunchGame(game.id)}
                downloadProgress={getProgress(game.id)}
                launchProgress={getLaunchProgress(game.id)}
              />
            ))}
          </Box>
          {pageCount > 1 && (
            <Pagination
              count={pageCount}
              page={page}
              onChange={(_event, nextPage) => onPageChange(nextPage)}
              showFirstButton
              showLastButton
              color="primary"
              sx={{ display: "flex", justifyContent: "center", pb: 4 }}
            />
          )}
        </>
      )}
    </Box>
  );
}
