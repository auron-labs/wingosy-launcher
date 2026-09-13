/** @typedef {{id: string|number, name: string, display_name?: string, install_type?: string, installed_path?: string|null, is_installed?: boolean, has_download?: boolean, version?: string|null, supported_platforms: string[], download_size_bytes?: number|null}} SettingsEmulator */
/** @typedef {{platform_id: string, platform_name: string, core_filename: string, required?: boolean, status?: string, emulators?: SettingsEmulator[]}} MissingCore */
/** @typedef {{platform_id: string, platform_name?: string, core_filename?: string, is_installed?: boolean, has_download?: boolean, installed_path?: string|null, required?: boolean, status?: string}} CoreInventory */
/** @typedef {{device_id: string, name: string, configured?: boolean, platform_name?: string}} NativeController */
/** @typedef {{downloaded: number, total: number|null, percent: number|null, filename?: string, phase?: "pending"|"download"|"extract"}} EmulatorInstallProgress */
/** @typedef {import("./settings-types").SettingsConfig} SettingsConfig */
/** @typedef {{emuDownloadInflightRef: {current: Set<string|number>}, emuInstallProgress: Record<string|number, EmulatorInstallProgress>, runtime: import("./settings-runtime").SettingsRuntime, setEmulators: SettingsSetter<SettingsEmulator[]>, setRetroarchCoreDllByPlatform: SettingsSetter<Record<string, string>>, setNativeControllerLoading: SettingsSetter<boolean>, setNativeControllers: SettingsSetter<NativeController[]>, setNativeControllerMessage: SettingsSetter<object|null>, setMissingCores: SettingsSetter<MissingCore[]>, setRetroarchCoreReadyPlatformIds: SettingsSetter<string[]>, setRetroarchCoreInventory: SettingsSetter<CoreInventory[]>, setPlatformDefaults: SettingsSetter<Record<string, string|number>>, setPlatforms: SettingsSetter<[{id: string, name: string}, number][]>, setNativeControllerCapture: SettingsSetter<string|null>, setEmuInstallProgress: SettingsSetter<Record<string|number, EmulatorInstallProgress>>, setEmuMessage: SettingsSetter<object|null>, setDownloadingCore: SettingsSetter<string|null>, selectedEmu: SettingsEmulator|null, setEmuMenuAnchor: SettingsSetter<HTMLElement|null>, setSelectedEmu: SettingsSetter<SettingsEmulator|null>, config: SettingsConfig|null, setConfig: SettingsSetter<SettingsConfig|null>, loadConfig: () => Promise<void>}} EmulatorActionsContext */
/** @template T @typedef {(value: T | ((previous: T) => T)) => void} SettingsSetter */

/** @param {unknown} error Error from an emulator operation. */
const getErrorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

/** @param {{runtime: import("./settings-runtime").SettingsRuntime, setEmulators: SettingsSetter<SettingsEmulator[]>, setRetroarchCoreDllByPlatform: SettingsSetter<Record<string, string>>}} context Emulator state. */
const loadEmulators = async ({
  runtime,
  setEmulators,
  setRetroarchCoreDllByPlatform,
}) => {
  try {
    /** @type {SettingsEmulator[]} */
    const emulators = await runtime.invoke("get_all_emulators");
    /** @type {Record<string, string>} */
    const coreDlls = await runtime.invoke("get_retroarch_default_core_dlls");
    setEmulators(emulators);
    setRetroarchCoreDllByPlatform(coreDlls);
  } catch (error) {
    console.error("Failed to load emulators:", error);
  }
};

/** @param {{runtime: import("./settings-runtime").SettingsRuntime, setNativeControllerLoading: SettingsSetter<boolean>, setNativeControllers: SettingsSetter<NativeController[]>, setNativeControllerMessage: SettingsSetter<object|null>}} context Controller state. */
const loadNativeControllers = async ({
  runtime,
  setNativeControllerLoading,
  setNativeControllers,
  setNativeControllerMessage,
}) => {
  setNativeControllerLoading(true);
  try {
    /** @type {NativeController[]} */
    const controllers = await runtime.invoke("get_native_controllers");
    setNativeControllers(controllers);
    setNativeControllerMessage(null);
  } catch (error) {
    setNativeControllers([]);
    setNativeControllerMessage({
      message: getErrorMessage(error),
      type: "warning",
    });
  } finally {
    setNativeControllerLoading(false);
  }
};

