import { getUpdatePreference } from "./update-preferences";

/** @typedef {{romm?: {server_url?: string, auth_method?: string, auto_sync?: boolean}, display?: {big_picture?: boolean, fullscreen?: boolean, controller_deadzone?: number}, audio?: {ambient_enabled?: boolean, ambient_volume?: number, ambient_path?: string|null, ambient_is_folder?: boolean, ambient_shuffle?: boolean}, updater?: {channel?: "stable"|"beta"|"nightly"}, library?: {roms_directory?: string|null}, emulators?: {retroarch_use_beta_profile?: boolean}}} SettingsConfig */
/** @typedef {{type: "error"|"warning"|"info"|"success", message: string}} SettingsMessage */
/** @template T @typedef {(value: T | ((previous: T) => T)) => void} SettingsSetter */
/** @typedef {{config: SettingsConfig|null, runtime: import("./settings-runtime").SettingsRuntime, setConfig: SettingsSetter<SettingsConfig|null>, rommUrlProp?: string, setRommUrl: SettingsSetter<string>, setRommAuthMode: SettingsSetter<string>, setRommSessionSaved: SettingsSetter<boolean>, setRommSyncMetadata: SettingsSetter<object>, setRomsDirectory: SettingsSetter<string>, setImmersiveModeEnabled: SettingsSetter<boolean>, setFullscreenEnabled: SettingsSetter<boolean>, setControllerDeadzone: SettingsSetter<number>, normalizeGamepadDeadzone: (value: number) => number, setUpdatePreference: SettingsSetter<string>, setUpdateChannel: SettingsSetter<"stable"|"beta"|"nightly">, setAmbientEnabled: SettingsSetter<boolean>, setAmbientVolume: SettingsSetter<number>, setAmbientPath: SettingsSetter<string|null>, setAmbientIsFolder: SettingsSetter<boolean>, setAmbientShuffle: SettingsSetter<boolean>, refreshUiSoundsFromConfig: (config: SettingsConfig) => void, loadStorageOverview: () => Promise<void>, setSupportMessage: SettingsSetter<SettingsMessage|null>}} ConfigActionsContext */

const BETA_BUG_REPORT_URL =
  "https://github.com/auron-labs/wingosy-launcher/issues/new?template=bug_report.md";

/** @param {unknown} error Error from a settings operation. */
const getErrorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

/** @param {SettingsConfig} config Loaded configuration. @param {SettingsSetter<string>} setRommAuthMode RomM authentication mode setter. */
const applyRommAuthMode = (config, setRommAuthMode) => {
  const authMethod = config.romm?.auth_method;
  if (authMethod === "token" || authMethod === "pairing") {
    setRommAuthMode(authMethod);
  }
};

/** @param {ConfigActionsContext} context Settings state. @param {SettingsConfig} config Loaded configuration. */
const applyLoadedConfig = async (context, config) => {
  const {
    setConfig,
    rommUrlProp,
    setRommUrl,
    setRommAuthMode,
    setRommSessionSaved,
    setRommSyncMetadata,
    setRomsDirectory,
    setImmersiveModeEnabled,
    setFullscreenEnabled,
    setControllerDeadzone,
    normalizeGamepadDeadzone,
    setUpdatePreference,
    setUpdateChannel,
    setAmbientEnabled,
    setAmbientVolume,
    setAmbientPath,
    setAmbientIsFolder,
    setAmbientShuffle,
    refreshUiSoundsFromConfig,
  } = context;
  setConfig(config);
  setRommSyncMetadata((previous) => ({
    ...previous,
    autoSync: config.romm?.auto_sync === true,
  }));
  setRommUrl(config.romm?.server_url ?? rommUrlProp ?? "");
  applyRommAuthMode(config, setRommAuthMode);
  try {
    /** @type {boolean} */
    const saved = await context.runtime.invoke("has_saved_romm_session");
    setRommSessionSaved(saved);
  } catch {
    setRommSessionSaved(false);
  }
  setRomsDirectory(config.library?.roms_directory ?? "");
  setImmersiveModeEnabled(config.display?.big_picture === true);
  setFullscreenEnabled(config.display?.fullscreen === true);
  setControllerDeadzone(
    normalizeGamepadDeadzone(config.display?.controller_deadzone ?? 0.35)
  );
  setUpdatePreference(getUpdatePreference(config.updater));
  const channel = config.updater?.channel;
  setUpdateChannel(
    channel === "nightly" || channel === "beta" ? channel : "stable"
  );
  const audio = config.audio ?? {};
  setAmbientEnabled(audio.ambient_enabled === true);
  setAmbientVolume(audio.ambient_volume ?? 35);
  setAmbientPath(audio.ambient_path ?? null);
  setAmbientIsFolder(audio.ambient_is_folder === true);
  setAmbientShuffle(audio.ambient_shuffle === true);
  refreshUiSoundsFromConfig(config);
};

/** @param {ConfigActionsContext} context Settings state. */
const loadConfig = async (context) => {
  try {
    /** @type {SettingsConfig} */
    const config = await context.runtime.invoke("get_config");
    await applyLoadedConfig(context, config);
    await context.loadStorageOverview();
  } catch {
    // Configuration loading is retried by the surrounding settings lifecycle.
  }
};

/** @param {{runtime: import("./settings-runtime").SettingsRuntime, setSupportMessage: SettingsSetter<SettingsMessage|null>}} context Settings state. */
const handleOpenLogsFolder = async ({ runtime, setSupportMessage }) => {
  try {
    setSupportMessage(null);
    await runtime.invoke("open_logs_folder");
  } catch (error) {
    setSupportMessage({ message: getErrorMessage(error), type: "error" });
  }
};

/** @param {{runtime: import("./settings-runtime").SettingsRuntime, setSupportMessage: SettingsSetter<SettingsMessage|null>}} context Settings state. */
const handleReportProblem = async ({ runtime, setSupportMessage }) => {
  try {
    setSupportMessage(null);
    await runtime.shellOpen(BETA_BUG_REPORT_URL);
  } catch (error) {
    setSupportMessage({ message: getErrorMessage(error), type: "error" });
  }
};

/** @param {ConfigActionsContext} context Settings state. */
export const createSettingsConfigActions = (context) => ({
  handleOpenLogsFolder: async () => {
    await handleOpenLogsFolder(context);
  },
  handleReportProblem: async () => {
    await handleReportProblem(context);
  },
  loadConfig: async () => {
    await loadConfig(context);
  },
});
