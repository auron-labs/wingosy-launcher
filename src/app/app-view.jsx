import Box from "@mui/material/Box";

import SetupWizard from "../components/setup-wizard";
import ImmersiveModeApp from "../immersive/immersive-mode-app";
import { UiSoundsProvider } from "../ui-sounds-provider";
import AppDesktop from "./app-desktop";
import AppNotifications from "./app-notifications";
import AppShell from "./app-shell";

/** @typedef {import("./app-runtime").AppRuntime} AppRuntime */
/** @typedef {import("./use-app-controller").AppController} AppController */

/** @param {{children: import("react").ReactNode, immersiveActive: boolean}} props Sound wrapper properties. */
const WithSounds = ({ children, immersiveActive }) => (
  <UiSoundsProvider immersiveActive={immersiveActive}>
    {children}
  </UiSoundsProvider>
);

/** @param {{runtime: AppRuntime, controller: AppController}} props Setup view properties. */
const SetupView = ({ runtime, controller }) => (
  <WithSounds immersiveActive={controller.immersiveModeEnabled}>
    <AppShell runtime={runtime}>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowX: "hidden",
          overflowY: "auto",
          overscrollBehavior: "contain",
        }}
      >
        <SetupWizard
          onComplete={controller.handleSetupComplete}
          onRommConnect={controller.handleRommConnect}
        />
      </Box>
    </AppShell>
  </WithSounds>
);

/** @param {{runtime: AppRuntime, controller: AppController}} props Immersive view properties. */
const ImmersiveView = ({ runtime, controller }) => (
  <WithSounds immersiveActive={controller.immersiveModeEnabled}>
    <AppShell runtime={runtime}>
      <ImmersiveModeApp
        rommToken={controller.rommToken}
        rommUrl={controller.rommUrl}
        onRommConnect={controller.handleRommConnect}
        onExit={() => {
          void controller.handleImmersiveExit(controller.reloadLibrary);
        }}
        requestedFullscreen={controller.immersiveModeFullscreen}
      />
    </AppShell>
  </WithSounds>
);

/** @param {AppController} controller Desktop application controller. */
const getDesktopLibraryProps = (controller) => ({
  error: controller.error,
  gameTotal: controller.gameTotal,
  games: controller.games,
  libraryFilterBy: controller.libraryFilterBy,
  libraryLaunchError: controller.libraryLaunchError,
  librarySortBy: controller.librarySortBy,
  loading: controller.loading,
  onDismissError: controller.handleDismissError,
  onFilterChange: controller.handleLibraryFilterChange,
  onLaunchGame: controller.handleLaunchGame,
  onNavigateLibrarySettings: () => {
    controller.handleOpenSettings("library");
  },
  onNavigateRommSettings: () => {
    controller.handleOpenSettings("romm");
  },
  onOpenSettings: () => {
    controller.handleOpenSettings("emulators");
  },
  onPageChange: controller.handlePageChange,
  onRetryLaunch: controller.handleRetryLaunch,
  onSearchChange: controller.handleSearchChange,
  onSelectGame: controller.handleSelectGame,
  onSortChange: controller.handleLibrarySortChange,
  onToggleFavorite: controller.handleToggleFavorite,
  page: controller.page,
  scrollRef: controller.libraryScrollRef,
  searchQuery: controller.searchQuery,
});

/** @param {{runtime: AppRuntime, controller: AppController}} props Desktop view properties. */
const DesktopView = ({ runtime, controller }) => (
  <WithSounds immersiveActive={controller.immersiveModeEnabled}>
    <AppShell runtime={runtime}>
      <AppDesktop
        platforms={controller.platforms}
        selectedPlatform={controller.selectedPlatform}
        libraryFilterBy={controller.libraryFilterBy}
        view={controller.view}
        rommUrl={controller.rommUrl}
        onSelectPlatform={controller.handleSelectPlatform}
        onNavigate={controller.handleNavigate}
        libraryProps={getDesktopLibraryProps(controller)}
        downloadsProps={{
          onOpenCloudLibrary: () => {
            controller.handleNavigate("library");
          },
          onOpenGameDetails: () => {
            controller.handleNavigate("library");
          },
        }}
        detailsProps={{
          onBack: controller.handleBackFromGameDetails,
          onGameUpdate: controller.handleGameUpdate,
          onLaunch: controller.handleLaunchGame,
          onOpenIntegrations: () => {
            controller.handleOpenSettings("integrations");
          },
          onOpenSettings: () => {
            controller.handleOpenSettings("emulators");
          },
          onToggleFavorite: controller.handleToggleFavorite,
          platforms: controller.platforms,
          rommToken: controller.rommToken,
          rommUrl: controller.rommUrl,
          selectedGame: controller.selectedGame,
        }}
        settingsProps={{
          initialSection: controller.settingsInitialSection,
          onLibraryChange: () => {
            void controller.reloadLibrary();
          },
          onRommConnect: controller.handleRommConnect,
          onRommDisconnect: controller.handleRommDisconnect,
          rommToken: controller.rommToken,
          rommUrl: controller.rommUrl,
        }}
      />
      <AppNotifications
        messages={controller.saveSyncMessages}
        onCloseMessages={controller.handleCloseMessages}
        snack={controller.updateSnack}
        onCloseUpdate={controller.handleCloseUpdate}
        onInstallUpdate={controller.handleInstallUpdate}
        onOpenRelease={controller.handleOpenRelease}
      />
    </AppShell>
  </WithSounds>
);

/** @param {{runtime: AppRuntime, controller: AppController}} props Application view properties. */
const AppView = ({ runtime, controller }) => {
  if (controller.showSetup === null) {
    return (
      <WithSounds immersiveActive={controller.immersiveModeEnabled}>
        <Box
          sx={{
            alignItems: "center",
            bgcolor: "background.default",
            display: "flex",
            height: "100vh",
            justifyContent: "center",
          }}
        />
      </WithSounds>
    );
  }
  if (controller.showSetup) {
    return <SetupView runtime={runtime} controller={controller} />;
  }
  if (controller.immersiveModeEnabled) {
    return <ImmersiveView runtime={runtime} controller={controller} />;
  }
  return <DesktopView runtime={runtime} controller={controller} />;
};

export default AppView;