/** @param {{runtime: import("./settings-runtime").SettingsRuntime, setMissingCores: SettingsSetter<MissingCore[]>, setRetroarchCoreReadyPlatformIds: SettingsSetter<string[]>, setRetroarchCoreInventory: SettingsSetter<CoreInventory[]>}} context Core state. */
const loadMissingCores = async ({
  runtime,
  setMissingCores,
  setRetroarchCoreReadyPlatformIds,
  setRetroarchCoreInventory,
}) => {
  try {
    /** @type {MissingCore[]} */
    const missingCores = await runtime.invoke("get_missing_cores");
    /** @type {string[]} */
    const readyPlatformIds = await runtime.invoke(
      "get_platform_ids_with_installed_retroarch_core"
    );
    /** @type {CoreInventory[]} */
    const inventory = await runtime.invoke("get_retroarch_core_inventory");
    setMissingCores(missingCores);
    setRetroarchCoreReadyPlatformIds(readyPlatformIds);
    setRetroarchCoreInventory(inventory);
  } catch {
    // Loading optional emulator metadata may fail on older installations.
  }
};

/** @param {{runtime: import("./settings-runtime").SettingsRuntime, setPlatformDefaults: SettingsSetter<Record<string, string|number>>}} context Platform state. */
const loadPlatformDefaults = async ({ runtime, setPlatformDefaults }) => {
  try {
    /** @type {Record<string, string|number>} */
    const defaults = await runtime.invoke("get_platform_default_emulators");
    setPlatformDefaults(defaults);
  } catch {
    // Platform defaults are optional until the backend is ready.
  }
};

/** @param {{runtime: import("./settings-runtime").SettingsRuntime, setPlatforms: SettingsSetter<[{id: string, name: string}, number][] >}} context Platform state. */
const loadPlatforms = async ({ runtime, setPlatforms }) => {
  try {
    /** @type {[{id: string, name: string}, number][]} */
    const platforms = await runtime.invoke("get_platforms_with_games");
    setPlatforms(platforms);
  } catch {
    // Platform data is optional until the backend is ready.
  }
};

/** @param {{runtime: import("./settings-runtime").SettingsRuntime, setNativeControllerCapture: SettingsSetter<string|null>, setNativeControllerMessage: SettingsSetter<object|null>, loadConfig: () => Promise<void>, loadNativeControllers: () => Promise<void>}} context Controller operations. @param {string} deviceId Native controller identifier. */
const handleCaptureNativeController = async (
  {
    runtime,
    setNativeControllerCapture,
    setNativeControllerMessage,
    loadConfig,
    loadNativeControllers: reloadNativeControllers,
  },
  deviceId
) => {
  setNativeControllerCapture(deviceId);
  setNativeControllerMessage(null);
  try {
    await runtime.invoke("capture_native_controller", { deviceId });
    await loadConfig();
    await reloadNativeControllers();
    setNativeControllerMessage({
      message: "Controller mapping saved for this SDL hardware model.",
      type: "success",
    });
  } catch (error) {
    setNativeControllerMessage({
      message: getErrorMessage(error),
      type: "warning",
    });
  } finally {
    setNativeControllerCapture(null);
  }
};

