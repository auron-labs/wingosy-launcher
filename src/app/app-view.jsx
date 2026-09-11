import Box from "@mui/material/Box";

import SetupWizard from "../components/SetupWizard";
import ImmersiveModeApp from "../immersive/ImmersiveModeApp";
import { UiSoundsProvider } from "../UiSoundsContext";
import AppDesktop from "./app-desktop";
import AppNotifications from "./app-notifications";
import AppShell from "./app-shell";

/** @typedef {{getCurrentWindow: () => {isFullscreen: () => Promise<boolean>, onResized: (handler: () => void) => Promise<() => void>, startDragging: () => Promise<void>}, invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>, listen: (event: string, handler: (event: {payload?: unknown}) => void) => Promise<() => void>, openUrl: (url: string) => Promise<unknown>}} AppRuntime */
/** @typedef {import("./use-app-controller").AppController} AppController */

/** @param {{children: import("react").ReactNode, immersiveActive: boolean}} props */
const WithSounds = ({ children, immersiveActive }) => (
  <UiSoundsProvider immersiveActive={immersiveActive}>
    {children}
  </UiSoundsProvider>
);

/** @param {{runtime: AppRuntime, controller: AppController}} props */
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

/** @param {{runtime: AppRuntime, controller: AppController}} props */
const ImmersiveView = ({ runtime, controller }) => (
  <WithSounds immersiveActive={controller.immersiveModeEnabled}>
    <AppShell runtime={runtime}>
      <ImmersiveModeApp
        rommToken={controller.rommToken}
        rommUrl={controller.rommUrl}
        onRommConnect={controller.handleRommConnect}
        onExit={controller.handleImmersiveExit}
        requestedFullscreen={controller.immersiveModeFullscreen}
      />
    </AppShell>
  </WithSounds>
);

/** @param {{runtime: AppRuntime, controller: AppController}} props */
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
        libraryProps={{
          scrollRef: controller.libraryScrollRef,
          games: controller.games,
          gameTotal: controller.gameTotal,
          page: controller.page,
          loading: controller.loading,
          searchQuery: controller.searchQuery,
          libraryLaunchError: controller.libraryLaunchError,
          error: controller.error,
          librarySortBy: controller.librarySortBy,
          libraryFilterBy: controller.libraryFilterBy,
          onPageChange: controller.handlePageChange,
          onSearchChange: controller.handleSearchChange,
          onSelectGame: controller.handleSelectGame,
          onToggleFavorite: controller.handleToggleFavorite,
          onLaunchGame: controller.handleLaunchGame,
          onNavigateLibrarySettings: () =>
            controller.handleOpenSettings("library"),
          onNavigateRommSettings: () => controller.handleOpenSettings("romm"),
          onOpenSettings: () => controller.handleOpenSettings("emulators"),
          onRetryLaunch: controller.handleRetryLaunch,
          onDismissError: controller.handleDismissError,
          onSortChange: controller.handleLibrarySortChange,
          onFilterChange: controller.handleLibraryFilterChange,
        }}
        downloadsProps={{
          onOpenGameDetails: () => controller.handleNavigate("library"),
          onOpenCloudLibrary: () => controller.handleNavigate("library"),
        }}
        detailsProps={{
          selectedGame: controller.selectedGame,
          platforms: controller.platforms,
          rommToken: controller.rommToken,
          rommUrl: controller.rommUrl,
          onBack: controller.handleBackFromGameDetails,
          onLaunch: controller.handleLaunchGame,
          onOpenSettings: () => controller.handleOpenSettings("emulators"),
          onOpenIntegrations: () =>
            controller.handleOpenSettings("integrations"),
          onToggleFavorite: controller.handleToggleFavorite,
          onGameUpdate: controller.handleGameUpdate,
        }}
        settingsProps={{
          initialSection: controller.settingsInitialSection,
          rommToken: controller.rommToken,
          rommUrl: controller.rommUrl,
          onRommConnect: controller.handleRommConnect,
          onRommDisconnect: controller.handleRommDisconnect,
          onLibraryChange: controller.reloadLibrary,
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

/** @param {{runtime: AppRuntime, controller: AppController}} props */
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
