import { ARGOSY_SOUND_ENTRIES } from "../argosy-sounds";
import {
  DEFAULT_GAMEPAD_DEADZONE,
  GAMEPAD_DEADZONE_MAX,
  GAMEPAD_DEADZONE_MIN,
  normalizeGamepadDeadzone,
} from "../immersive/use-gamepad-keyboard-mapper";
import { useRomDownloads } from "../rom-downloads-context-value";
import { useAppTheme } from "../theme-context";
import { useUiSounds } from "../ui-sounds-context";
import { createSettingsActions } from "./settings-actions";
import { defaultSettingsRuntime } from "./settings-runtime";
import useSettingsCoreState from "./use-settings-core-state";
import useSettingsEmulatorEvents from "./use-settings-emulator-events";
import useSettingsEmulatorState from "./use-settings-emulator-state";
import useSettingsLibraryState from "./use-settings-library-state";
import useSettingsLifecycle from "./use-settings-lifecycle";
import useSettingsRommLifecycle from "./use-settings-romm-lifecycle";
import useSettingsRommState from "./use-settings-romm-state";
import useSettingsUpdateState from "./use-settings-update-state";

/** @typedef {ReturnType<typeof useSettingsCoreState>} SettingsCoreState */
/** @typedef {ReturnType<typeof useSettingsEmulatorState>} SettingsEmulatorState */
/** @typedef {ReturnType<typeof useSettingsLibraryState>} SettingsLibraryState */
/** @typedef {ReturnType<typeof useSettingsRommState>} SettingsRommState */
/** @typedef {ReturnType<typeof useSettingsUpdateState>} SettingsUpdateState */
/** @typedef {ReturnType<typeof createSettingsActions>} SettingsActions */

/**
 * @param {import("./settings-types").SettingsEmulator[]} emulators Emulators to classify.
 * @returns {{availableEmus: import("./settings-types").SettingsEmulator[], installedEmus: import("./settings-types").SettingsEmulator[], unavailableEmus: import("./settings-types").SettingsEmulator[]}} Emulator groups by availability.
 */
const getEmulatorAvailability = (emulators) => ({
  availableEmus: emulators.filter(
    (emulator) =>
      emulator.is_installed !== true && emulator.has_download === true
  ),
  installedEmus: emulators.filter((emulator) => emulator.is_installed === true),
  unavailableEmus: emulators.filter(
    (emulator) =>
      emulator.is_installed !== true && emulator.has_download !== true
  ),
});

/**
 * @param {{actions: SettingsActions, emulatorState: SettingsEmulatorState, onRommDisconnect: (() => void)|null|undefined, rommState: SettingsRommState, rommToken: string|null, runtime: import("./settings-runtime").SettingsRuntime, updateState: SettingsUpdateState}} context Lifecycle state and actions.
 */
const useSettingsControllerLifecycle = ({
  actions,
  emulatorState,
  onRommDisconnect,
  rommState,
  rommToken,
  runtime,
  updateState,
}) => {
  useSettingsLifecycle({
    actions,
    pairingAttemptRef: rommState.pairingAttemptRef,
    platformDefaults: emulatorState.platformDefaults,
    retroarchCoreReadyPlatformIds: emulatorState.retroarchCoreReadyPlatformIds,
    runtime,
    setAppVersion: updateState.setAppVersion,
    setPlatformDefaults: emulatorState.setPlatformDefaults,
    setRommDeviceName: rommState.setRommDeviceName,
  });
  useSettingsRommLifecycle({
    onRommDisconnect,
    rommToken,
    rommUrl: rommState.rommUrl,
    runtime,
    setRommConnectionStatus: rommState.setRommConnectionStatus,
    setRommDirectToken: rommState.setRommDirectToken,
    setRommSessionSaved: rommState.setRommSessionSaved,
    setRommStatus: rommState.setRommStatus,
    setRommSyncMetadata: rommState.setRommSyncMetadata,
  });
  useSettingsEmulatorEvents({
    runtime,
    setEmuInstallProgress: emulatorState.setEmuInstallProgress,
  });
};

/**
 * @param {{accentHue: number|null, actions: SettingsActions, activeRomDownloadCount: number, coreState: SettingsCoreState, emulatorState: SettingsEmulatorState, libraryState: SettingsLibraryState, onFullscreenChange: ((enabled: boolean) => void)|null, onImmersiveModeChange: ((enabled: boolean) => void)|null, onRetroAchievementsChange: ((enabled: boolean) => void)|null, onLibraryChange: (() => void|Promise<void>)|null|undefined, previewArgosySound: ReturnType<typeof useUiSounds>["previewArgosySound"], rommState: SettingsRommState, runtime: import("./settings-runtime").SettingsRuntime, setAccentHue: ReturnType<typeof useAppTheme>["setAccentHue"], setThemeMode: ReturnType<typeof useAppTheme>["setThemeMode"], setUiSoundsVolume: ReturnType<typeof useUiSounds>["setUiSoundsVolume"], themeMode: ReturnType<typeof useAppTheme>["themeMode"], uiSoundsEnabled: ReturnType<typeof useUiSounds>["uiSoundsEnabled"], uiSoundsVolume: ReturnType<typeof useUiSounds>["uiSoundsVolume"], updateState: SettingsUpdateState}} context Controller state and actions.
 * @returns {import("./settings-types").SettingsPanelProps} Settings panel state and actions.
 */