/** @param {{runtime: import("./settings-runtime").SettingsRuntime, setPlatformDefaults: SettingsSetter<Record<string, string|number>>, setEmuMessage: SettingsSetter<object|null>}} context Emulator state. @param {string} platformId Platform identifier. @param {string|number|null} emulatorId Emulator identifier. */
const handleSetDefaultEmulator = async (
  { runtime, setPlatformDefaults, setEmuMessage },
  platformId,
  emulatorId
) => {
  try {
    await runtime.invoke("set_platform_default_emulator", {
      emulatorId: emulatorId ?? null,
      platformId,
    });
    setPlatformDefaults((previous) => {
      const next = { ...previous };
      if (emulatorId === null || emulatorId === undefined) {
        return Object.fromEntries(
          Object.entries(previous).filter(([id]) => id !== platformId)
        );
      }
      next[platformId] = emulatorId;
      return next;
    });
    setEmuMessage({
      message: `Default emulator updated for ${platformId.toUpperCase()}`,
      type: "success",
    });
  } catch (error) {
    setEmuMessage({ message: getErrorMessage(error), type: "error" });
  }
};

/** @param {{emuDownloadInflightRef: {current: Set<string|number>}, runtime: import("./settings-runtime").SettingsRuntime, setEmuInstallProgress: SettingsSetter<Record<string|number, EmulatorInstallProgress>>, setEmuMessage: SettingsSetter<object|null>, loadEmulators: () => Promise<void>, loadMissingCores: () => Promise<void>}} context Emulator state. @param {string|number} emuId Emulator identifier. */
const handleDownloadEmulator = async (
  {
    emuDownloadInflightRef,
    runtime,
    setEmuInstallProgress,
    setEmuMessage,
    loadEmulators: reloadEmulators,
    loadMissingCores: reloadMissingCores,
  },
  emuId
) => {
  if (emuDownloadInflightRef.current.has(emuId)) {
    return;
  }
  emuDownloadInflightRef.current.add(emuId);
  /** @type {EmulatorInstallProgress} */
  const pendingProgress = {
    downloaded: 0,
    percent: null,
    phase: "pending",
    total: null,
  };
  setEmuInstallProgress((previous) => ({
    ...previous,
    [emuId]: pendingProgress,
  }));
  setEmuMessage(null);
  try {
    /** @type {string} */
    const path = await runtime.invoke("download_emulator", {
      emulatorId: emuId,
    });
    setEmuMessage({
      message: `Installed ${emuId} at ${path}`,
      type: "success",
    });
    await reloadEmulators();
    await reloadMissingCores();
  } catch (error) {
    setEmuInstallProgress((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([id]) => id !== String(emuId))
      )
    );
    setEmuMessage({ message: getErrorMessage(error), type: "error" });
  } finally {
    emuDownloadInflightRef.current.delete(emuId);
  }
};

/** @param {{runtime: import("./settings-runtime").SettingsRuntime, setDownloadingCore: SettingsSetter<string|null>, setEmuMessage: SettingsSetter<object|null>, loadMissingCores: () => Promise<void>}} context Emulator state. @param {string} coreFilename Core filename. */
const handleDownloadCore = async (
  {
    runtime,
    setDownloadingCore,
    setEmuMessage,
    loadMissingCores: reloadMissingCores,
  },
  coreFilename
) => {
  try {
    setDownloadingCore(coreFilename);
    setEmuMessage({
      message: `Downloading RetroArch support file ${coreFilename}...`,
      type: "info",
    });
    await runtime.invoke("download_retroarch_core", { coreName: coreFilename });
    setEmuMessage({
      message: `Installed RetroArch support file ${coreFilename}`,
      type: "success",
    });
    await reloadMissingCores();
  } catch (error) {
    setEmuMessage({ message: getErrorMessage(error), type: "error" });
  } finally {
    setDownloadingCore(null);
  }
};

/** @param {{runtime: import("./settings-runtime").SettingsRuntime, selectedEmu: SettingsEmulator|null, setEmuMessage: SettingsSetter<object|null>, handleEmuMenuClose: () => void}} context Emulator state. */
const handleLaunchEmulator = async ({
  runtime,
  selectedEmu,
  setEmuMessage,
  handleEmuMenuClose,
}) => {
  const emulator = selectedEmu;
  if (emulator === null) {
    return;
  }
  const emulatorPath = emulator?.installed_path;
  if (
    emulatorPath === undefined ||
    emulatorPath === null ||
    emulatorPath === ""
  ) {
    return;
  }
  try {
    await runtime.invoke("launch_emulator", { emulatorPath });
    setEmuMessage({ message: `Launched ${emulator.name}`, type: "success" });
  } catch (error) {
    setEmuMessage({
      message: `Failed to launch: ${getErrorMessage(error)}`,
      type: "error",
    });
  }
  handleEmuMenuClose();
};

