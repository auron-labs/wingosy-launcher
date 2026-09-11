import { useCallback, useEffect, useRef, useState } from "react";

import { debugLog } from "../utils/debugLog";
import { isTauri } from "../utils/isTauri";
import { isText } from "../utils/value-guards";
import { setFullscreenReliable } from "../windowFullscreen";

/** @typedef {{getCurrentWindow: () => {isFullscreen: () => Promise<boolean>, onResized: (handler: () => void) => Promise<() => void>, startDragging: () => Promise<void>}, invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>, listen: (event: string, handler: (event: {payload?: unknown}) => void) => Promise<() => void>, openUrl: (url: string) => Promise<unknown>}} AppRuntime */
/** @typedef {{id: string|number, name: string}} AppPlatform */
/** @typedef {{server_url?: string, auth_token?: string}} RommConfig */
/** @typedef {{big_picture?: boolean, fullscreen?: boolean, controller_deadzone?: number, theme?: string}} DisplayConfig */
/** @typedef {{auto_update_enabled?: boolean, channel?: string, check_on_startup?: boolean}} UpdaterConfig */
/** @typedef {{romm?: RommConfig, display?: DisplayConfig, library?: {roms_directory?: string}, updater?: UpdaterConfig}} AppConfig */
/** @typedef {{is_update_available?: boolean, signed_update_manifest_url?: string, release_url?: string, latest_version?: string, message?: string}} UpdateResult */
/** @typedef {{canInstall: boolean, channel: "stable"|"beta"|"nightly", installing: boolean, open: boolean, progressLabel: string, url: string, version: string}} UpdateSnack */

/** @param {unknown} error - Error value from an IPC boundary. */
const getErrorMessage = (error) =>
  isText(error)
    ? error
    : error instanceof Error
      ? error.message
      : String(error);

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

/** @returns {boolean|null} */
const initialSetupState = () => null;

/** @returns {string|null} */
const initialToken = () => null;

/** @param {{config: AppConfig, runtime: AppRuntime, setRommToken: (token: string) => void, setRommUrl: (url: string) => void}} options - Session restore dependencies. */
const restoreRomMSession = async ({
  runtime,
  config,
  setRommUrl,
  setRommToken,
}) => {
  if (
    config.romm?.server_url === undefined ||
    config.romm.server_url === ""
  ) {
    return;
  }
  try {
    /** @type {{server_url?: string, access_token?: string}} */
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
    /** @type {UpdateResult} */
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

/** @param {{config: AppConfig, runtime: AppRuntime, rommSessionRestoreStarted: {current: boolean}, setError: (message: string) => void, setImmersiveModeEnabled: (enabled: boolean) => void, setImmersiveModeFullscreen: (enabled: boolean) => void, setRommToken: (token: string) => void, setRommUrl: (url: string) => void, setUpdateSnack: (snack: UpdateSnack) => void, startupUpdateCheckDone: {current: boolean}} options - Startup configuration dependencies. */
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
  const romm = config.romm;
  if (romm?.server_url !== undefined && romm.server_url !== "") {
    setRommUrl(romm.server_url);
  }
  if (romm?.auth_token !== undefined && romm.auth_token !== "") {
    setRommToken(romm.auth_token);
  }
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
  setImmersiveModeEnabled(Boolean(config.display?.big_picture));
  setImmersiveModeFullscreen(Boolean(config.display?.fullscreen));
  if (
    romm?.server_url !== undefined &&
    romm.server_url !== "" &&
    !rommSessionRestoreStarted.current
  ) {
    rommSessionRestoreStarted.current = true;
    void restoreRomMSession({ runtime, config, setRommUrl, setRommToken });
  }
  if (!startupUpdateCheckDone.current) {
    startupUpdateCheckDone.current = true;
    void checkStartupUpdate({ runtime, config, setError, setUpdateSnack });
  }
};

/** @param {AppRuntime} runtime - Tauri boundary used for window operations. */
const useFullscreenHotkey = (runtime) => {
  useEffect(() => {
    if (!isTauri()) {
      return;
    }
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
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [runtime]);
};

/** @param {{runtime: AppRuntime, setError: (message: string|null) => void}} options - Startup dependencies. */
export const useAppStartup = ({ runtime, setError }) => {
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
      setShowSetup(firstRun === true);
      debugLog("startup", "first-run check complete", { firstRun });
    } catch {
      setShowSetup(false);
    }
  }, [runtime]);

  useEffect(() => {
    void checkFirstRun();
  }, [checkFirstRun]);

  const loadData = useCallback(async () => {
    try {
      /** @type {[AppPlatform, number][]} */
      const platformData = await runtime.invoke("get_platforms_with_games");
      setPlatforms(platformData);
      try {
        /** @type {AppConfig} */
        const config = await runtime.invoke("get_config");
        applyStartupConfig({
          config,
          runtime,
          rommSessionRestoreStarted,
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
      void loadData();
    }
  }, [loadData, showSetup]);

  const runSignedUpdateInstall = useCallback(async () => {
    if (!updateSnack.channel || updateSnack.installing) {
      return;
    }
    setUpdateSnack((current) => ({
      ...current,
      installing: true,
      progressLabel: "Downloading…",
    }));
    let unlistenProgress = () => {};
    try {
      unlistenProgress = await runtime.listen(
        "signed-updater-progress",
        (event) => {
          /** @type {{downloaded?: number, total?: number}} */
          const progress = event.payload ?? {};
          const downloaded = progress.downloaded;
          const total = progress.total;
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
      unlistenProgress = () => {};
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
    } finally {
      unlistenProgress();
    }
  }, [runtime, setError, updateSnack.channel, updateSnack.installing]);

  /** @param {() => Promise<void>} reloadLibrary - Refreshes the desktop library. */
  const handleImmersiveExit = useCallback(async (reloadLibrary) => {
    setImmersiveModeEnabled(false);
    setImmersiveModeFullscreen(false);
    await reloadLibrary();
    setImmersiveModeEnabled(false);
    setImmersiveModeFullscreen(false);
  }, []);

  /** @param {string} url - RomM server URL. @param {string} token - RomM access token. */
  const handleRommConnect = useCallback((url, token) => {
    setRommUrl(url);
    setRommToken(token);
  }, []);

  const handleRommDisconnect = useCallback(() => {
    setRommToken(null);
  }, []);

  const handleSetupComplete = useCallback(() => {
    setShowSetup(false);
  }, []);

  const handleCloseUpdate = useCallback(() => {
    if (!updateSnack.installing) {
      setUpdateSnack((current) => ({ ...current, open: false }));
    }
  }, [updateSnack.installing]);

  const handleInstallUpdate = useCallback(() => {
    void runSignedUpdateInstall();
  }, [runSignedUpdateInstall]);

  const handleOpenRelease = useCallback(() => {
    if (updateSnack.url) {
      void runtime.openUrl(updateSnack.url);
    }
  }, [runtime, updateSnack.url]);

  useFullscreenHotkey(runtime);

  return {
    checkFirstRun,
    handleSetupComplete,
    handleImmersiveExit,
    handleCloseUpdate,
    handleInstallUpdate,
    handleOpenRelease,
    handleRommConnect,
    handleRommDisconnect,
    immersiveModeEnabled,
    immersiveModeFullscreen,
    loadData,
    platforms,
    rommToken,
    rommUrl,
    runSignedUpdateInstall,
    showSetup,
    updateSnack,
  };
};
