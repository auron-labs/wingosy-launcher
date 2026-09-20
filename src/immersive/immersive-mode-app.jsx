import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { debugLog } from "../utils/debug-log";
import {
  describeControllerElement,
  isTextInputTarget,
  logControllerOutcome,
} from "./controller-debug";
import { getVisibleControllerOverlay } from "./immersive-controller-overlay";
import ImmersiveModeView from "./immersive-mode-view";
import {
  buildControllerKeydown,
  useGamepadKeyboardMapper,
} from "./use-gamepad-keyboard-mapper";
import { useImmersiveModeDisplay } from "./use-immersive-mode-display";
import { useImmersiveModeFavorite } from "./use-immersive-mode-favorite";
import { useImmersiveModeHotkeys } from "./use-immersive-mode-hotkeys";
import { useImmersiveModeLaunch } from "./use-immersive-mode-launch";
import { useImmersiveModeLibrary } from "./use-immersive-mode-library";

const noOpAsync = async () => {
  await Promise.resolve();
};

/** @type {ReturnType<typeof import("../components/use-romm-sync-monitor").useRommSyncMonitor>} */
const EMPTY_ROMM_SYNC_MONITOR = {
  activeOperation: null,
  error: null,
  loadOverview: noOpAsync,
  loading: false,
  platformStatuses: {},
  platforms: [],
  syncAll: noOpAsync,
  syncAllStatus: { error: null, state: "idle", totalGames: null },
  syncPlatform: noOpAsync,
};

/** @returns {string} Default immersive view. */
const getInitialView = () => "library";
/** @returns {string} Default settings section. */
const getInitialSettingsSection = () => "general";
/** @returns {boolean} Default hint visibility. */
const getInitialShowHints = () => true;
/** @returns {string[]} Initial save messages. */
const getInitialSaveMessages = () => [];

/** @param {() => Promise<unknown>} operation Async operation. @returns {Promise<null>} Completed operation. */
const runIgnoringFailure = async (operation) => {
  try {
    await operation();
  } catch {
    return null;
  }
  return null;
};

/** @param {string} key Controller key. @returns {boolean} Whether shell owns the key. */
const isShellControllerKey = (key) =>
  key === "Escape" || key === "h" || key === "H";

/** @param {Element} overlay @returns {Element} Overlay event target. */
const getControllerOverlayTarget = (overlay) => {
  const { activeElement } = document;
  if (activeElement instanceof Element && overlay.contains(activeElement)) {
    return activeElement;
  }
  return overlay;
};

/** @param {Element} overlay @param {string} key @param {ReturnType<typeof import("./controller-debug").getControllerAction>} action Dispatch to the open overlay. */
const dispatchControllerToOverlay = (overlay, key, action) => {
  const target = getControllerOverlayTarget(overlay);
  const dispatchResult = target.dispatchEvent(
    buildControllerKeydown(key, action)
  );
  if (action !== null) {
    const role = overlay.getAttribute("role") ?? "overlay";
    debugLog("controller", "action routed", {
      ...action,
      destinations: [
        {
          defaultPrevented: !dispatchResult,
          element: describeControllerElement(target),
          type: target === overlay ? role : `${role}-item`,
        },
      ],
      expectedTarget: role,
      expectedTargetMissing: false,
    });
  }
};

/** @param {{view: string}} options Routing options. @returns {{libraryTargetRef: {current: HTMLDivElement|null}, onControllerAction: (key: string, action: {actionId: number, controllerIndex: number, deferred: boolean, elapsedSincePreviousMs: number|null, key: string, phase: string}|null) => void}} Controller route. */
const useImmersiveModeControllerRoute = ({ view }) => {
  /** @type {HTMLDivElement|null} */
  const initialLibraryTarget = null;
  const libraryTargetRef = useRef(initialLibraryTarget);
  const onControllerAction = useCallback(
    /** @param {string} key Controller key. @param {{actionId: number, controllerIndex: number, deferred: boolean, elapsedSincePreviousMs: number|null, key: string, phase: string}|null} action Controller action metadata. */
    (key, action) => {
      try {
        if (isTextInputTarget(document.activeElement)) {
          const receiver =
            view === "library" && !isShellControllerKey(key)
              ? "library"
              : "shell";
          logControllerOutcome(action, receiver, "suppressed", {
            reason: "text-input-focused",
          });
          return;
        }
        const overlay = getVisibleControllerOverlay();
        if (overlay !== null) {
          dispatchControllerToOverlay(overlay, key, action);
          return;
        }
        const target =
          view === "library" && !isShellControllerKey(key)
            ? libraryTargetRef.current
            : window;
        if (target === null) {
          logControllerOutcome(action, "library", "ignored", {
            reason: "route-target-missing",
          });
          return;
        }
        target.dispatchEvent(buildControllerKeydown(key, action));
      } catch {
        // Ignore a detached view during route transitions or teardown.
      }
    },
    [view]
  );
  return { libraryTargetRef, onControllerAction };
};

