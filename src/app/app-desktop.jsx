import Box from "@mui/material/Box";

import GameDetails from "../components/GameDetails";
import Library from "../components/Library";
import RomDownloadsView from "../components/RomDownloadsView";
import Settings from "../components/Settings";
import Sidebar from "../components/Sidebar";

const DRAWER_WIDTH = 260;

const panelSx = {
  flex: 1,
  minHeight: 0,
  overflowX: "hidden",
  overflowY: "auto",
  overscrollBehavior: "contain",
};

/** @param {{children: import("react").ReactNode}} props */
const ScrollPanel = ({ children }) => <Box sx={panelSx}>{children}</Box>;

/** @param {{onOpenGameDetails: () => void, onOpenCloudLibrary: () => void}} props */
const DownloadsPanel = ({ onOpenGameDetails, onOpenCloudLibrary }) => (
  <ScrollPanel>
    <RomDownloadsView
      onOpenGameDetails={onOpenGameDetails}
      onOpenCloudLibrary={onOpenCloudLibrary}
    />
  </ScrollPanel>
);

/** @param {{scrollRef: import("react").RefObject<HTMLDivElement>, games: unknown[], gameTotal: number, page: number, loading: boolean, searchQuery: string, libraryLaunchError: unknown, error: string|null, librarySortBy: string, libraryFilterBy: string, onPageChange: (page: number) => void, onSearchChange: (query: string) => void, onSelectGame: (game: unknown) => void, onToggleFavorite: (gameId: number|string) => Promise<void>, onLaunchGame: (gameId: number|string) => Promise<unknown>, onNavigateLibrarySettings: () => void, onNavigateRommSettings: () => void, onOpenSettings: () => void, onRetryLaunch: () => Promise<unknown>|null, onDismissError: () => void, onSortChange: (sortBy: string) => void, onFilterChange: (filterBy: string) => void}} props */
const LibraryPanel = ({
  scrollRef,
  games,
  gameTotal,
  page,
  loading,
  searchQuery,
  libraryLaunchError,
  error,
  librarySortBy,
  libraryFilterBy,
  onPageChange,
  onSearchChange,
  onSelectGame,
  onToggleFavorite,
  onLaunchGame,
  onNavigateLibrarySettings,
  onNavigateRommSettings,
  onOpenSettings,
  onRetryLaunch,
  onDismissError,
  onSortChange,
  onFilterChange,
}) => (
  <Box ref={scrollRef} sx={panelSx}>
    <Library
      games={games}
      total={gameTotal}
      page={page}
      pageSize={60}
      onPageChange={onPageChange}
      loading={loading}
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      onSelectGame={onSelectGame}
      onToggleFavorite={onToggleFavorite}
      onLaunchGame={onLaunchGame}
      onNavigateLibrarySettings={onNavigateLibrarySettings}
      onNavigateRommSettings={onNavigateRommSettings}
      onOpenSettings={onOpenSettings}
      onRetryLaunch={onRetryLaunch}
      launchError={libraryLaunchError}
      error={error}
      onDismissError={onDismissError}
      sortBy={librarySortBy}
      filterBy={libraryFilterBy}
      onSortChange={onSortChange}
      onFilterChange={onFilterChange}
    />
  </Box>
);

/** @param {{selectedGame: unknown, platforms: unknown[], rommToken: string|null, rommUrl: string, onBack: () => Promise<void>, onLaunch: (gameId: number|string) => Promise<unknown>, onOpenSettings: () => void, onOpenIntegrations: () => void, onToggleFavorite: (gameId: number|string) => Promise<void>, onGameUpdate: (gameId: number|string) => Promise<void>}} props */
const DetailsPanel = ({
  selectedGame,
  platforms,
  rommToken,
  rommUrl,
  onBack,
  onLaunch,
  onOpenSettings,
  onOpenIntegrations,
  onToggleFavorite,
  onGameUpdate,
}) => (
  <ScrollPanel>
    <GameDetails
      game={selectedGame}
      platforms={platforms}
      onBack={onBack}
      onLaunch={onLaunch}
      onOpenSettings={onOpenSettings}
      onOpenIntegrations={onOpenIntegrations}
      onToggleFavorite={onToggleFavorite}
      onGameUpdate={onGameUpdate}
      rommToken={rommToken}
      rommUrl={rommUrl}
    />
  </ScrollPanel>
);

/** @param {{initialSection: string, rommToken: string|null, rommUrl: string, onRommConnect: (url: string, token: string) => void, onRommDisconnect: () => void, onLibraryChange: () => Promise<void>}} props */
const SettingsPanel = ({
  initialSection,
  rommToken,
  rommUrl,
  onRommConnect,
  onRommDisconnect,
  onLibraryChange,
}) => (
  <Box
    sx={{
      display: "flex",
      flex: 1,
      flexDirection: "column",
      minHeight: 0,
      minWidth: 0,
      overflow: "hidden",
    }}
  >
    <Settings
      initialSection={initialSection}
      rommToken={rommToken}
      rommUrl={rommUrl}
      onRommConnect={onRommConnect}
      onRommDisconnect={onRommDisconnect}
      onLibraryChange={onLibraryChange}
    />
  </Box>
);

/** @param {{view: string, libraryProps: object, downloadsProps: object, detailsProps: object, settingsProps: object}} props */
const MainView = ({
  view,
  libraryProps,
  downloadsProps,
  detailsProps,
  settingsProps,
}) => {
  if (view === "downloads") {
    return <DownloadsPanel {...downloadsProps} />;
  }
  if (view === "library") {
    return <LibraryPanel {...libraryProps} />;
  }
  if (view === "details" && detailsProps.selectedGame) {
    return <DetailsPanel {...detailsProps} />;
  }
  if (view === "settings") {
    return <SettingsPanel {...settingsProps} />;
  }
  return null;
};

/** @param {{platforms: unknown[], selectedPlatform: string|null, libraryFilterBy: string, view: string, rommUrl: string, onSelectPlatform: (platformId: string) => void, onNavigate: (view: string, options?: object) => void, libraryProps: object, downloadsProps: object, detailsProps: object, settingsProps: object}} props */
const AppDesktop = ({
  platforms,
  selectedPlatform,
  libraryFilterBy,
  view,
  rommUrl,
  onSelectPlatform,
  onNavigate,
  libraryProps,
  downloadsProps,
  detailsProps,
  settingsProps,
}) => (
  <Box sx={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
    <Sidebar
      platforms={platforms}
      selectedPlatform={selectedPlatform}
      onSelectPlatform={onSelectPlatform}
      onNavigate={onNavigate}
      currentView={view}
      libraryFilterBy={libraryFilterBy}
      drawerWidth={DRAWER_WIDTH}
      rommUrl={rommUrl}
    />
    <Box
      component="main"
      sx={{
        bgcolor: "background.default",
        display: "flex",
        flex: 1,
        flexDirection: "column",
        minHeight: 0,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <MainView
        view={view}
        libraryProps={libraryProps}
        downloadsProps={downloadsProps}
        detailsProps={detailsProps}
        settingsProps={settingsProps}
      />
    </Box>
  </Box>
);

export default AppDesktop;