const buildSettingsControllerValue = ({
  accentHue,
  actions,
  activeRomDownloadCount,
  coreState,
  emulatorState,
  libraryState,
  onFullscreenChange,
  onImmersiveModeChange,
  onRetroAchievementsChange,
  onLibraryChange,
  previewArgosySound,
  rommState,
  runtime,
  setAccentHue,
  setThemeMode,
  setUiSoundsVolume,
  themeMode,
  uiSoundsEnabled,
  uiSoundsVolume,
  updateState,
}) => {
  const { availableEmus, installedEmus, unavailableEmus } =
    getEmulatorAvailability(emulatorState.emulators);
  const rommSessionActive =
    rommState.rommSessionSaved || rommState.rommConnectionStatus === "online";
  return {
    ...actions,
    ...coreState,
    ...emulatorState,
    ...libraryState,
    ...rommState,
    ...updateState,
    accentHue,
    activeRomDownloadCount,
    argosySoundEntries: ARGOSY_SOUND_ENTRIES,
    availableEmus,
    defaultGamepadDeadzone: DEFAULT_GAMEPAD_DEADZONE,
    gamepadDeadzoneMax: GAMEPAD_DEADZONE_MAX,
    gamepadDeadzoneMin: GAMEPAD_DEADZONE_MIN,
    installedEmus,
    normalizeGamepadDeadzone,
    onFullscreenChange,
    onImmersiveModeChange,
    onLibraryChange,
    onRetroAchievementsChange,
    previewArgosySound,
    rommSessionActive,
    rommUrlLocked: rommSessionActive,
    runtime,
    setAccentHue,
    setThemeMode,
    setUiSoundsVolume,
    themeMode,
    uiSoundsEnabled,
    uiSoundsVolume,
    unavailableEmus,
  };
};

/** @param {{initialSection: string, rommToken: string|null, rommUrl: string|undefined}} props Settings state inputs. @returns {{coreState: SettingsCoreState, emulatorState: SettingsEmulatorState, libraryState: SettingsLibraryState, rommState: SettingsRommState, updateState: SettingsUpdateState}} Settings state groups. */
const useSettingsControllerStates = ({
  initialSection,
  rommToken,
  rommUrl,
}) => {
  const coreState = useSettingsCoreState();
  const rommState = useSettingsRommState({ rommToken, rommUrl });
  const emulatorState = useSettingsEmulatorState();
  const libraryState = useSettingsLibraryState();
  const updateState = useSettingsUpdateState({
    initialSection: initialSection || "general",
  });
  return { coreState, emulatorState, libraryState, rommState, updateState };
};

/** @param {{rommToken: string|null, rommUrl?: string, onRommConnect?: (url: string, token: string) => void, onRommDisconnect?: (() => void)|null, onLibraryChange?: (() => void|Promise<void>)|null, onImmersiveModeChange?: ((enabled: boolean) => void)|null, onFullscreenChange?: ((enabled: boolean) => void)|null, onRetroAchievementsChange?: ((enabled: boolean) => void)|null, onControllerDeadzoneChange?: ((value: number) => void)|null, onBack?: () => void, initialSection?: string, dependencies?: Partial<import("./settings-runtime").SettingsRuntime>}} props Settings properties. @returns {import("./settings-types").SettingsPanelProps} Settings state and actions. */
const useSettingsController = ({
  rommToken,
  rommUrl: rommUrlProp,
  onRommConnect,
  onRommDisconnect = null,
  onLibraryChange,
  onImmersiveModeChange = null,
  onFullscreenChange = null,
  onRetroAchievementsChange = null,
  onControllerDeadzoneChange = null,
  initialSection = "general",
  dependencies = {},
}) => {
  const runtime = { ...defaultSettingsRuntime, ...dependencies };
  const { activeCount: activeRomDownloadCount } = useRomDownloads();
  const { themeMode, setThemeMode, accentHue, setAccentHue } = useAppTheme();
  const {
    uiSoundsEnabled,
    uiSoundsVolume,
    setUiSoundsEnabled,
    setUiSoundsVolume,
    refreshUiSoundsFromConfig,
    previewArgosySound,
  } = useUiSounds();
  const controllerStates = useSettingsControllerStates({
    initialSection,
    rommToken,
    rommUrl: rommUrlProp,
  });
  const { coreState, emulatorState, libraryState, rommState, updateState } =
    controllerStates;
  const actions = createSettingsActions({
    activeRomDownloadCount,
    ...controllerStates,
    normalizeGamepadDeadzone,
    onControllerDeadzoneChange,
    onLibraryChange,
    onRetroAchievementsChange,
    onRommConnect,
    onRommDisconnect,
    refreshUiSoundsFromConfig,
    rommToken,
    rommUrlProp,
    runtime,
    setUiSoundsEnabled,
    setUiSoundsVolume,
  });
  useSettingsControllerLifecycle({
    actions,
    emulatorState,
    onRommDisconnect,
    rommState,
    rommToken,
    runtime,
    updateState,
  });
  return buildSettingsControllerValue({
    accentHue,
    actions,
    activeRomDownloadCount,
    coreState,
    emulatorState,
    libraryState,
    onFullscreenChange,
    onImmersiveModeChange,
    onLibraryChange,
    onRetroAchievementsChange,
    previewArgosySound,
    rommState,
    runtime,
    setAccentHue,
    setThemeMode,
    setUiSoundsVolume,
    themeMode,
    uiSoundsEnabled,
    uiSoundsVolume,
    updateState,
  });
};

export default useSettingsController;
