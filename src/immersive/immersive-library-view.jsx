import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";

import { CoverShelf, ShelfHeading } from "./immersive-cover-shelf";
import { HeroStage } from "./immersive-library-hero";
import {
  HeroBackdrop,
  ImmersiveShellLayout,
  ImmersiveTopBar,
  PlatformSpine,
} from "./immersive-shell";
import { getImmersiveCoverSrc } from "./immersive-shell-utils";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {import("./immersive-shell-utils").SpinePlatformOption} SpinePlatformOption */
/** @typedef {{downloaded?: number|null, total?: number|null, percent?: number|null}|null} DownloadProgress */

/** @param {{activeCount: number, onOpenDownloads?: () => void, onOpenSettings: () => void, onExitImmersive: () => void}} props Utility button properties. */
const HeaderUtilities = ({
  activeCount,
  onOpenDownloads,
  onOpenSettings,
  onExitImmersive,
}) => (
  <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
    {onOpenDownloads ? (
      <Button
        onClick={onOpenDownloads}
        sx={{
          color: "text.secondary",
          fontSize: "0.95rem",
          fontWeight: 600,
          textTransform: "none",
        }}
      >
        {activeCount > 0 ? `Downloads (${activeCount})` : "Downloads"}
      </Button>
    ) : null}
    <Button
      onClick={onOpenSettings}
      sx={{
        color: "text.secondary",
        fontSize: "0.95rem",
        fontWeight: 600,
        textTransform: "none",
      }}
    >
      Settings
    </Button>
    <Button
      data-testid="immersive-exit-to-desktop"
      onClick={onExitImmersive}
      sx={{
        color: "text.secondary",
        fontSize: "0.95rem",
        fontWeight: 600,
        textTransform: "none",
      }}
    >
      Exit
    </Button>
  </Stack>
);

/** @param {{section: string, setSectionAndReset: (section: string) => void, searchInputRef: {current: HTMLInputElement|null}, searchQuery: string, onSearchChange: (query: string) => void, activeCount: number, onOpenDownloads?: () => void, onOpenSettings: () => void, onExitImmersive: () => void}} props Library header properties. */
const LibraryHeader = (props) => {
  const {
    section,
    setSectionAndReset,
    searchInputRef,
    searchQuery,
    onSearchChange,
    activeCount,
    onOpenDownloads,
    onOpenSettings,
    onExitImmersive,
  } = props;
  return (
    <>
      <Box sx={{ position: "relative", zIndex: 1 }}>
        <ImmersiveTopBar
          section={section}
          onSectionChange={setSectionAndReset}
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
        />
      </Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          position: "relative",
          px: { lg: 5, md: 4, xs: 2.5 },
          zIndex: 1,
        }}
      >
        <HeaderUtilities
          activeCount={activeCount}
          onOpenDownloads={onOpenDownloads}
          onOpenSettings={onOpenSettings}
          onExitImmersive={onExitImmersive}
        />
      </Box>
    </>
  );
};

/** @param {{searchQuery: string}} props Empty shelf properties. */
const EmptyLibrary = ({ searchQuery }) => {
  const hasSearch = searchQuery.trim() !== "";
  return (
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        flex: 1,
        justifyContent: "center",
        minHeight: 240,
      }}
    >
      <Stack spacing={1} sx={{ alignItems: "center", textAlign: "center" }}>
        <Typography variant="h5" sx={{ color: "rgba(245,241,232,0.8)" }}>
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

/** @param {{searchQuery: string, section: string, selectedIndex: number, visibleGames: ImmersiveGame[], gridRef: {current: HTMLElement|null}, getProgress: (id: number|string) => DownloadProgress, onSelectedIndexChange: (index: number, game?: ImmersiveGame) => void, onSelectGame: (game: ImmersiveGame) => void, reducedMotion: boolean, platformOptions: SpinePlatformOption[]}} props Populated library properties. */
const PopulatedLibrary = (props) => {
  const { visibleGames, selectedIndex, platformOptions } = props;
  const heroGame = visibleGames[selectedIndex] ?? visibleGames[0];
  return (
    <>
      <HeroStage game={heroGame} platformOptions={platformOptions} />
      <Box sx={{ mt: "auto", pt: 3 }}>
        <ShelfHeading
          section={props.section}
          selectedIndex={props.selectedIndex}
          total={visibleGames.length}
        />
        <CoverShelf
          gridRef={props.gridRef}
          selectedIndex={props.selectedIndex}
          visibleGames={visibleGames}
          getProgress={props.getProgress}
          onSelectedIndexChange={props.onSelectedIndexChange}
          onSelectGame={props.onSelectGame}
          reducedMotion={props.reducedMotion}
        />
      </Box>
    </>
  );
};

