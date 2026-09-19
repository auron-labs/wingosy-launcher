import Box from "@mui/material/Box";

import GameDetails from "../components/game-details";
import Library from "../components/library";
import RomDownloadsView from "../components/rom-downloads-view";
import RommSyncMonitor from "../components/romm-sync-monitor";
import Settings from "../components/settings";
import Sidebar from "../components/sidebar";

const DRAWER_WIDTH = 260;

/** @typedef {GameDetailsGame} LibraryGame */
/** @typedef {{gameId: number|string, retryable: boolean, guidance?: string, message: string}|null} LibraryLaunchError */
/** @typedef {{id: string, name: string}} Platform */
/** @typedef {[Platform, number]} PlatformEntry */
/** @typedef {import("../components/game/game-details-types").GameDetailsGame} GameDetailsGame */
/** @typedef {import("../components/game/game-details-types").GameDetailsPlatform} GameDetailsPlatform */
/** @typedef {import("../components/game/game-details-types").GameDetailsLaunchResult} GameDetailsLaunchResult */

/** @typedef {object} DownloadsPanelProps
 * @property {() => void} onOpenGameDetails Opens the selected game's details.
 * @property {() => void} onOpenCloudLibrary Opens the cloud library.
 */
/** @typedef {object} LibraryPanelProps
 * @property {import("react").RefObject<HTMLDivElement|null>} scrollRef Scroll container reference.
 * @property {LibraryGame[]} games Games shown in the library.
 * @property {number} gameTotal Total number of matching games.
 * @property {number} page Current library page.
 * @property {boolean} loading Whether the library is loading.
 * @property {string} searchQuery Current search query.
 * @property {LibraryLaunchError} libraryLaunchError Latest launch error.
 * @property {string|null} error Latest library error.
 * @property {"name"|"recent"|"play_time"|"play_count"|"release_year"} librarySortBy Current sort mode.
 * @property {boolean} sortDescending Whether the current sort is descending.
 * @property {"all"|"favorites"|"recent"} libraryFilterBy Current primary filter mode.
 * @property {"all"|"downloaded"|"not_downloaded"} libraryAvailability Current availability filter.
 * @property {(page: number) => void} onPageChange Changes the current page.
 * @property {(query: string) => void} onSearchChange Changes the search query.
 * @property {(game: LibraryGame) => void} onSelectGame Selects a game.
 * @property {(gameId: number|string) => Promise<void>} onToggleFavorite Toggles a game's favorite state.
 * @property {(gameId: number|string) => Promise<unknown>} onLaunchGame Launches a game.
 * @property {() => void} onNavigateLibrarySettings Opens library settings.
 * @property {() => void} onNavigateRommSettings Opens RomM settings.
 * @property {() => void} onOpenSettings Opens the settings view.
 * @property {() => Promise<unknown>|null} onRetryLaunch Retries the latest launch.
 * @property {() => void} onDismissError Dismisses the library error.
 * @property {(sortBy: string) => void} onSortChange Changes the sort mode.
 * @property {(descending: boolean) => void} onSortDirectionChange Changes the sort direction.
 * @property {(filterBy: string) => void} onFilterChange Changes the primary filter mode.
 * @property {(availability: string) => void} onAvailabilityChange Changes the availability filter.
 */
/** @typedef {object} DetailsPanelProps
 * @property {GameDetailsGame|null} selectedGame Selected game, when one is open.
 * @property {[GameDetailsPlatform, number][]} platforms Available platforms.
 * @property {string|null} rommToken RomM authentication token.
 * @property {string|null} rommUrl RomM server URL.
 * @property {() => Promise<void>} onBack Returns to the library.
 * @property {(gameId: number|string) => Promise<GameDetailsLaunchResult|null|undefined>} onLaunch Launches a game.
 * @property {() => void} onOpenSettings Opens the settings view.
 * @property {() => void} onOpenIntegrations Opens integrations settings.
 * @property {(gameId: number|string) => Promise<void>} onToggleFavorite Toggles a game's favorite state.
 * @property {(gameId: number|string) => Promise<void>} onGameUpdate Refreshes game details.
 */
/** @typedef {object} SettingsPanelProps
 * @property {string} initialSection Settings section to show.
 * @property {string|null} rommToken RomM authentication token.
 * @property {string} rommUrl RomM server URL.
 * @property {(url: string, token: string) => void} onRommConnect Saves a RomM session.
 * @property {() => void} onRommDisconnect Clears the RomM session.
 * @property {() => void|Promise<void>} onLibraryChange Refreshes the library.
 */
/** @typedef {object} RommSyncPanelProps
 * @property {import("../components/use-romm-sync-monitor").RommSyncMonitorState} monitor RomM monitor state.
 */
