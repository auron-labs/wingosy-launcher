import { useCallback, useEffect, useRef, useState } from "react";

import { debugLog } from "../utils/debug-log";
import { isTauri } from "../utils/is-tauri";
import { setFullscreenReliable } from "../window-fullscreen";

/** @typedef {import("./app-runtime").AppRuntime} AppRuntime */
/** @typedef {{id: string, name: string}} AppPlatform */
/** @typedef {{server_url?: string, auth_token?: string}} RommConfig */
/** @typedef {{big_picture?: boolean, fullscreen?: boolean, controller_deadzone?: number, theme?: string}} DisplayConfig */
/** @typedef {{auto_update_enabled?: boolean, channel?: string, check_on_startup?: boolean}} UpdaterConfig */
/** @typedef {{romm?: RommConfig, display?: DisplayConfig, library?: {roms_directory?: string}, updater?: UpdaterConfig}} AppConfig */
/** @typedef {{is_update_available?: boolean, signed_update_manifest_url?: string, release_url?: string, latest_version?: string, message?: string}} UpdateResult */
/** @typedef {{canInstall: boolean, channel: "stable"|"beta"|"nightly", installing: boolean, open: boolean, progressLabel: string, url: string, version: string}} UpdateSnack */

/** @param {unknown} error - Error value from an IPC boundary. */
const getErrorMessage = (error) => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

/** @param {unknown} value - Configured release channel. */
const toUpdateChannel = (value) =>
  value === "nightly" || value === "beta" ? value : "stable";

/** @type {[AppPlatform, number][]} */
const EMPTY_PLATFORMS = [];

/** @type {UpdateSnack} */
const INITIAL_UPDATE_SNACK = {
  canInstall: false,
  channel: "stable",
  installing: false,
  open: false,
  progressLabel: "",
  url: "",
  version: "",
};

/** @returns {boolean|null} Initial setup state. */
const initialSetupState = () => null;

/** @returns {string|null} Initial session token. */
const initialToken = () => null;

/** @param {{config: AppConfig, runtime: AppRuntime, setRommToken: (token: string) => void, setRommUrl: (url: string) => void}} options - Session restore dependencies. */
const restoreRomMSession = async ({
  runtime,
  config,
  setRommUrl,
  setRommToken,
}) => {
  if (config.romm?.server_url === undefined || config.romm.server_url === "") {
    return;
  }
  try {
    const session = await runtime.invoke("restore_romm_session");
    if (
      session.access_token === undefined ||
      session.access_token === "" ||
      session.server_url === undefined ||
      session.server_url === ""
    ) {
      return;
    }
    setRommUrl(session.server_url);
    setRommToken(session.access_token);
  } catch (error) {
    console.warn("[Wingosy] Could not restore RomM session:", error);
  }
};

/** @param {{config: AppConfig, runtime: AppRuntime, setError: (message: string) => void, setUpdateSnack: (snack: UpdateSnack) => void}} options - Startup update dependencies. */
const checkStartupUpdate = async ({
  runtime,
  config,
  setError,
  setUpdateSnack,
}) => {
  if (config.updater?.check_on_startup === false) {
    return;
  }
  const channel = toUpdateChannel(config.updater?.channel);
  try {
    const result = await runtime.invoke("check_for_app_update", { channel });
    if (result.is_update_available !== true) {
      return;
    }
    if (
      config.updater?.auto_update_enabled === true &&
      result.signed_update_manifest_url !== undefined &&
      result.signed_update_manifest_url !== ""
    ) {
      try {
        await runtime.invoke("install_signed_app_update", { channel });
      } catch (error) {
        setError(getErrorMessage(error));
      }
      return;
    }
    if (result.release_url !== undefined && result.release_url !== "") {
      setUpdateSnack({
        canInstall: Boolean(result.signed_update_manifest_url),
        channel,
        installing: false,
        open: true,
        progressLabel: "",
        url: result.release_url,
        version: result.latest_version ?? "",
      });
    }
  } catch {
    // Update checks are best effort during startup.
  }
};

