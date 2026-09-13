import ClearIcon from "@mui/icons-material/Clear";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import SearchIcon from "@mui/icons-material/Search";
import Alert from "@mui/material/Alert";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import LauncherIcon from "../components/launcher-icon";
import ImmersiveGameTile from "./immersive-game-tile";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {{id: string|null, label: string}} PlatformOption */
/** @typedef {{downloaded?: number|null, total?: number|null, percent?: number|null}|null} DownloadProgress */
/** @typedef {import("@mui/material/styles").Theme} Theme */

const SECTIONS = ["all", "favorites", "recent"];

/** @param {boolean} active Whether this button is selected. @returns {(theme: Theme) => string} Border style resolver. */
const getNavigationBorder =
  (active) =>
  /** @param {Theme} theme MUI theme. */
  (theme) =>
    active ? "none" : `1px solid ${alpha(theme.palette.divider, 0.5)}`;

/** @param {string} section Section identifier. @returns {string} Display label. */
const getSectionLabel = (section) => {
  switch (section) {
    case "favorites": {
      return "Favorites";
    }
    case "recent": {
      return "Recent";
    }
    default: {
      return "All";
    }
  }
};

/** @param {boolean} active Whether this button is selected. @param {string} primary Theme primary color. @param {number} glowOpacity Glow opacity. */
const navigationButtonSx = (active, primary, glowOpacity = 0.45) => ({
  "&:hover": {
    bgcolor: active ? "primary.dark" : alpha(primary, 0.12),
    color: active ? "#fff" : "text.primary",
  },
  bgcolor: active ? "primary.main" : "transparent",
  border: getNavigationBorder(active),
  borderRadius: 1.5,
  boxShadow: active ? `0 0 12px ${alpha(primary, glowOpacity)}` : "none",
  color: active ? "#fff" : "text.secondary",
  fontWeight: active ? 800 : 600,
  lineHeight: 1.2,
  minWidth: 0,
  textTransform: "none",
});

/** @param {{section: string, setSectionAndReset: (section: string) => void, primary: string}} props Section button properties. */
const SectionButtons = ({ section, setSectionAndReset, primary }) => (
  <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
    {SECTIONS.map((key) => (
      <Button
        key={key}
        onClick={() => {
          setSectionAndReset(key);
        }}
        sx={{
          ...navigationButtonSx(section === key, primary),
          fontSize: { sm: "1rem", xs: "0.95rem" },
          minHeight: 44,
          px: 2,
          py: 0.9,
        }}
      >
        {getSectionLabel(key)}
      </Button>
    ))}
  </Stack>
);

/** @param {{platformOptions: PlatformOption[], selectedPlatform: string|null, platformButtonRefs: {current: (HTMLButtonElement|null)[]}, onSelectedPlatformChange: (platform: string|null) => void, primary: string}} props Platform button properties. */
const PlatformButtons = ({
  platformOptions,
  selectedPlatform,
  platformButtonRefs,
  onSelectedPlatformChange,
  primary,
}) => (
  <Box sx={{ mt: 1.5 }}>
    <Typography
      variant="overline"
      color="text.secondary"
      sx={{
        display: "block",
        fontWeight: 700,
        letterSpacing: "0.08em",
        mb: 0.5,
      }}
    >
      Platforms
    </Typography>
    <Stack direction="row" spacing={0.75} sx={{ overflowX: "auto", pb: 0.5 }}>
      {platformOptions.map((platform, index) => (
        <Button
          key={platform.id ?? "all-platforms"}
          ref={(element) => {
            platformButtonRefs.current[index] = element;
          }}
          data-immersive-platform-filter={platform.id ?? "all"}
          aria-pressed={selectedPlatform === platform.id}
          onClick={() => {
            onSelectedPlatformChange(platform.id);
          }}
          sx={{
            ...navigationButtonSx(
              selectedPlatform === platform.id,
              primary,
              0.4
            ),
            flexShrink: 0,
            px: 1.5,
            py: 0.5,
          }}
        >
          {platform.label}
        </Button>
      ))}
    </Stack>
  </Box>
);