/** @param {{display: ReturnType<typeof useImmersiveModeDisplay>, onExit?: () => void|Promise<void>}} options Navigation options. */
const useImmersiveModeNavigation = ({ display, onExit }) => {
  const [view, setView] = useState(getInitialView);
  const [settingsInitialSection, setSettingsInitialSection] = useState(
    getInitialSettingsSection
  );
  const [showHints, setShowHints] = useState(getInitialShowHints);
  const [saveSyncMessages, setSaveSyncMessages] = useState(
    getInitialSaveMessages
  );
  const handleExit = async () => {
    await runIgnoringFailure(async () => {
      await display.setFullscreen(false);
    });
    await runIgnoringFailure(
      async () =>
        await display.persistDisplay({ big_picture: false, fullscreen: false })
    );
    await onExit?.();
  };
  const openSettings = (section = "general") => {
    setSettingsInitialSection(section);
    setView("settings");
  };
  return {
    handleExit,
    openSettings,
    saveSyncMessages,
    setSaveSyncMessages,
    setShowHints,
    setView,
    settingsInitialSection,
    showHints,
    view,
  };
};

/** @param {{library: ReturnType<typeof useImmersiveModeLibrary>, display: ReturnType<typeof useImmersiveModeDisplay>, navigation: ReturnType<typeof useImmersiveModeNavigation>, view: string, prepareLaunch?: typeof import("./immersive-mode-ipc").prepareAndLaunchGame, toggleGameFavorite?: typeof import("./immersive-mode-ipc").toggleFavorite}} options Immersive command options. */
const useImmersiveModeCommands = ({
  library,
  display,
  navigation,
  view,
  prepareLaunch,
  toggleGameFavorite,
}) => {
  const handleLaunchGame = useImmersiveModeLaunch({
    games: library.games,
    loadData: library.loadData,
    platforms: library.platforms,
    prepareLaunch,
    setError: library.setError,
    setSaveSyncMessages: navigation.setSaveSyncMessages,
  });
  const handleToggleFavorite = useImmersiveModeFavorite({
    gamesRef: library.gamesRef,
    selectedGame: library.selectedGame,
    setError: library.setError,
    setGames: library.setGames,
    setSelectedGame: library.setSelectedGame,
    toggleGameFavorite,
  });
  const controllerRoute = useImmersiveModeControllerRoute({ view });
  const { unsupportedGamepad } = useGamepadKeyboardMapper({
    deadzone: display.controllerDeadzone,
    enabled: true,
    onControllerAction: controllerRoute.onControllerAction,
  });
  return {
    controllerRouteRef: controllerRoute.libraryTargetRef,
    handleLaunchGame,
    handleToggleFavorite,
    unsupportedGamepad,
  };
};

/** @param {{platforms: Array<[ {id: string, name: string}, number ]>}} options Platform options. */
const usePlatformDisplayNames = ({ platforms }) =>
  useMemo(() => {
    const names = new Map();
    for (const [platform] of platforms) {
      names.set(
        platform.id,
        platform.name === "" ? platform.id : platform.name
      );
    }
    return names;
  }, [platforms]);

/** @param {{library: ReturnType<typeof useImmersiveModeLibrary>, monitor: ReturnType<typeof import("../components/use-romm-sync-monitor").useRommSyncMonitor>}} options Sync refresh dependencies. */
const useImmersiveSyncRefresh = ({ library, monitor }) => {
  /** @type {{current: import("../components/use-romm-sync-monitor").ActiveSyncOperation}} */
  const previousOperationRef = useRef(null);
  const { activeOperation, platformStatuses, syncAllStatus } = monitor;
  const { loadData } = library;
  useEffect(() => {
    const finished =
      previousOperationRef.current !== null && activeOperation === null;
    previousOperationRef.current = activeOperation;
    if (!finished) {
      return;
    }
    const scopedSyncSucceeded = Object.values(platformStatuses).some(
      (status) => status.state === "success"
    );
    if (syncAllStatus.state === "success" || scopedSyncSucceeded) {
      void loadData();
    }
  }, [activeOperation, loadData, platformStatuses, syncAllStatus.state]);
};

/** @param {{display: ReturnType<typeof useImmersiveModeDisplay>, library: ReturnType<typeof useImmersiveModeLibrary>, navigation: ReturnType<typeof useImmersiveModeNavigation>}} options App callback dependencies. */
const useImmersiveModeAppCallbacks = ({ display, library, navigation }) => {
  const platformDisplayNameById = usePlatformDisplayNames({
    platforms: library.platforms,
  });
  /** @param {number} value Controller deadzone. */
  const handleControllerDeadzoneChange = (value) => {
    display.setControllerDeadzone(value);
  };
  /** @param {boolean} enabled RetroAchievements state. */
  const handleRetroAchievementsChange = (enabled) => {
    display.setRetroachievementsEnabled(enabled);
  };
  /** @param {boolean} enabled Fullscreen state. */
  const handleFullscreenChange = (enabled) => {
    void display.setFullscreen(enabled);
  };
  /** @param {boolean} enabled Immersive mode state. */
  const handleImmersiveModeChange = (enabled) => {
    if (!enabled) {
      void navigation.handleExit();
    }
  };
  return {
    handleControllerDeadzoneChange,
    handleFullscreenChange,
    handleImmersiveModeChange,
    handleRetroAchievementsChange,
    platformDisplayNameById,
  };
};

