import { applyUpdatePreference } from "./update-preferences";

/** @typedef {{current_version: string, latest_version: string|null, release_url: string|null, signed_update_manifest_url: string|null, is_update_available: boolean, channel: "stable"|"beta"|"nightly", error?: string}} UpdateCheckResult */
/** @typedef {{updater?: {channel?: "stable"|"beta"|"nightly", auto_update_enabled?: boolean, check_on_startup?: boolean}}} SettingsConfig */
/** @typedef {{type: "error"|"warning"|"info"|"success", message: string}} SettingsMessage */
/** @typedef {{config: SettingsConfig|null, runtime: import("./settings-runtime").SettingsRuntime, setConfig: SettingsSetter<SettingsConfig|null>, updateChannel: "stable"|"beta"|"nightly", setUpdateChannel: SettingsSetter<"stable"|"beta"|"nightly">, setUpdatePreference: SettingsSetter<string>, setLeavingPrereleaseChannel: SettingsSetter<"nightly"|"beta"|null>, setPendingChannel: SettingsSetter<"stable"|"beta"|"nightly">, setPrereleaseLeaveDialogOpen: SettingsSetter<boolean>, pendingChannel: "stable"|"beta"|"nightly", appVersion: string, setUpdateCheckLoading: SettingsSetter<boolean>, setUpdateCheckResult: SettingsSetter<UpdateCheckResult|null>, setUpdateMessage: SettingsSetter<SettingsMessage|null>, updateCheckResult: UpdateCheckResult|null, signedUpdateInstalling: boolean, setSignedUpdateInstalling: SettingsSetter<boolean>}} UpdateActionsContext */
/** @template T @typedef {(value: T | ((previous: T) => T)) => void} SettingsSetter */

/** @param {{config: SettingsConfig|null, runtime: import("./settings-runtime").SettingsRuntime}} context Settings configuration context. */
const readSettingsConfig = async ({ config, runtime }) => {
  /** @type {SettingsConfig|null} */
  const current = config ?? (await runtime.invoke("get_config"));
  if (current === null) {
    throw new Error("Configuration is unavailable");
  }
  return structuredClone(current);
};

/** @param {{config: SettingsConfig|null, runtime: import("./settings-runtime").SettingsRuntime, setConfig: SettingsSetter<SettingsConfig|null>, setUpdateChannel: SettingsSetter<"stable"|"beta"|"nightly">}} context Settings state. @param {"stable"|"beta"|"nightly"} nextChannel Channel to apply. */
const applyUpdateChannel = async (
  { config, runtime, setConfig, setUpdateChannel },
  nextChannel
) => {
  try {
    const cfg = await readSettingsConfig({ config, runtime });
    cfg.updater ??= {};
    cfg.updater.channel = nextChannel;
    await runtime.invoke("save_config", { config: cfg });
    setConfig(cfg);
    setUpdateChannel(nextChannel);
  } catch {
    // Settings persistence is best-effort while the backend is unavailable.
  }
};

/** @param {Pick<UpdateActionsContext, "updateChannel"|"setLeavingPrereleaseChannel"|"setPendingChannel"|"setPrereleaseLeaveDialogOpen"> & {applyUpdateChannel: (channel: "stable"|"beta"|"nightly") => Promise<void>}} context Settings state. @param {"stable"|"beta"|"nightly"} nextChannel Requested channel. */
const requestChannelChange = (
  {
    updateChannel,
    setLeavingPrereleaseChannel,
    setPendingChannel,
    setPrereleaseLeaveDialogOpen,
    applyUpdateChannel: applyChannel,
  },
  nextChannel
) => {
  const leavingPrerelease =
    updateChannel === "nightly" || updateChannel === "beta";
  if (leavingPrerelease && nextChannel !== updateChannel) {
    setLeavingPrereleaseChannel(updateChannel);
    setPendingChannel(nextChannel);
    setPrereleaseLeaveDialogOpen(true);
    return;
  }
  void applyChannel(nextChannel);
};

/** @param {Pick<UpdateActionsContext, "config"|"pendingChannel"|"runtime"|"setConfig"|"setUpdateChannel"|"setPrereleaseLeaveDialogOpen"|"setLeavingPrereleaseChannel"|"setPendingChannel">} context Settings state. */
const confirmPrereleaseLeave = async ({
  config,
  pendingChannel,
  runtime,
  setConfig,
  setUpdateChannel,
  setPrereleaseLeaveDialogOpen,
  setLeavingPrereleaseChannel,
  setPendingChannel,
}) => {
  try {
    const cfg = await readSettingsConfig({ config, runtime });
    cfg.updater ??= {};
    cfg.updater.channel = pendingChannel;
    await runtime.invoke("save_config", { config: cfg });
    setConfig(cfg);
    setUpdateChannel(pendingChannel);
  } catch {
    // Settings persistence is best-effort while the backend is unavailable.
  }
  setPrereleaseLeaveDialogOpen(false);
  setLeavingPrereleaseChannel(null);
  setPendingChannel("stable");
};

