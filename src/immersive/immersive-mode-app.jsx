import { useMemo, useState } from "react";

import ImmersiveModeView from "./immersive-mode-view";
import { useGamepadKeyboardMapper } from "./use-gamepad-keyboard-mapper";
import { useImmersiveModeDisplay } from "./use-immersive-mode-display";
import { useImmersiveModeFavorite } from "./use-immersive-mode-favorite";
import { useImmersiveModeHotkeys } from "./use-immersive-mode-hotkeys";
import { useImmersiveModeLaunch } from "./use-immersive-mode-launch";
import { useImmersiveModeLibrary } from "./use-immersive-mode-library";

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

/** @param {{library: ReturnType<typeof useImmersiveModeLibrary>, display: ReturnType<typeof useImmersiveModeDisplay>, navigation: ReturnType<typeof useImmersiveModeNavigation>, prepareLaunch?: typeof import("./immersive-mode-ipc").prepareAndLaunchGame, toggleGameFavorite?: typeof import("./immersive-mode-ipc").toggleFavorite}} options Immersive command options. */
const useImmersiveModeCommands = ({
  library,
  display,
  navigation,
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
  const { unsupportedGamepad } = useGamepadKeyboardMapper({
    deadzone: display.controllerDeadzone,
    enabled: true,
  });
  return { handleLaunchGame, handleToggleFavorite, unsupportedGamepad };
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

/** @param {{display: ReturnType<typeof useImmersiveModeDisplay>, library: ReturnType<typeof useImmersiveModeLibrary>, navigation: ReturnType<typeof useImmersiveModeNavigation>}} options App callback dependencies. */
const useImmersiveModeAppCallbacks = ({ display, library, navigation }) => {
  const platformDisplayNameById = usePlatformDisplayNames({
    platforms: library.platforms,
  });
  /** @param {number} value Controller deadzone. */
  const handleControllerDeadzoneChange = (value) => {
    display.setControllerDeadzone(value);
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
    platformDisplayNameById,
  };
};

/** @param {{onExit?: () => void|Promise<void>, rommToken?: string|null, rommUrl?: string|null, onRommConnect?: (url: string, token: string) => void, requestedFullscreen?: boolean, dependencies?: {components?: import("./immersive-mode-view").ImmersiveModeComponents, getConfig?: typeof import("./immersive-mode-ipc").getImmersiveConfig, libraryIpc?: import("./use-immersive-mode-library").ImmersiveLibraryIpc, prepareLaunch?: typeof import("./immersive-mode-ipc").prepareAndLaunchGame, saveConfig?: typeof import("./immersive-mode-ipc").saveImmersiveConfig, toggleGameFavorite?: typeof import("./immersive-mode-ipc").toggleFavorite}}} props App properties. */
const useImmersiveModeAppController = ({
  onExit,
  rommToken,
  rommUrl,
  onRommConnect,
  requestedFullscreen = false,
  dependencies = {},
}) => {
  const display = useImmersiveModeDisplay({
    getConfig: dependencies.getConfig,
    requestedFullscreen,
    saveConfig: dependencies.saveConfig,
  });
  const navigation = useImmersiveModeNavigation({ display, onExit });
  const library = useImmersiveModeLibrary({
    ipc: dependencies.libraryIpc,
    onConfigLoaded: display.applyConfig,
    setView: navigation.setView,
    view: navigation.view,
  });
  const commands = useImmersiveModeCommands({
    display,
    library,
    navigation,
    prepareLaunch: dependencies.prepareLaunch,
    toggleGameFavorite: dependencies.toggleGameFavorite,
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
    audioConfig: display.audioConfig,
    components: dependencies.components,
    error: library.error,
    games: library.games,
    handleExit: navigation.handleExit,
    handleLaunchGame: commands.handleLaunchGame,
    handleToggleFavorite: commands.handleToggleFavorite,
    loadData: library.loadData,
    loading: library.loading,
    onControllerDeadzoneChange: callbacks.handleControllerDeadzoneChange,
    onFullscreenChange: callbacks.handleFullscreenChange,
    onImmersiveModeChange: callbacks.handleImmersiveModeChange,
    onRommConnect,
    onSearchChange: library.handleSearchChange,
    onSelectGame: library.handleSelectGame,
    onSelectedIndexChange: library.handleSelectedIndexChange,
    onSelectedPlatformChange: library.handleSelectedPlatformChange,
    openSettings: navigation.openSettings,
    platformDisplayNameById: callbacks.platformDisplayNameById,
    platforms: library.platforms,
    retroachievementsEnabled: display.retroachievementsEnabled,
    rommToken,
    rommUrl,
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
    unsupportedGamepad: commands.unsupportedGamepad,
    view: navigation.view,
  };
};

/** @param {Parameters<typeof useImmersiveModeAppController>[0]} props App properties. */
const ImmersiveModeApp = (props) => (
  <ImmersiveModeView {...useImmersiveModeAppController(props)} />
);

export default ImmersiveModeApp;