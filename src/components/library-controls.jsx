import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { GAME_FILTER_OPTIONS, GAME_SORT_OPTIONS } from "../utils/gameFilters";
import {
  tauriDragRegionProps,
  tauriDragRegionSx,
  tauriNoDragProps,
  tauriNoDragSx,
} from "../utils/isTauri";
import KeyboardHint from "./KeyboardHint";

/** @typedef {Pick<import("./Library").LibraryProps, "searchQuery"|"onSearchChange"> & {searchInputRef: import("react").RefObject<HTMLInputElement|null>}} LibrarySearchProps */

/** @param {LibrarySearchProps} props Controlled search input. */
const LibrarySearch = ({ searchQuery, onSearchChange, searchInputRef }) => {
  const hasSearch = searchQuery !== "";
  return (
    <TextField
      {...tauriNoDragProps()}
      size="small"
      placeholder="Search games..."
      value={searchQuery}
      onChange={(event) => {
        onSearchChange(event.target.value);
      }}
      sx={{
        flexShrink: 0,
        maxWidth: { sm: 420 },
        width: "100%",
        ...tauriNoDragSx,
      }}
      inputRef={searchInputRef}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip
                title={
                  hasSearch
                    ? "Clear search"
                    : "Clear search (no search entered)"
                }
              >
                <span>
                  <IconButton
                    aria-label="Clear search"
                    onClick={() => {
                      onSearchChange("");
                    }}
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
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
        },
      }}
    />
  );
};

/** @param {LibrarySearchProps} props Library title and search. */
export const LibraryHeader = (props) => (
  <Stack
    direction={{ sm: "row", xs: "column" }}
    spacing={2}
    sx={{
      alignItems: { sm: "center", xs: "stretch" },
      justifyContent: "space-between",
      mb: 3,
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
        alignSelf: "stretch",
        display: { sm: "block", xs: "none" },
        flex: 1,
        minHeight: 40,
        minWidth: 16,
        ...tauriDragRegionSx,
      }}
    />
    <LibrarySearch {...props} />
  </Stack>
);

/** @param {{resultCount: number, sortBy: import("./Library").LibrarySortBy, filterBy: import("./Library").LibraryFilterBy, handleSortChange: (value: import("./Library").LibrarySortBy) => void, handleFilterChange: (value: import("./Library").LibraryFilterBy) => void}} props Result count and view controls. */
export const LibraryFilters = ({
  resultCount,
  sortBy,
  filterBy,
  handleSortChange,
  handleFilterChange,
}) => (
  <Stack
    direction={{ sm: "row", xs: "column" }}
    spacing={1.5}
    sx={{
      alignItems: { sm: "center", xs: "stretch" },
      justifyContent: "space-between",
      mb: 3,
    }}
  >
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: "center", minHeight: 32 }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        data-testid="library-result-count"
      >
        {resultCount} result{resultCount === 1 ? "" : "s"}
      </Typography>
      <KeyboardHint>Ctrl+F / ⌘F to search</KeyboardHint>
    </Stack>

    <Stack direction={{ sm: "row", xs: "column" }} spacing={1}>
      <FormControl size="small" sx={{ minWidth: { sm: 180 } }}>
        <InputLabel id="library-sort-label">Sort by</InputLabel>
        <Select
          labelId="library-sort-label"
          id="library-sort"
          value={sortBy}
          label="Sort by"
          onChange={(event) => {
            const option = GAME_SORT_OPTIONS.find(
              ({ value }) => value === event.target.value
            );
            if (option !== undefined) {
              handleSortChange(option.value);
            }
          }}
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
          onChange={(event) => {
            const option = GAME_FILTER_OPTIONS.find(
              ({ value }) => value === event.target.value
            );
            if (option !== undefined) {
              handleFilterChange(option.value);
            }
          }}
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
);

/** @param {Pick<import("./Library").LibraryProps, "error"|"launchError"|"onDismissError"|"onOpenSettings"|"onRetryLaunch">} props Current error and recovery actions. */
export const LibraryLaunchAlert = ({
  error,
  launchError,
  onDismissError,
  onOpenSettings,
  onRetryLaunch,
}) => {
  if (error === undefined || error === null || error === "") {
    return null;
  }
  const guidance = launchError?.guidance ?? "";
  return (
    <Alert
      severity="error"
      onClose={onDismissError}
      sx={{ mb: 2 }}
      action={
        launchError ? (
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
        ) : undefined
      }
    >
      {error}
      {guidance !== "" ? (
        <Typography variant="body2" sx={{ display: "block", mt: 0.5 }}>
          {guidance}
        </Typography>
      ) : null}
    </Alert>
  );
};