/** @param {string|undefined} value Configured string value. @returns {value is string} Whether the value is configured. */
const hasConfiguredValue = (value) => value !== undefined && value !== "";

/** @param {AppConfig} config Loaded application configuration. @param {RommConfig|undefined} romm RomM configuration. */
const logStartupConfig = (config, romm) => {
  debugLog("startup", "configuration loaded", {
    controllerDeadzone: config.display?.controller_deadzone ?? null,
    fullscreen: Boolean(config.display?.fullscreen),
    immersiveMode: Boolean(config.display?.big_picture),
    rommConfigured: Boolean(romm?.server_url),
    romsDirectoryConfigured: Boolean(config.library?.roms_directory),
    theme: config.display?.theme ?? null,
    updater: {
      autoUpdateEnabled: Boolean(config.updater?.auto_update_enabled),
      channel: config.updater?.channel ?? "stable",
      checkOnStartup: config.updater?.check_on_startup !== false,
    },
  });
};

/** @param {RommConfig|undefined} romm RomM configuration. @param {(url: string) => void} setRommUrl URL setter. @param {(token: string) => void} setRommToken Token setter. */
const applyRommConfig = (romm, setRommUrl, setRommToken) => {
  if (hasConfiguredValue(romm?.server_url)) {
    setRommUrl(romm.server_url);
  }
  if (hasConfiguredValue(romm?.auth_token)) {
    setRommToken(romm.auth_token);
  }
};

/**
 * @typedef {object} StartupConfigOptions
 * @property {AppConfig} config - Loaded application configuration.
 * @property {AppRuntime} runtime - Tauri runtime adapter.
 * @property {{current: boolean}} rommSessionRestoreStarted - RomM restore guard.
 * @property {(message: string|null) => void} setError - Error state setter.
 * @property {(enabled: boolean) => void} setImmersiveModeEnabled - Immersive mode setter.
 * @property {(enabled: boolean) => void} setImmersiveModeFullscreen - Fullscreen state setter.
 * @property {(token: string|null) => void} setRommToken - RomM token setter.
 * @property {(url: string) => void} setRommUrl - RomM URL setter.
 * @property {(snack: UpdateSnack) => void} setUpdateSnack - Update notification setter.
 * @property {{current: boolean}} startupUpdateCheckDone - Update check guard.
 */
/** @param {StartupConfigOptions} options - Startup configuration dependencies. */
const applyStartupConfig = ({
  config,
  runtime,
  rommSessionRestoreStarted,
  setImmersiveModeEnabled,
  setImmersiveModeFullscreen,
  setRommToken,
  setRommUrl,
  setError,
  setUpdateSnack,
  startupUpdateCheckDone,
}) => {
  const { romm } = config;
  applyRommConfig(romm, setRommUrl, setRommToken);
  logStartupConfig(config, romm);
  setImmersiveModeEnabled(Boolean(config.display?.big_picture));
  setImmersiveModeFullscreen(Boolean(config.display?.fullscreen));
  if (
    hasConfiguredValue(romm?.server_url) &&
    !rommSessionRestoreStarted.current
  ) {
    rommSessionRestoreStarted.current = true;
    void restoreRomMSession({ config, runtime, setRommToken, setRommUrl });
  }
  if (!startupUpdateCheckDone.current) {
    startupUpdateCheckDone.current = true;
    void checkStartupUpdate({ config, runtime, setError, setUpdateSnack });
  }
};

/** @param {AppRuntime} runtime - Tauri boundary used for window operations. */
const useFullscreenHotkey = (runtime) => {
  useEffect(() => {
    /** @param {KeyboardEvent} event - Keyboard input from the app window. */
    const onKeyDown = (event) => {
      if (event.key !== "F11") {
        return;
      }
      event.preventDefault();
      void (async () => {
        try {
          const appWindow = runtime.getCurrentWindow();
          const next = !(await appWindow.isFullscreen());
          await setFullscreenReliable(next);
        } catch {
          // Ignore unavailable window operations in web preview.
        }
      })();
    };
    if (isTauri()) {
      window.addEventListener("keydown", onKeyDown);
    }
    return () => {
      if (isTauri()) {
        window.removeEventListener("keydown", onKeyDown);
      }
    };
  }, [runtime]);
};