/** @param {{activeCount: number, onOpenDownloads?: () => void, onOpenSettings: () => void, onExitImmersive: () => void, primary: string}} props Utility button properties. */
const UtilityButtons = ({
  activeCount,
  onOpenDownloads,
  onOpenSettings,
  onExitImmersive,
  primary,
}) => {
  const sx = navigationButtonSx(false, primary);
  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{ flexWrap: "wrap", rowGap: 0.75 }}
    >
      {onOpenDownloads ? (
        <Badge
          color="primary"
          badgeContent={Math.max(activeCount, 0)}
          invisible={activeCount === 0}
          max={99}
        >
          <Button
            startIcon={<CloudDownloadIcon />}
            onClick={onOpenDownloads}
            sx={{ ...sx, px: 1.5, py: 0.5 }}
          >
            Downloads
          </Button>
        </Badge>
      ) : null}
      <Button onClick={onOpenSettings} sx={{ ...sx, px: 1.5, py: 0.5 }}>
        Settings
      </Button>
      <Button
        data-testid="immersive-exit-to-desktop"
        onClick={onExitImmersive}
        sx={{ ...sx, px: 1.5, py: 0.5 }}
      >
        Exit to desktop
      </Button>
    </Stack>
  );
};

/** @param {{searchInputRef: {current: HTMLInputElement|null}, searchQuery: string, onSearchChange: (query: string) => void}} props Search properties. */
const SearchField = ({ searchInputRef, searchQuery, onSearchChange }) => (
  <TextField
    inputRef={searchInputRef}
    data-testid="immersive-game-search"
    label="Search games by name"
    placeholder="Search by game name"
    size="small"
    value={searchQuery}
    onChange={(event) => {
      onSearchChange(event.target.value);
    }}
    sx={{ maxWidth: 420, mt: 1.5, width: "100%" }}
    slotProps={{
      input: {
        endAdornment:
          searchQuery === "" ? null : (
            <InputAdornment position="end">
              <IconButton
                aria-label="Clear game search"
                edge="end"
                size="small"
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  onSearchChange("");
                  searchInputRef.current?.focus?.();
                }}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
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

/** @param {{searchQuery: string}} props Empty game list properties. */
const EmptyLibrary = ({ searchQuery }) => {
  const hasSearch = searchQuery.trim() !== "";
  return (
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        height: "60vh",
        justifyContent: "center",
      }}
    >
      <Stack spacing={1} sx={{ alignItems: "center", textAlign: "center" }}>
        <Typography variant="h5" color="text.secondary">
          {hasSearch ? "No games match your search." : "No games found."}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {hasSearch
            ? "Try a different game name or clear your search."
            : "Try another platform or section."}
        </Typography>
      </Stack>
    </Box>
  );
};

/** @param {{gridRef: {current: HTMLElement|null}, columns: number, selectedIndex: number, visibleGames: ImmersiveGame[], getProgress: (id: number|string) => DownloadProgress, onSelectedIndexChange: (index: number, game?: ImmersiveGame) => void, onSelectGame: (game: ImmersiveGame) => void}} props Game grid properties. */
const GameGrid = ({
  columns,
  getProgress,
  gridRef,
  onSelectGame,
  onSelectedIndexChange,
  selectedIndex,
  visibleGames,
}) => (
  <Box
    ref={gridRef}
    data-testid="immersive-grid"
    sx={{
      display: "grid",
      gap: { md: 2.5, sm: 2, xs: 1.5 },
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    }}
  >
    {visibleGames.map((game, index) => (
      <Box key={game.id} data-immersive-index={index} sx={{ p: 0.5 }}>
        <ImmersiveGameTile
          game={game}
          focused={index === selectedIndex}
          onFocus={() => {
            onSelectedIndexChange(index, game);
          }}
          onSelect={() => {
            onSelectGame(game);
          }}
          downloadProgress={getProgress(game.id)}
        />
      </Box>
    ))}
  </Box>
);

/** @param {{loading: boolean, searchQuery: string, visibleGames: ImmersiveGame[], gridRef: {current: HTMLElement|null}, columns: number, selectedIndex: number, getProgress: (id: number|string) => DownloadProgress, onSelectedIndexChange: (index: number, game?: ImmersiveGame) => void, onSelectGame: (game: ImmersiveGame) => void}} props Game body properties. */
const LibraryBody = (props) => {
  if (props.loading) {
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
          Loading your library…
        </Typography>
      </Box>
    );
  }
  if (props.visibleGames.length === 0) {
    return <EmptyLibrary searchQuery={props.searchQuery} />;
  }
  return <GameGrid {...props} />;
};