/** @param {{loading: boolean, searchQuery: string, section: string, selectedIndex: number, visibleGames: ImmersiveGame[], gridRef: {current: HTMLElement|null}, getProgress: (id: number|string) => DownloadProgress, onSelectedIndexChange: (index: number, game?: ImmersiveGame) => void, onSelectGame: (game: ImmersiveGame) => void, reducedMotion: boolean, platformOptions: SpinePlatformOption[]}} props Library body properties. */
const LibraryBody = (props) => {
  const { loading, visibleGames } = props;
  if (loading) {
    return (
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          flex: 1,
          flexDirection: "column",
          gap: 2,
          justifyContent: "center",
          minHeight: 240,
        }}
      >
        <CircularProgress color="primary" />
        <Typography variant="body2" color="text.secondary">
          Loading your library…
        </Typography>
      </Box>
    );
  }
  if (visibleGames.length === 0) {
    return <EmptyLibrary searchQuery={props.searchQuery} />;
  }
  return <PopulatedLibrary {...props} />;
};

/** @param {{error: string|null, loading: boolean, searchQuery: string, section: string, selectedIndex: number, visibleGames: ImmersiveGame[], gridRef: {current: HTMLElement|null}, getProgress: (id: number|string) => DownloadProgress, onSelectedIndexChange: (index: number, game?: ImmersiveGame) => void, onSelectGame: (game: ImmersiveGame) => void, reducedMotion: boolean, platformOptions: SpinePlatformOption[]}} props Library stage properties. */
const LibraryMainStage = (props) => (
  <Box
    sx={{
      display: "flex",
      flex: 1,
      flexDirection: "column",
      minHeight: 0,
      overflowX: "hidden",
      overflowY: "auto",
      overscrollBehavior: "contain",
      position: "relative",
      px: { lg: 5, md: 4, xs: 2.5 },
      py: 2,
      zIndex: 1,
    }}
  >
    {props.error !== null && props.error !== "" ? (
      <Alert severity="error" sx={{ mb: 2 }}>
        {props.error}
      </Alert>
    ) : null}
    <LibraryBody {...props} />
  </Box>
);

/** @param {{heroCoverSrc: string|null, reducedMotion: boolean, header: import("react").ReactNode, stage: import("react").ReactNode}} props Library column properties. */
const LibraryContentColumn = ({
  heroCoverSrc,
  reducedMotion,
  header,
  stage,
}) => (
  <Box
    sx={{
      display: "flex",
      flex: 1,
      flexDirection: "column",
      minHeight: 0,
      minWidth: 0,
      position: "relative",
    }}
  >
    <HeroBackdrop coverSrc={heroCoverSrc} reducedMotion={reducedMotion} />
    {header}
    {stage}
  </Box>
);

/** @param {{activeCount: number, error: string|null, getProgress: (id: number|string) => DownloadProgress, gridRef: {current: HTMLElement|null}, handleKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void, loading: boolean, onExitImmersive: () => void, onOpenDownloads?: () => void, onOpenSettings: () => void, onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void, onSelectGame: (game: ImmersiveGame) => void, onSearchChange: (query: string) => void, onSelectedIndexChange: (index: number, game?: ImmersiveGame) => void, onSelectedPlatformChange: (platform: string|null) => void, platformButtonRefs: {current: (HTMLButtonElement|null)[]}, platformOptions: SpinePlatformOption[], rootRef: {current: HTMLElement|null}, searchInputRef: {current: HTMLInputElement|null}, searchQuery: string, section: string, selectedIndex: number, selectedPlatform: string|null, setSectionAndReset: (section: string) => void, visibleGames: ImmersiveGame[]}} props Immersive library view properties. */
const ImmersiveLibraryView = (props) => {
  const { selectedIndex, visibleGames } = props;
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const heroGame = visibleGames[selectedIndex] ?? visibleGames[0] ?? null;
  return (
    <ImmersiveShellLayout>
      <Box
        data-testid="immersive-library"
        tabIndex={0}
        ref={props.rootRef}
        onKeyDown={props.handleKeyDown}
        onPointerDown={props.onPointerDown}
        sx={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <PlatformSpine
          options={props.platformOptions}
          selectedPlatform={props.selectedPlatform}
          platformButtonRefs={props.platformButtonRefs}
          onSelectedPlatformChange={props.onSelectedPlatformChange}
        />
        <LibraryContentColumn
          heroCoverSrc={getImmersiveCoverSrc(heroGame?.cover_path)}
          reducedMotion={reducedMotion}
          header={<LibraryHeader {...props} />}
          stage={<LibraryMainStage {...props} reducedMotion={reducedMotion} />}
        />
      </Box>
    </ImmersiveShellLayout>
  );
};

export default ImmersiveLibraryView;