/** @param {{runtime: AppRuntime, setError: (message: string|null) => void}} options Startup data dependencies. */
const useStartupData = ({ runtime, setError }) => {
  const [showSetup, setShowSetup] = useState(initialSetupState);
  const [platforms, setPlatforms] = useState(EMPTY_PLATFORMS);
  const [rommToken, setRommToken] = useState(initialToken);
  const [rommUrl, setRommUrl] = useState("");
  const [immersiveModeEnabled, setImmersiveModeEnabled] = useState(false);
  const [immersiveModeFullscreen, setImmersiveModeFullscreen] = useState(false);
  const [updateSnack, setUpdateSnack] = useState(() => INITIAL_UPDATE_SNACK);
  const startupUpdateCheckDone = useRef(false);
  const rommSessionRestoreStarted = useRef(false);

  const checkFirstRun = useCallback(async () => {
    try {
      const firstRun = await runtime.invoke("is_first_run");
      setShowSetup(firstRun);
      debugLog("startup", "first-run check complete", { firstRun });
    } catch {
      setShowSetup(false);
    }
  }, [runtime]);

  useEffect(() => {
    queueMicrotask(() => {
      void checkFirstRun();
    });
  }, [checkFirstRun]);

  const loadData = useCallback(async () => {
    try {
      const platformData = await runtime.invoke("get_platforms_with_games");
      setPlatforms(platformData);
      try {
        const config = await runtime.invoke("get_config");
        applyStartupConfig({
          config,
          rommSessionRestoreStarted,
          runtime,
          setError,
          setImmersiveModeEnabled,
          setImmersiveModeFullscreen,
          setRommToken,
          setRommUrl,
          setUpdateSnack,
          startupUpdateCheckDone,
        });
      } catch {
        // Config may not exist yet during first run.
      }
    } catch (error) {
      setError(getErrorMessage(error));
    }
  }, [runtime, setError]);

  useEffect(() => {
    if (showSetup === false) {
      queueMicrotask(() => {
        void loadData();
      });
    }
  }, [loadData, showSetup]);

  return {
    checkFirstRun,
    immersiveModeEnabled,
    immersiveModeFullscreen,
    loadData,
    platforms,
    rommToken,
    rommUrl,
    setImmersiveModeEnabled,
    setImmersiveModeFullscreen,
    setRommToken,
    setRommUrl,
    setShowSetup,
    setUpdateSnack,
    showSetup,
    updateSnack,
  };
};

