import { createSettingsAudioActions } from "./settings-audio-actions";
import { createSettingsConfigActions } from "./settings-config-actions";
import { createSettingsEmulatorActions } from "./settings-emulator-actions";
import { createSettingsRommActions } from "./settings-romm-actions";
import { createSettingsStorageActions } from "./settings-storage-actions";
import { createSettingsUpdateActions } from "./settings-update-actions";

/** @typedef {ReturnType<typeof import("./use-settings-core-state").default>} SettingsCoreState */
/** @typedef {ReturnType<typeof import("./use-settings-emulator-state").default>} SettingsEmulatorState */
/** @typedef {ReturnType<typeof import("./use-settings-library-state").default>} SettingsLibraryState */
/** @typedef {ReturnType<typeof import("./use-settings-romm-state").default>} SettingsRommState */
/** @typedef {ReturnType<typeof import("./use-settings-update-state").default>} SettingsUpdateState */
/** @typedef {{activeRomDownloadCount: number, coreState: SettingsCoreState, emulatorState: SettingsEmulatorState, libraryState: SettingsLibraryState, rommState: SettingsRommState, runtime: import("./settings-runtime").SettingsRuntime, updateState: SettingsUpdateState, normalizeGamepadDeadzone: (value: number) => number, onControllerDeadzoneChange?: ((value: number) => void)|null, onLibraryChange?: (() => void|Promise<void>)|null, onRommConnect?: (url: string, token: string) => void, onRommDisconnect?: (() => void)|null, refreshUiSoundsFromConfig: (config: import("./settings-types").SettingsConfig) => void, rommToken: string|null, rommUrlProp?: string, setUiSoundsEnabled: (value: boolean) => void, setUiSoundsVolume: (value: number) => void}} SettingsActionsContext */

/** @param {SettingsActionsContext} context Settings state and service dependencies. */
const createStorageActions = (context) =>
  createSettingsStorageActions({
    ...context.libraryState,
    activeRomDownloadCount: context.activeRomDownloadCount,
    config: context.coreState.config,
    onLibraryChange: context.onLibraryChange,
    runtime: context.runtime,
    setConfig: context.coreState.setConfig,
    setScanMessage: context.coreState.setScanMessage,
  });

/** @param {SettingsActionsContext} context Settings state and service dependencies. @param {ReturnType<typeof createStorageActions>} storageActions Storage actions. */
const createConfigActions = (context, storageActions) =>
  createSettingsConfigActions({
    ...context.rommState,
    ...context.updateState,
    config: context.coreState.config,
    loadStorageOverview: storageActions.loadStorageOverview,
    normalizeGamepadDeadzone: context.normalizeGamepadDeadzone,
    refreshUiSoundsFromConfig: context.refreshUiSoundsFromConfig,
    rommUrlProp: context.rommUrlProp,
    runtime: context.runtime,
    setAmbientEnabled: context.coreState.setAmbientEnabled,
    setAmbientIsFolder: context.coreState.setAmbientIsFolder,
    setAmbientPath: context.coreState.setAmbientPath,
    setAmbientShuffle: context.coreState.setAmbientShuffle,
    setAmbientVolume: context.coreState.setAmbientVolume,
    setConfig: context.coreState.setConfig,
    setControllerDeadzone: context.coreState.setControllerDeadzone,
    setFullscreenEnabled: context.coreState.setFullscreenEnabled,
    setImmersiveModeEnabled: context.coreState.setImmersiveModeEnabled,
    setRommAuthMode: context.rommState.setRommAuthMode,
    setRommSessionSaved: context.rommState.setRommSessionSaved,
    setRommSyncMetadata: context.rommState.setRommSyncMetadata,
    setRommUrl: context.rommState.setRommUrl,
    setRomsDirectory: context.libraryState.setRomsDirectory,
  });

/** @param {SettingsActionsContext} context Settings state and service dependencies. @param {ReturnType<typeof createConfigActions>} configActions Configuration actions. */
const createEmulatorActions = (context, configActions) =>
  createSettingsEmulatorActions({
    ...context.emulatorState,
    config: context.coreState.config,
    loadConfig: configActions.loadConfig,
    runtime: context.runtime,
    setConfig: context.coreState.setConfig,
  });

/** @param {SettingsActionsContext} context Settings state and service dependencies. */
const createAudioActions = (context) =>
  createSettingsAudioActions({
    config: context.coreState.config,
    normalizeGamepadDeadzone: context.normalizeGamepadDeadzone,
    onControllerDeadzoneChange: context.onControllerDeadzoneChange,
    onLibraryChange: context.onLibraryChange,
    refreshUiSoundsFromConfig: context.refreshUiSoundsFromConfig,
    runtime: context.runtime,
    setAmbientEnabled: context.coreState.setAmbientEnabled,
    setAmbientIsFolder: context.coreState.setAmbientIsFolder,
    setAmbientPath: context.coreState.setAmbientPath,
    setAmbientShuffle: context.coreState.setAmbientShuffle,
    setAmbientVolume: context.coreState.setAmbientVolume,
    setConfig: context.coreState.setConfig,
    setControllerDeadzone: context.coreState.setControllerDeadzone,
    setFullscreenEnabled: context.coreState.setFullscreenEnabled,
    setImmersiveModeEnabled: context.coreState.setImmersiveModeEnabled,
    setUiSoundsEnabled: context.setUiSoundsEnabled,
    setUiSoundsVolume: context.setUiSoundsVolume,
  });

/** @param {SettingsActionsContext} context Settings state and service dependencies. */
const createRommActions = (context) =>
  createSettingsRommActions({
    ...context.rommState,
    onRommConnect: context.onRommConnect,
    onRommDisconnect: context.onRommDisconnect,
    rommToken: context.rommToken,
    runtime: context.runtime,
  });

/** @param {SettingsActionsContext} context Settings state and service dependencies. */
const createUpdateActions = (context) =>
  createSettingsUpdateActions({
    ...context.updateState,
    config: context.coreState.config,
    runtime: context.runtime,
    setConfig: context.coreState.setConfig,
  });

/** @param {SettingsActionsContext} context Settings state, callbacks, and service dependencies. */
export const createSettingsActions = (context) => {
  const storageActions = createStorageActions(context);
  const configActions = createConfigActions(context, storageActions);
  const emulatorActions = createEmulatorActions(context, configActions);
  const audioActions = createAudioActions(context);
  const rommActions = createRommActions(context);
  const updateActions = createUpdateActions(context);
  return {
    ...audioActions,
    ...configActions,
    ...emulatorActions,
    ...rommActions,
    ...storageActions,
    ...updateActions,
  };
};