/** @param {{runtime: import("./settings-runtime").SettingsRuntime, selectedEmu: SettingsEmulator|null, setEmuMessage: SettingsSetter<object|null>, handleEmuMenuClose: () => void}} context Emulator state. */
const handleOpenLocation = async ({
  runtime,
  selectedEmu,
  setEmuMessage,
  handleEmuMenuClose,
}) => {
  const emulatorPath = selectedEmu?.installed_path;
  if (
    emulatorPath === undefined ||
    emulatorPath === null ||
    emulatorPath === ""
  ) {
    return;
  }
  try {
    await runtime.invoke("open_emulator_location", { emulatorPath });
  } catch (error) {
    setEmuMessage({
      message: `Failed to open location: ${getErrorMessage(error)}`,
      type: "error",
    });
  }
  handleEmuMenuClose();
};

/** @param {{setEmuMessage: SettingsSetter<object|null>}} context Emulator state. @param {string} path Emulator path. */
const handleCopyEmulatorPath = async ({ setEmuMessage }, path) => {
  if (path === "") {
    return;
  }
  try {
    await navigator.clipboard.writeText(path);
    setEmuMessage({ message: "Emulator path copied.", type: "success" });
  } catch (error) {
    setEmuMessage({
      message: `Could not copy path: ${getErrorMessage(error)}`,
      type: "error",
    });
  }
};

/** @param {{runtime: import("./settings-runtime").SettingsRuntime, setEmuMessage: SettingsSetter<object|null>}} context Emulator state. */
const handleOpenRetroarchInputSetup = async ({ runtime, setEmuMessage }) => {
  try {
    await runtime.invoke("open_retroarch_input_setup");
    setEmuMessage({
      message: "Opened RetroArch input setup.",
      type: "success",
    });
  } catch (error) {
    setEmuMessage({ message: getErrorMessage(error), type: "error" });
  }
};

/** @param {{runtime: import("./settings-runtime").SettingsRuntime, setEmuMessage: SettingsSetter<object|null>}} context Emulator state. */
const handleResetRetroarchControllerAdditions = async ({
  runtime,
  setEmuMessage,
}) => {
  try {
    /** @type {boolean} */
    const backup = await runtime.invoke("reset_retroarch_controller_additions");
    setEmuMessage({
      message: backup
        ? "Reset Wingosy controller additions. Your RetroArch profiles and remaps were preserved."
        : "No Wingosy controller additions were present.",
      type: "success",
    });
  } catch (error) {
    setEmuMessage({ message: getErrorMessage(error), type: "error" });
  }
};

/** @param {{runtime: import("./settings-runtime").SettingsRuntime, setEmuMessage: SettingsSetter<object|null>, loadEmulators: () => Promise<void>, loadMissingCores: () => Promise<void>}} context Emulator state. */
const handleRepairRetroarchProfile = async ({
  runtime,
  setEmuMessage,
  loadEmulators: reloadEmulators,
  loadMissingCores: reloadMissingCores,
}) => {
  try {
    /** @type {string|null} */
    const message = await runtime.invoke("repair_retroarch_profile");
    setEmuMessage({
      message: message ?? "Wingosy RetroArch controller setup repaired.",
      type: "success",
    });
    await reloadEmulators();
    await reloadMissingCores();
  } catch (error) {
    setEmuMessage({ message: getErrorMessage(error), type: "error" });
  }
};