/** @param {{runtime: AppRuntime, setError: (message: string|null) => void, updateSnack: UpdateSnack, setUpdateSnack: import("react").Dispatch<import("react").SetStateAction<UpdateSnack>>}} options Update action dependencies. */
const useStartupUpdate = ({
  runtime,
  setError,
  updateSnack,
  setUpdateSnack,
}) => {
  const runSignedUpdateInstall = useCallback(async () => {
    if (!updateSnack.channel || updateSnack.installing) {
      return;
    }
    setUpdateSnack((current) => ({
      ...current,
      installing: true,
      progressLabel: "Downloading…",
    }));
    /** @type {(() => void)|null} */
    let unlistenProgress = null;
    try {
      unlistenProgress = await runtime.listen(
        "signed-updater-progress",
        /** @param {{payload: {downloaded?: number, total?: number}}} event Update progress event. */
        (event) => {
          const { downloaded, total } = event.payload;
          setUpdateSnack((current) => ({
            ...current,
            progressLabel:
              downloaded !== undefined && total !== undefined && total > 0
                ? `${Math.min(100, Math.round((downloaded / total) * 100))}%`
                : "Downloading…",
          }));
        }
      );
    } catch {
      // Progress reporting is optional when the updater event bridge is unavailable.
    }
    try {
      await runtime.invoke("install_signed_app_update", {
        channel: updateSnack.channel,
      });
    } catch (error) {
      setError(getErrorMessage(error));
      setUpdateSnack((current) => ({
        ...current,
        installing: false,
        progressLabel: "",
      }));
    }
    unlistenProgress?.();
  }, [
    runtime,
    setError,
    setUpdateSnack,
    updateSnack.channel,
    updateSnack.installing,
  ]);

  const handleCloseUpdate = useCallback(() => {
    if (!updateSnack.installing) {
      setUpdateSnack((current) => ({ ...current, open: false }));
    }
  }, [setUpdateSnack, updateSnack.installing]);

  const handleInstallUpdate = useCallback(() => {
    void runSignedUpdateInstall();
  }, [runSignedUpdateInstall]);

  const handleOpenRelease = useCallback(() => {
    if (updateSnack.url) {
      void runtime.openUrl(updateSnack.url);
    }
  }, [runtime, updateSnack.url]);

  return {
    handleCloseUpdate,
    handleInstallUpdate,
    handleOpenRelease,
    runSignedUpdateInstall,
  };
};

/** @param {{setImmersiveModeEnabled: (enabled: boolean) => void, setImmersiveModeFullscreen: (enabled: boolean) => void, setRommToken: (token: string|null) => void, setRommUrl: (url: string) => void, setShowSetup: (show: boolean) => void}} options Startup action setters. */
const useStartupActions = ({
  setImmersiveModeEnabled,
  setImmersiveModeFullscreen,
  setRommToken,
  setRommUrl,
  setShowSetup,
}) => {
  const handleImmersiveExit = useCallback(
    /** @type {(reloadLibrary: () => Promise<void>) => Promise<void>} */
    async (reloadLibrary) => {
      setImmersiveModeEnabled(false);
      setImmersiveModeFullscreen(false);
      await reloadLibrary();
      setImmersiveModeEnabled(false);
      setImmersiveModeFullscreen(false);
    },
    [setImmersiveModeEnabled, setImmersiveModeFullscreen]
  );

  const handleRommConnect = useCallback(
    /** @type {(url: string, token: string) => void} */
    (url, token) => {
      setRommUrl(url);
      setRommToken(token);
    },
    [setRommToken, setRommUrl]
  );

  const handleRommDisconnect = useCallback(() => {
    setRommToken(null);
  }, [setRommToken]);

  const handleSetupComplete = useCallback(() => {
    setShowSetup(false);
  }, [setShowSetup]);

  return {
    handleImmersiveExit,
    handleRommConnect,
    handleRommDisconnect,
    handleSetupComplete,
  };
};

/** @param {{runtime: AppRuntime, setError: (message: string|null) => void}} options - Startup dependencies. */
export const useAppStartup = ({ runtime, setError }) => {
  const startup = useStartupData({ runtime, setError });
  const update = useStartupUpdate({
    runtime,
    setError,
    setUpdateSnack: startup.setUpdateSnack,
    updateSnack: startup.updateSnack,
  });
  const actions = useStartupActions({
    setImmersiveModeEnabled: startup.setImmersiveModeEnabled,
    setImmersiveModeFullscreen: startup.setImmersiveModeFullscreen,
    setRommToken: startup.setRommToken,
    setRommUrl: startup.setRommUrl,
    setShowSetup: startup.setShowSetup,
  });
  useFullscreenHotkey(runtime);
  return {
    ...actions,
    ...update,
    checkFirstRun: startup.checkFirstRun,
    immersiveModeEnabled: startup.immersiveModeEnabled,
    immersiveModeFullscreen: startup.immersiveModeFullscreen,
    loadData: startup.loadData,
    platforms: startup.platforms,
    rommToken: startup.rommToken,
    rommUrl: startup.rommUrl,
    showSetup: startup.showSetup,
    updateSnack: startup.updateSnack,
  };
};