/** @typedef {object} MainViewProps
 * @property {string} view Active desktop view.
 * @property {LibraryPanelProps} libraryProps Library panel properties.
 * @property {DownloadsPanelProps} downloadsProps Downloads panel properties.
 * @property {DetailsPanelProps} detailsProps Details panel properties.
 * @property {SettingsPanelProps} settingsProps Settings panel properties.
 * @property {RommSyncPanelProps} rommSyncProps RomM sync monitor properties.
 */
/** @typedef {object} AppDesktopProps
 * @property {PlatformEntry[]} platforms Available library platforms.
 * @property {string|null} selectedPlatform Selected platform identifier.
 * @property {"all"|"favorites"|"recent"} libraryFilterBy Active primary library filter.
 * @property {string} view Active desktop view.
 * @property {string} rommUrl RomM server URL.
 * @property {(platformId: string|null) => void} onSelectPlatform Selects a platform.
 * @property {(view: string, options?: object) => void} onNavigate Changes the desktop view.
 * @property {LibraryPanelProps} libraryProps Library panel properties.
 * @property {DownloadsPanelProps} downloadsProps Downloads panel properties.
 * @property {DetailsPanelProps} detailsProps Details panel properties.
 * @property {SettingsPanelProps} settingsProps Settings panel properties.
 * @property {RommSyncPanelProps} rommSyncProps RomM sync monitor properties.
 */

const panelSx = {
  flex: 1,
  minHeight: 0,
  overflowX: "hidden",
  overflowY: "auto",
  overscrollBehavior: "contain",
};

/** @param {{children: import("react").ReactNode}} props Panel contents. */
const ScrollPanel = ({ children }) => <Box sx={panelSx}>{children}</Box>;

/** @param {DownloadsPanelProps} props Downloads panel properties. */
const DownloadsPanel = ({ onOpenGameDetails, onOpenCloudLibrary }) => (
  <ScrollPanel>
    <RomDownloadsView
      onOpenGameDetails={onOpenGameDetails}
      onOpenCloudLibrary={onOpenCloudLibrary}
    />
  </ScrollPanel>
);

/** @param {LibraryPanelProps} props Library panel properties. */
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
  sortDescending,
  libraryFilterBy,
  libraryAvailability,
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
  onSortDirectionChange,
  onFilterChange,
  onAvailabilityChange,
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
      onToggleFavorite={(gameId) => {
        void onToggleFavorite(gameId);
      }}
      onLaunchGame={(gameId) => {
        void onLaunchGame(gameId);
      }}
      onNavigateLibrarySettings={onNavigateLibrarySettings}
      onNavigateRommSettings={onNavigateRommSettings}
      onOpenSettings={onOpenSettings}
      onRetryLaunch={
        onRetryLaunch === null
          ? null
          : () => {
              void onRetryLaunch();
            }
      }
      launchError={libraryLaunchError}
      error={error}
      onDismissError={onDismissError}
      sortBy={librarySortBy}
      sortDescending={sortDescending}
      filterBy={libraryFilterBy}
      availability={libraryAvailability}
      onSortChange={onSortChange}
      onSortDirectionChange={onSortDirectionChange}
      onFilterChange={onFilterChange}
      onAvailabilityChange={onAvailabilityChange}
    />
  </Box>
);

/** @param {DetailsPanelProps} props Details panel properties. */
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
    {selectedGame ? (
      <GameDetails
        game={selectedGame}
        platforms={platforms}
        onBack={() => {
          void onBack();
        }}
        onLaunch={onLaunch}
        onOpenSettings={onOpenSettings}
        onOpenIntegrations={onOpenIntegrations}
        onToggleFavorite={(gameId) => {
          void onToggleFavorite(gameId);
        }}
        onGameUpdate={(gameId) => {
          void onGameUpdate(gameId);
        }}
        rommToken={rommToken}
        rommUrl={rommUrl}
      />
    ) : null}
  </ScrollPanel>
);

/** @param {SettingsPanelProps} props Settings panel properties. */
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

/** @param {RommSyncPanelProps} props RomM sync monitor properties. */
const RommSyncPanel = ({ monitor }) => (
  <ScrollPanel>
    <RommSyncMonitor monitor={monitor} />
  </ScrollPanel>
);

/** @param {MainViewProps} props Main view properties. */
const MainView = ({
  view,
  libraryProps,
  downloadsProps,
  detailsProps,
  rommSyncProps,
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
  if (view === "romm-sync") {
    return <RommSyncPanel {...rommSyncProps} />;
  }
  return null;
};

/** @param {AppDesktopProps} props Desktop app properties. */
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
  rommSyncProps,
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
        rommSyncProps={rommSyncProps}
        settingsProps={settingsProps}
      />
    </Box>
  </Box>
);

export default AppDesktop;