/** @param {{error: string|null, loading: boolean, searchQuery: string, visibleGames: ImmersiveGame[], gridRef: {current: HTMLElement|null}, columns: number, selectedIndex: number, getProgress: (id: number|string) => DownloadProgress, onSelectedIndexChange: (index: number, game?: ImmersiveGame) => void, onSelectGame: (game: ImmersiveGame) => void, scrollRef: {current: HTMLElement|null}}} props Scrollable library content. */
const LibraryContent = ({
  columns,
  error,
  getProgress,
  gridRef,
  loading,
  onSelectGame,
  onSelectedIndexChange,
  scrollRef,
  searchQuery,
  selectedIndex,
  visibleGames,
}) => (
  <Box
    ref={scrollRef}
    sx={{
      flex: 1,
      minHeight: 0,
      overflowX: "hidden",
      overflowY: "auto",
      overscrollBehavior: "contain",
      px: { md: 4, sm: 3, xs: 2 },
      py: 3,
    }}
  >
    {error !== null && error !== "" ? (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    ) : null}
    <LibraryBody
      loading={loading}
      searchQuery={searchQuery}
      visibleGames={visibleGames}
      gridRef={gridRef}
      columns={columns}
      selectedIndex={selectedIndex}
      getProgress={getProgress}
      onSelectedIndexChange={onSelectedIndexChange}
      onSelectGame={onSelectGame}
    />
  </Box>
);

/** @param {{colors: Record<string, string>}} props Brand properties. */
const ImmersiveBrand = ({ colors }) => (
  <Stack
    direction="row"
    spacing={1.5}
    sx={{ alignItems: "center", flexWrap: "wrap" }}
  >
    <LauncherIcon size={36} />
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="h6"
        sx={{
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
          backgroundClip: "text",
          fontWeight: 800,
          letterSpacing: "-0.4px",
          lineHeight: 1.2,
        }}
      >
        Wingosy
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: "block",
          fontWeight: 600,
          letterSpacing: "0.03em",
          lineHeight: 1.2,
        }}
      >
        Immersive mode
      </Typography>
    </Box>
  </Stack>
);

/** @param {{colors: Record<string, string>, section: string, setSectionAndReset: (section: string) => void, activeCount: number, onOpenDownloads?: () => void, onOpenSettings: () => void, onExitImmersive: () => void, searchInputRef: {current: HTMLInputElement|null}, searchQuery: string, onSearchChange: (query: string) => void, platformOptions: PlatformOption[], selectedPlatform: string|null, platformButtonRefs: {current: (HTMLButtonElement|null)[]}, onSelectedPlatformChange: (platform: string|null) => void}} props Header properties. */
const LibraryHeader = (props) => (
  <Box
    sx={{
      bgcolor: (theme) => alpha(theme.palette.background.paper, 0.45),
      borderBottom: (theme) => `1px solid ${alpha(theme.palette.divider, 0.6)}`,
      px: { md: 4, sm: 3, xs: 2 },
      py: 2,
    }}
  >
    <Stack
      direction="row"
      spacing={2}
      sx={{
        alignItems: "center",
        flexWrap: "wrap",
        justifyContent: "space-between",
        rowGap: 1.5,
      }}
    >
      <ImmersiveBrand colors={props.colors} />
      <SectionButtons
        section={props.section}
        setSectionAndReset={props.setSectionAndReset}
        primary={props.colors.primary}
      />
      <UtilityButtons
        activeCount={props.activeCount}
        onOpenDownloads={props.onOpenDownloads}
        onOpenSettings={props.onOpenSettings}
        onExitImmersive={props.onExitImmersive}
        primary={props.colors.primary}
      />
    </Stack>
    <SearchField
      searchInputRef={props.searchInputRef}
      searchQuery={props.searchQuery}
      onSearchChange={props.onSearchChange}
    />
    <PlatformButtons
      platformOptions={props.platformOptions}
      selectedPlatform={props.selectedPlatform}
      platformButtonRefs={props.platformButtonRefs}
      onSelectedPlatformChange={props.onSelectedPlatformChange}
      primary={props.colors.primary}
    />
  </Box>
);

