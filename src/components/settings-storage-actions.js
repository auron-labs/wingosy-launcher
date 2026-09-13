/** @typedef {{id: string|number, name: string, platform_id?: string}} SettingsGame */
/** @typedef {{library?: {roms_directory?: string|null}}} SettingsConfig */
/** @typedef {{tracked_rom_count?: number, tracked_rom_bytes?: number, active_rom_downloads?: number, free_disk_bytes?: number, using_default_roms_directory?: boolean, migratable_rom_count?: number, migratable_rom_bytes?: number, roms_directory?: string, locations?: {key: string, label: string, path: string, exists: boolean, bytes?: number}[]}} StorageOverview */
/** @typedef {{config: SettingsConfig|null, activeRomDownloadCount: number, romsDirectory: string, runtime: import("./settings-runtime").SettingsRuntime, storageOverview: StorageOverview|null, setStorageLoading: SettingsSetter<boolean>, setStorageOverview: SettingsSetter<StorageOverview|null>, setRomsDirectory: SettingsSetter<string>, setScanMessage: SettingsSetter<object|null>, onLibraryChange?: (() => void|Promise<void>)|null, setPendingRomsDirectory: SettingsSetter<string>, setStorageMigrationDialogOpen: SettingsSetter<boolean>, setStorageChangeBusy: SettingsSetter<boolean>, setConfig: SettingsSetter<SettingsConfig|null>, setHiddenLoading: SettingsSetter<boolean>, setHiddenGames: SettingsSetter<SettingsGame[]>, setHiddenDialogOpen: SettingsSetter<boolean>}} StorageActionsContext */
/** @template T @typedef {(value: T | ((previous: T) => T)) => void} SettingsSetter */

/** @param {unknown} error Error from a storage operation. */
const getErrorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

/** @param {Pick<StorageActionsContext, "runtime"|"setStorageLoading"|"setStorageOverview"|"setRomsDirectory">} context Storage state. */
const loadStorageOverview = async ({
  runtime,
  setStorageLoading,
  setStorageOverview,
  setRomsDirectory,
}) => {
  setStorageLoading(true);
  try {
    /** @type {{roms_directory?: string}} */
    const overview = await runtime.invoke("get_storage_overview");
    setStorageOverview(overview);
    setRomsDirectory(overview.roms_directory ?? "");
  } catch (error) {
    console.error("Failed to load storage overview:", error);
  } finally {
    setStorageLoading(false);
  }
};

/** @param {{runtime: import("./settings-runtime").SettingsRuntime, setScanMessage: SettingsSetter<object|null>}} context Storage state. @param {{label: string, path: string, exists: boolean}} location Storage location. */
const handleOpenStorageLocation = async (
  { runtime, setScanMessage },
  location
) => {
  if (!location.exists) {
    return;
  }
  try {
    await runtime.shellOpen(location.path);
  } catch (error) {
    setScanMessage({
      message: `Could not open ${location.label}: ${getErrorMessage(error)}`,
      type: "error",
    });
  }
};

/** @param {Pick<StorageActionsContext, "romsDirectory"|"runtime"|"setScanMessage"|"onLibraryChange">} context Library state. */
const handleScanDirectory = async ({
  romsDirectory,
  runtime,
  setScanMessage,
  onLibraryChange,
}) => {
  try {
    let pathToScan = romsDirectory;
    if (pathToScan === "") {
      const selected = await runtime.openDialog({
        directory: true,
        multiple: false,
      });
      if (selected === null || selected === "") {
        return;
      }
      pathToScan = selected;
    }
    setScanMessage({ message: `Scanning ${pathToScan}...`, type: "info" });
    /** @type {SettingsGame[]} */
    const games = await runtime.invoke("scan_directory", {
      path: pathToScan,
      recursive: true,
    });
    setScanMessage({
      message: `Found ${games.length} games!`,
      type: "success",
    });
    if (onLibraryChange) {
      await onLibraryChange();
    }
  } catch (error) {
    setScanMessage({ message: getErrorMessage(error), type: "error" });
  }
};

/** @param {Pick<StorageActionsContext, "runtime"|"setScanMessage"|"onLibraryChange">} context Library state. */
const handleScanCustomDirectory = async ({
  runtime,
  setScanMessage,
  onLibraryChange,
}) => {
  try {
    const selected = await runtime.openDialog({
      directory: true,
      multiple: false,
    });
    if (selected === null || selected === "") {
      return;
    }
    setScanMessage({ message: `Scanning ${selected}...`, type: "info" });
    /** @type {SettingsGame[]} */
    const games = await runtime.invoke("scan_directory", {
      path: selected,
      recursive: true,
    });
    setScanMessage({
      message: `Found ${games.length} games!`,
      type: "success",
    });
    if (onLibraryChange) {
      await onLibraryChange();
    }
  } catch (error) {
    setScanMessage({ message: getErrorMessage(error), type: "error" });
  }
};