/** @param {Pick<UpdateActionsContext, "setPrereleaseLeaveDialogOpen"|"setLeavingPrereleaseChannel"|"setPendingChannel">} context Settings state. */
const cancelPrereleaseLeave = ({
  setPrereleaseLeaveDialogOpen,
  setLeavingPrereleaseChannel,
  setPendingChannel,
}) => {
  setPrereleaseLeaveDialogOpen(false);
  setLeavingPrereleaseChannel(null);
  setPendingChannel("stable");
};

/** @param {{config: SettingsConfig|null, runtime: import("./settings-runtime").SettingsRuntime, setConfig: SettingsSetter<SettingsConfig|null>, setUpdatePreference: SettingsSetter<string>}} context Settings state. @param {"off"|"check-only"|"automatic"} nextPreference Update preference. */
const persistUpdatePreference = async (
  { config, runtime, setConfig, setUpdatePreference },
  nextPreference
) => {
  try {
    const current = await readSettingsConfig({ config, runtime });
    const nextConfig = applyUpdatePreference(current, nextPreference);
    await runtime.invoke("save_config", { config: nextConfig });
    setConfig(nextConfig);
    setUpdatePreference(nextPreference);
  } catch {
    // Settings persistence is best-effort while the backend is unavailable.
  }
};

/** @param {Pick<UpdateActionsContext, "updateChannel"|"appVersion"|"runtime"|"setUpdateCheckLoading"|"setUpdateCheckResult"|"setUpdateMessage">} context Settings state. */
const handleCheckForUpdates = async ({
  runtime,
  updateChannel,
  appVersion,
  setUpdateCheckLoading,
  setUpdateCheckResult,
  setUpdateMessage,
}) => {
  setUpdateCheckLoading(true);
  setUpdateCheckResult(null);
  setUpdateMessage(null);
  try {
    /** @type {UpdateCheckResult} */
    const result = await runtime.invoke("check_for_app_update", {
      channel: updateChannel,
    });
    setUpdateCheckResult(result);
  } catch (error) {
    setUpdateCheckResult({
      channel: updateChannel,
      current_version: appVersion,
      error: error instanceof Error ? error.message : String(error),
      is_update_available: false,
      latest_version: null,
      release_url: null,
      signed_update_manifest_url: null,
    });
  } finally {
    setUpdateCheckLoading(false);
  }
};

/** @param {Pick<UpdateActionsContext, "updateCheckResult"|"signedUpdateInstalling"|"updateChannel"|"runtime"|"setSignedUpdateInstalling"|"setUpdateMessage">} context Settings state. */
const handleInstallSignedUpdateFromSettings = async ({
  runtime,
  updateCheckResult,
  signedUpdateInstalling,
  updateChannel,
  setSignedUpdateInstalling,
  setUpdateMessage,
}) => {
  const manifestUrl = updateCheckResult?.signed_update_manifest_url;
  if (manifestUrl === undefined || manifestUrl === null || manifestUrl === "") {
    return;
  }
  if (signedUpdateInstalling) {
    return;
  }
  setSignedUpdateInstalling(true);
  setUpdateMessage({
    message: "Downloading and installing update…",
    type: "info",
  });
  /** @type {(() => void)|undefined} */
  let unlistenProgress;
  try {
    unlistenProgress = await runtime.listen(
      "signed-updater-progress",
      (event) => {
        /** @type {{payload?: {downloaded?: number, total?: number}}} */
        const progressEvent = event;
        const downloaded = progressEvent.payload?.downloaded;
        const total = progressEvent.payload?.total;
        const label =
          downloaded !== undefined && total !== undefined && total > 0
            ? `Downloading update… ${Math.min(100, Math.round((downloaded / total) * 100))}%`
            : "Downloading update…";
        setUpdateMessage({ message: label, type: "info" });
      }
    );
  } catch {
    unlistenProgress = undefined;
  }
  try {
    await runtime.invoke("install_signed_app_update", {
      channel: updateChannel,
    });
  } catch (error) {
    setUpdateMessage({
      message: error instanceof Error ? error.message : String(error),
      type: "error",
    });
    setSignedUpdateInstalling(false);
  }
  unlistenProgress?.();
};

/** @param {UpdateActionsContext} context Settings state and setters. */
export const createSettingsUpdateActions = (context) => ({
  /** @param {"stable"|"beta"|"nightly"} nextChannel Requested update channel. */
  applyUpdateChannel: async (nextChannel) => {
    await applyUpdateChannel(context, nextChannel);
  },
  cancelPrereleaseLeave: () => {
    cancelPrereleaseLeave(context);
  },
  confirmPrereleaseLeave: async () => {
    await confirmPrereleaseLeave(context);
  },
  handleCheckForUpdates: async () => {
    await handleCheckForUpdates(context);
  },
  handleInstallSignedUpdateFromSettings: async () => {
    await handleInstallSignedUpdateFromSettings(context);
  },
  /** @param {"off"|"check-only"|"automatic"} nextPreference Requested update preference. */
  persistUpdatePreference: async (nextPreference) => {
    await persistUpdatePreference(context, nextPreference);
  },
  /** @param {"stable"|"beta"|"nightly"} nextChannel Requested update channel. */
  requestChannelChange: (nextChannel) => {
    requestChannelChange(
      {
        ...context,
        applyUpdateChannel: async (channel) => {
          await applyUpdateChannel(context, channel);
        },
      },
      nextChannel
    );
  },
});

export { getUpdatePreference } from "./update-preferences";