/** @param {{colors: Record<string, string>, section: string, setSectionAndReset: (section: string) => void, platformOptions: PlatformOption[], selectedPlatform: string|null, platformButtonRefs: {current: (HTMLButtonElement|null)[]}, onSelectedPlatformChange: (platform: string|null) => void, activeCount: number, onOpenDownloads?: () => void, onOpenSettings: () => void, onExitImmersive: () => void, searchInputRef: {current: HTMLInputElement|null}, searchQuery: string, onSearchChange: (query: string) => void, error: string|null, loading: boolean, visibleGames: ImmersiveGame[], gridRef: {current: HTMLElement|null}, columns: number, selectedIndex: number, getProgress: (id: number|string) => DownloadProgress, onSelectedIndexChange: (index: number, game?: ImmersiveGame) => void, onSelectGame: (game: ImmersiveGame) => void, scrollRef: {current: HTMLElement|null}, rootRef: {current: HTMLElement|null}, handleKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void, onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void}} props Immersive library view properties. */
const ImmersiveLibraryView = (props) => {
  const {
    activeCount,
    colors,
    columns,
    error,
    getProgress,
    gridRef,
    handleKeyDown,
    loading,
    onExitImmersive,
    onOpenDownloads,
    onOpenSettings,
    onPointerDown,
    onSelectGame,
    onSearchChange,
    onSelectedIndexChange,
    onSelectedPlatformChange,
    platformButtonRefs,
    platformOptions,
    rootRef,
    searchInputRef,
    searchQuery,
    section,
    selectedIndex,
    selectedPlatform,
    setSectionAndReset,
    scrollRef,
    visibleGames,
  } = props;
  return (
    <Box
      data-testid="immersive-library"
      tabIndex={0}
      ref={rootRef}
      onKeyDown={handleKeyDown}
      onPointerDown={onPointerDown}
      sx={{
        backgroundImage: `radial-gradient(1200px 420px at 12% -8%, ${alpha(colors.primary, 0.14)} 0%, transparent 55%), radial-gradient(900px 380px at 88% 0%, ${alpha(colors.primaryLight, 0.08)} 0%, transparent 50%)`,
        bgcolor: "background.default",
        display: "flex",
        flex: 1,
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <LibraryHeader
        activeCount={activeCount}
        colors={colors}
        onExitImmersive={onExitImmersive}
        onOpenDownloads={onOpenDownloads}
        onOpenSettings={onOpenSettings}
        onSearchChange={onSearchChange}
        onSelectedPlatformChange={onSelectedPlatformChange}
        platformButtonRefs={platformButtonRefs}
        platformOptions={platformOptions}
        searchInputRef={searchInputRef}
        searchQuery={searchQuery}
        section={section}
        selectedPlatform={selectedPlatform}
        setSectionAndReset={setSectionAndReset}
      />
      <LibraryContent
        error={error}
        loading={loading}
        searchQuery={searchQuery}
        visibleGames={visibleGames}
        gridRef={gridRef}
        columns={columns}
        selectedIndex={selectedIndex}
        getProgress={getProgress}
        onSelectedIndexChange={onSelectedIndexChange}
        onSelectGame={onSelectGame}
        scrollRef={scrollRef}
      />
    </Box>
  );
};

export default ImmersiveLibraryView;