/** @param {Pick<StorageActionsContext, "romsDirectory"|"runtime"|"setStorageOverview"|"setPendingRomsDirectory"|"setStorageMigrationDialogOpen"|"setScanMessage"> & {applyRomsDirectoryChange: (directory: string, migrateExisting: boolean) => Promise<void>}} context Storage state. */
const handleChangeRomsDirectory = async ({
  romsDirectory,
  runtime,
  setStorageOverview,
  setPendingRomsDirectory,
  setStorageMigrationDialogOpen,
  setScanMessage,
  applyRomsDirectoryChange,
}) => {
  try {
    const selected = await runtime.openDialog({
      directory: true,
      multiple: false,
    });
    if (selected === null || selected === "" || selected === romsDirectory) {
      return;
    }
    /** @type {{migratable_rom_count?: number}} */
    const overview = await runtime.invoke("get_storage_overview");
    setStorageOverview(overview);
    setPendingRomsDirectory(selected);
    if ((overview.migratable_rom_count ?? 0) > 0) {
      setStorageMigrationDialogOpen(true);
      return;
    }
    await applyRomsDirectoryChange(selected, false);
  } catch (error) {
    setScanMessage({ message: getErrorMessage(error), type: "error" });
  }
};

/** @param {Pick<StorageActionsContext, "config"|"activeRomDownloadCount"|"runtime"|"storageOverview"|"setConfig"|"setScanMessage"|"onLibraryChange"> & {loadStorageOverview: () => Promise<void>}} context Storage state. */
const handleResetRomsDirectory = async ({
  config,
  activeRomDownloadCount,
  runtime,
  storageOverview,
  setConfig,
  setScanMessage,
  loadStorageOverview: reloadStorageOverview,
  onLibraryChange,
}) => {
  if (storageOverview?.using_default_roms_directory === true) {
    return;
  }
  if (activeRomDownloadCount > 0) {
    setScanMessage({
      message:
        "Wait for active ROM downloads to finish before changing storage.",
      type: "warning",
    });
    return;
  }
  if ((storageOverview?.migratable_rom_count ?? 0) > 0) {
    setScanMessage({
      message:
        "Use Change to choose whether tracked ROMs should move before returning to the default folder.",
      type: "info",
    });
    return;
  }
  try {
    /** @type {SettingsConfig} */
    const sourceConfig = config ?? (await runtime.invoke("get_config"));
    const currentConfig = structuredClone(sourceConfig);
    const nextConfig = {
      ...currentConfig,
      library: { ...currentConfig.library, roms_directory: null },
    };
    await runtime.invoke("save_config", { config: nextConfig });
    setConfig(nextConfig);
    await reloadStorageOverview();
    if (onLibraryChange) {
      await onLibraryChange();
    }
    setScanMessage({
      message: "Using the default ROM folder.",
      type: "success",
    });
  } catch (error) {
    setScanMessage({ message: getErrorMessage(error), type: "error" });
  }
};