/** @param {{onExit?: () => void|Promise<void>, rommToken?: string|null, rommUrl?: string|null, rommSyncMonitor?: ReturnType<typeof import("../components/use-romm-sync-monitor").useRommSyncMonitor>, onRommConnect?: (url: string, token: string) => void, requestedFullscreen?: boolean, dependencies?: {components?: import("./immersive-mode-view").ImmersiveModeComponents, getConfig?: typeof import("./immersive-mode-ipc").getImmersiveConfig, libraryIpc?: import("./use-immersive-mode-library").ImmersiveLibraryIpc, prepareLaunch?: typeof import("./immersive-mode-ipc").prepareAndLaunchGame, saveConfig?: typeof import("./immersive-mode-ipc").saveImmersiveConfig, toggleGameFavorite?: typeof import("./immersive-mode-ipc").toggleFavorite}}} props App properties. */
const useImmersiveModeAppServices = (props) => {
  const { dependencies = {} } = props;
  const display = useImmersiveModeDisplay({
    getConfig: dependencies.getConfig,
    requestedFullscreen: props.requestedFullscreen ?? false,
    saveConfig: dependencies.saveConfig,
  });
  const navigation = useImmersiveModeNavigation({
    display,
    onExit: props.onExit,
  });
  const library = useImmersiveModeLibrary({
    ipc: dependencies.libraryIpc,
    onConfigLoaded: display.applyConfig,
    setView: navigation.setView,
    view: navigation.view,
  });
  useImmersiveSyncRefresh({
    library,
    monitor: props.rommSyncMonitor ?? EMPTY_ROMM_SYNC_MONITOR,
  });
  const commands = useImmersiveModeCommands({
    display,
    library,
    navigation,
    prepareLaunch: dependencies.prepareLaunch,
    toggleGameFavorite: dependencies.toggleGameFavorite,
    view: navigation.view,
  });
  useImmersiveModeHotkeys({
    handleExit: navigation.handleExit,
    loadData: library.loadData,
    setShowHints: navigation.setShowHints,
    setView: navigation.setView,
    toggleFullscreen: display.toggleFullscreen,
    view: navigation.view,
  });
  const callbacks = useImmersiveModeAppCallbacks({
    display,
    library,
    navigation,
  });
  return {
    ...commands,
    audioConfig: display.audioConfig,
    components: dependencies.components,
    error: library.error,
    games: library.games,
    handleExit: navigation.handleExit,
    loadData: library.loadData,
    loading: library.loading,
    onControllerDeadzoneChange: callbacks.handleControllerDeadzoneChange,
    onFullscreenChange: callbacks.handleFullscreenChange,
    onImmersiveModeChange: callbacks.handleImmersiveModeChange,
    onRetroAchievementsChange: callbacks.handleRetroAchievementsChange,
    onRommConnect: props.onRommConnect,
    onSearchChange: library.handleSearchChange,
    onSelectGame: library.handleSelectGame,
    onSelectedIndexChange: library.handleSelectedIndexChange,
    onSelectedPlatformChange: library.handleSelectedPlatformChange,
    openSettings: navigation.openSettings,
    platformDisplayNameById: callbacks.platformDisplayNameById,
    platforms: library.platforms,
    retroachievementsEnabled: display.retroachievementsEnabled,
    rommSyncMonitor: props.rommSyncMonitor ?? EMPTY_ROMM_SYNC_MONITOR,
    rommToken: props.rommToken,
    rommUrl: props.rommUrl,
    saveSyncMessages: navigation.saveSyncMessages,
    searchQuery: library.searchQuery,
    selectedGame: library.selectedGame,
    selectedIndex: library.selectedIndex,
    selectedPlatform: library.selectedPlatform,
    setSaveSyncMessages: navigation.setSaveSyncMessages,
    setSelectedGame: library.setSelectedGame,
    setShowHints: navigation.setShowHints,
    setView: navigation.setView,
    settingsInitialSection: navigation.settingsInitialSection,
    showHints: navigation.showHints,
    view: navigation.view,
  };
};

/** @param {Parameters<typeof useImmersiveModeAppServices>[0]} props App properties. */
const ImmersiveModeApp = (props) => (
  <ImmersiveModeView {...useImmersiveModeAppServices(props)} />
);

export default ImmersiveModeApp;