/** @param {{runtime: import("./settings-runtime").SettingsRuntime, setConfig: SettingsSetter<SettingsConfig|null>, setEmuMessage: SettingsSetter<object|null>}} context Emulator state. @param {{target: {checked: boolean}}} event Checkbox event. */
const handleRetroarchBetaProfileChange = async (
  { runtime, setConfig, setEmuMessage },
  event
) => {
  const enabled = event.target.checked;
  try {
    await runtime.invoke("set_retroarch_beta_profile", { enabled });
    setConfig((previous) => ({
      ...previous,
      emulators: {
        ...previous?.emulators,
        retroarch_use_beta_profile: enabled,
      },
    }));
    setEmuMessage({
      message: enabled
        ? "Wingosy controller settings enabled for RetroArch."
        : "Wingosy controller settings disabled.",
      type: "success",
    });
  } catch (error) {
    setEmuMessage({ message: getErrorMessage(error), type: "error" });
  }
};

/** @param {{runtime: import("./settings-runtime").SettingsRuntime, selectedEmu: SettingsEmulator|null, setEmuMessage: SettingsSetter<object|null>, handleEmuMenuClose: () => void, loadEmulators: () => Promise<void>, loadMissingCores: () => Promise<void>}} context Emulator state. */
const handleUninstallEmulator = async ({
  runtime,
  selectedEmu,
  setEmuMessage,
  handleEmuMenuClose,
  loadEmulators: reloadEmulators,
  loadMissingCores: reloadMissingCores,
}) => {
  if (selectedEmu?.id === undefined || selectedEmu.id === null) {
    return;
  }
  if (selectedEmu.install_type !== "managed") {
    setEmuMessage({
      message: "Can only uninstall emulators installed via Wingosy",
      type: "error",
    });
    handleEmuMenuClose();
    return;
  }
  try {
    setEmuMessage({
      message: `Uninstalling ${selectedEmu.name}...`,
      type: "info",
    });
    await runtime.invoke("uninstall_emulator", { emulatorId: selectedEmu.id });
    setEmuMessage({
      message: `Successfully uninstalled ${selectedEmu.name}`,
      type: "success",
    });
    await reloadEmulators();
    await reloadMissingCores();
  } catch (error) {
    setEmuMessage({
      message: `Failed to uninstall: ${getErrorMessage(error)}`,
      type: "error",
    });
  }
  handleEmuMenuClose();
};

/** @param {string} installType Installation type. */
const getInstallTypeLabel = (installType) => {
  /** @type {Record<string, string>} */
  const labels = {
    custom: "Custom",
    external: "Unverified",
    managed: "Wingosy",
    portable: "Portable",
    steam: "Steam",
    system: "System",
  };
  return labels[installType] ?? "Installed";
};

/** @param {{runtime: import("./settings-runtime").SettingsRuntime, setEmuMessage: SettingsSetter<object|null>, loadEmulators: () => Promise<void>}} context Emulator state. */
const handleApplyPaths = async ({
  runtime,
  setEmuMessage,
  loadEmulators: reloadEmulators,
}) => {
  try {
    /** @type {number} */
    const count = await runtime.invoke("apply_detected_paths");
    setEmuMessage({
      message: `Applied ${count} emulator paths to config.`,
      type: "success",
    });
    await reloadEmulators();
  } catch (error) {
    setEmuMessage({ message: getErrorMessage(error), type: "error" });
  }
};

/** @param {{setEmuMenuAnchor: SettingsSetter<HTMLElement|null>, setSelectedEmu: SettingsSetter<SettingsEmulator|null>}} context Emulator menu state. @param {{currentTarget: HTMLElement}} event Menu event. @param {SettingsEmulator} emulator Emulator to operate on. */
const handleEmuMenuOpen = (
  { setEmuMenuAnchor, setSelectedEmu },
  event,
  emulator
) => {
  setEmuMenuAnchor(event.currentTarget);
  setSelectedEmu(emulator);
};