/** @param {Pick<StorageActionsContext, "runtime"|"setStorageChangeBusy"|"setConfig"|"setRomsDirectory"|"setStorageMigrationDialogOpen"|"setPendingRomsDirectory"|"setScanMessage"|"onLibraryChange"> & {loadStorageOverview: () => Promise<void>}} context Storage state. @param {string} directory New directory. @param {boolean} migrateExisting Whether to move existing ROMs. */
const applyRomsDirectoryChange = async (
  {
    runtime,
    setStorageChangeBusy,
    setConfig,
    setRomsDirectory,
    setStorageMigrationDialogOpen,
    setPendingRomsDirectory,
    setScanMessage,
    loadStorageOverview: reloadStorageOverview,
    onLibraryChange,
  },
  directory,
  migrateExisting
) => {
  setStorageChangeBusy(true);
  try {
    /** @type {{new_directory: string, moved: number, missing: number, conflicts: number, failed: number, source_cleanup_failed: number}} */
    const result = await runtime.invoke("change_roms_directory", {
      migrateExisting,
      newDirectory: directory,
    });
    /** @type {object} */
    const config = await runtime.invoke("get_config");
    setConfig(config);
    setRomsDirectory(result.new_directory);
    setStorageMigrationDialogOpen(false);
    setPendingRomsDirectory("");
    await reloadStorageOverview();
    if (onLibraryChange) {
      await onLibraryChange();
    }
    if (!migrateExisting) {
      setScanMessage({
        message:
          "New downloads will use the new folder. Existing games remain at their current paths.",
        type: "success",
      });
      return;
    }
    const warnings =
      result.missing +
      result.conflicts +
      result.failed +
      result.source_cleanup_failed;
    const warningMessage =
      warnings > 0
        ? `${result.missing} missing, ${result.conflicts} conflicts, ${result.failed} failed, and ${result.source_cleanup_failed} old copies could not be removed. Existing destination files were not overwritten.`
        : "The new folder is now used for downloads.";
    setScanMessage({
      message: `Moved ${result.moved} game${result.moved === 1 ? "" : "s"}. ${warningMessage}`,
      type: warnings > 0 ? "warning" : "success",
    });
  } catch (error) {
    setScanMessage({ message: getErrorMessage(error), type: "error" });
  } finally {
    setStorageChangeBusy(false);
  }
};

/** @param {Pick<StorageActionsContext, "runtime"|"setHiddenLoading"|"setHiddenGames">} context Hidden games state. */
const loadHiddenGames = async ({
  runtime,
  setHiddenLoading,
  setHiddenGames,
}) => {
  setHiddenLoading(true);
  try {
    /** @type {SettingsGame[]} */
    const games = await runtime.invoke("get_hidden_games");
    setHiddenGames(games);
  } catch (error) {
    console.error("Failed to load hidden games:", error);
  } finally {
    setHiddenLoading(false);
  }
};

/** @param {Pick<StorageActionsContext, "runtime"|"setHiddenGames">} context Hidden games state. @param {string|number} gameId Hidden game identifier. */
const handleUnhideGame = async ({ runtime, setHiddenGames }, gameId) => {
  try {
    await runtime.invoke("unhide_game", { gameId });
    setHiddenGames((games) => games.filter((game) => game.id !== gameId));
  } catch (error) {
    console.error("Failed to unhide game:", error);
  }
};

/** @param {Pick<StorageActionsContext, "setHiddenDialogOpen"> & {loadHiddenGames: () => Promise<void>}} context Hidden games state. */
const handleOpenHiddenDialog = ({
  loadHiddenGames: reloadHiddenGames,
  setHiddenDialogOpen,
}) => {
  void reloadHiddenGames();
  setHiddenDialogOpen(true);
};

/** @param {StorageActionsContext} context Storage and hidden-game state. */
export const createSettingsStorageActions = (context) => {
  const loadOverview = async () => {
    await loadStorageOverview(context);
  };
  /** @param {string} directory @param {boolean} migrateExisting */
  const applyDirectory = async (directory, migrateExisting) => {
    await applyRomsDirectoryChange(
      {
        ...context,
        loadStorageOverview: loadOverview,
      },
      directory,
      migrateExisting
    );
  };
  const storageContext = {
    ...context,
    applyRomsDirectoryChange: applyDirectory,
    loadStorageOverview: loadOverview,
  };
  /** @type {(location: {label: string, path: string, exists: boolean}) => Promise<void>} */
  const openStorageLocation = async (location) => {
    await handleOpenStorageLocation(storageContext, location);
  };
  /** @type {(gameId: string|number) => Promise<void>} */
  const unhideGame = async (gameId) => {
    await handleUnhideGame(storageContext, gameId);
  };
  return {
    applyRomsDirectoryChange: applyDirectory,
    handleChangeRomsDirectory: async () => {
      await handleChangeRomsDirectory(storageContext);
    },
    handleOpenHiddenDialog: () => {
      handleOpenHiddenDialog({
        ...storageContext,
        loadHiddenGames: async () => {
          await loadHiddenGames(storageContext);
        },
      });
    },
    handleOpenStorageLocation: openStorageLocation,
    handleResetRomsDirectory: async () => {
      await handleResetRomsDirectory(storageContext);
    },
    handleScanCustomDirectory: async () => {
      await handleScanCustomDirectory(storageContext);
    },
    handleScanDirectory: async () => {
      await handleScanDirectory(storageContext);
    },
    handleUnhideGame: unhideGame,
    loadHiddenGames: async () => {
      await loadHiddenGames(storageContext);
    },
    loadStorageOverview: loadOverview,
  };
};