/** @param {{setEmuMenuAnchor: SettingsSetter<HTMLElement|null>, setSelectedEmu: SettingsSetter<SettingsEmulator|null>}} context Emulator menu state. */
const handleEmuMenuClose = ({ setEmuMenuAnchor, setSelectedEmu }) => {
  setEmuMenuAnchor(null);
  setSelectedEmu(null);
};

/** @param {EmulatorActionsContext} context State and reload operations. */
const createEmulatorReloaders = (context) => ({
  loadEmulators: async () => {
    await loadEmulators(context);
  },
  loadMissingCores: async () => {
    await loadMissingCores(context);
  },
  loadNativeControllers: async () => {
    await loadNativeControllers(context);
  },
});

/** @param {EmulatorActionsContext} context State and reload operations. */
export const createSettingsEmulatorActions = (context) => {
  const reloaders = createEmulatorReloaders(context);
  const emulatorContext = {
    ...context,
    handleEmuMenuClose: () => {
      handleEmuMenuClose(emulatorContext);
    },
    ...reloaders,
  };
  /** @type {(deviceId: string) => Promise<void>} */
  const captureNativeController = async (deviceId) => {
    await handleCaptureNativeController(emulatorContext, deviceId);
  };
  /** @type {(path: string) => Promise<void>} */
  const copyEmulatorPath = async (path) => {
    await handleCopyEmulatorPath(emulatorContext, path);
  };
  /** @type {(coreFilename: string) => Promise<void>} */
  const downloadCore = async (coreFilename) => {
    await handleDownloadCore(emulatorContext, coreFilename);
  };
  /** @type {(emuId: string|number) => Promise<void>} */
  const downloadEmulator = async (emuId) => {
    await handleDownloadEmulator(emulatorContext, emuId);
  };
  /** @type {(event: {currentTarget: HTMLElement}, emulator: SettingsEmulator) => void} */
  const openEmulatorMenu = (event, emulator) => {
    handleEmuMenuOpen(emulatorContext, event, emulator);
  };
  /** @type {(event: {target: {checked: boolean}}) => Promise<void>} */
  const changeRetroarchBetaProfile = async (event) => {
    await handleRetroarchBetaProfileChange(emulatorContext, event);
  };
  /** @type {(platformId: string, emulatorId: string|number|null) => Promise<void>} */
  const setDefaultEmulator = async (platformId, emulatorId) => {
    await handleSetDefaultEmulator(emulatorContext, platformId, emulatorId);
  };
  return {
    getInstallTypeLabel,
    handleApplyPaths: async () => {
      await handleApplyPaths(emulatorContext);
    },
    handleCaptureNativeController: captureNativeController,
    handleCopyEmulatorPath: copyEmulatorPath,
    handleDownloadCore: downloadCore,
    handleDownloadEmulator: downloadEmulator,
    handleEmuMenuClose: emulatorContext.handleEmuMenuClose,
    handleEmuMenuOpen: openEmulatorMenu,
    handleLaunchEmulator: async () => {
      await handleLaunchEmulator(emulatorContext);
    },
    handleOpenLocation: async () => {
      await handleOpenLocation(emulatorContext);
    },
    handleOpenRetroarchInputSetup: async () => {
      await handleOpenRetroarchInputSetup(emulatorContext);
    },
    handleRepairRetroarchProfile: async () => {
      await handleRepairRetroarchProfile(emulatorContext);
    },
    handleResetRetroarchControllerAdditions: async () => {
      await handleResetRetroarchControllerAdditions(emulatorContext);
    },
    handleRetroarchBetaProfileChange: changeRetroarchBetaProfile,
    handleSetDefaultEmulator: setDefaultEmulator,
    handleUninstallEmulator: async () => {
      await handleUninstallEmulator(emulatorContext);
    },
    loadEmulators: reloaders.loadEmulators,
    loadMissingCores: reloaders.loadMissingCores,
    loadNativeControllers: reloaders.loadNativeControllers,
    loadPlatformDefaults: async () => {
      await loadPlatformDefaults(context);
    },
    loadPlatforms: async () => {
      await loadPlatforms(context);
    },
  };
};
