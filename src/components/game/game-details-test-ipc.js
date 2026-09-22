/** @typedef {import("./game-details-ipc").GameDetailsIpc} GameDetailsIpc */
/** @typedef {import("../../test/invoke-mocks").GameDetailsTestInvoke} GameDetailsInvoke */

/** @param {GameDetailsInvoke} invoke Test IPC command invoker. @returns {GameDetailsIpc["setSaveSyncEnabled"]} Save-sync toggle adapter. */
const createSetSaveSyncEnabled = (invoke) => async (enabled) => {
  const config = await invoke("get_config");
  config.romm ??= {};
  config.romm.sync_saves = enabled;
  await invoke("save_config", { config });
};

/** @param {GameDetailsInvoke} invoke Test IPC command invoker. @returns {Pick<GameDetailsIpc, "downloadEmulator"|"getEmulatorsForPlatform">} Missing-emulator recovery IPC. */
const createMissingEmulatorRecoveryIpc = (invoke) => {
  /** @type {GameDetailsIpc["downloadEmulator"]} */
  const downloadEmulator = async (emulatorId) =>
    await invoke("download_emulator", { emulatorId });
  /** @type {GameDetailsIpc["getEmulatorsForPlatform"]} */
  const getEmulatorsForPlatform = async (platformId) =>
    await invoke("get_emulators_for_platform", { platformId });
  return { downloadEmulator, getEmulatorsForPlatform };
};

/** @param {GameDetailsInvoke} invoke Test IPC command invoker. @returns {GameDetailsIpc} Game details IPC adapter. */
export const createGameDetailsTestIpc = (invoke) => {
  const missingEmulatorRecoveryIpc = createMissingEmulatorRecoveryIpc(invoke);
  /** @type {(command: "get_romm_retroachievements", args?: Record<string, unknown>) => Promise<import("./game-details-types").GameDetailsAchievementsAchievement[]>} */
  const invokeRommRetroAchievements = invoke;
  /** @type {GameDetailsIpc["addGameToCollection"]} */
  const addGameToCollection = async (collectionId, gameId) =>
    await invoke("add_game_to_collection", { collectionId, gameId });
  /** @type {GameDetailsIpc["deleteLocalRom"]} */
  const deleteLocalRom = async (gameId) =>
    await invoke("delete_local_rom", { gameId });
  /** @type {GameDetailsIpc["downloadGameSave"]} */
  const downloadGameSave = async (rommId, saveId, serverUrl, token) =>
    await invoke("download_game_save", { rommId, saveId, serverUrl, token });
  /** @type {GameDetailsIpc["downloadRom"]} */
  const downloadRom = async (gameId, serverUrl, token) =>
    await invoke("download_rom", { gameId, serverUrl, token });
  /** @type {GameDetailsIpc["downloadSwitchSave"]} */
  const downloadSwitchSave = async (gameId, saveId, slot) =>
    await invoke("download_switch_save", { gameId, saveId, slot });
  /** @type {GameDetailsIpc["getCollections"]} */
  const getCollections = async () => await invoke("get_collections");
  /** @type {GameDetailsIpc["getGameDetailsConfig"]} */
  const getGameDetailsConfig = async () => await invoke("get_config");
  /** @type {GameDetailsIpc["getGameSaves"]} */
  const getGameSaves = async (rommId, serverUrl, token) =>
    await invoke("get_game_saves", { rommId, serverUrl, token });
  /** @type {GameDetailsIpc["getSwitchGameSaves"]} */
  const getSwitchGameSaves = async (gameId) =>
    await invoke("get_switch_game_saves", { gameId });
  /** @type {GameDetailsIpc["getRommRetroAchievements"]} */
  const getRommRetroAchievements = async (
    rommId,
    serverUrl,
    token,
    refreshProgression
  ) =>
    await invokeRommRetroAchievements("get_romm_retroachievements", {
      refreshProgression,
      romId: rommId,
      serverUrl,
      token,
    });
  /** @type {GameDetailsIpc["getSwitchSavePathInfo"]} */
  const getSwitchSavePathInfo = async (gameId) =>
    await invoke("get_switch_save_path_info", { gameId });
  /** @type {GameDetailsIpc["getSwitchSaveRestoreProtection"]} */
  const getSwitchSaveRestoreProtection = async (gameId) =>
    await invoke("get_switch_save_restore_protection", { gameId });
  /** @type {GameDetailsIpc["openRomLocation"]} */
  const openRomLocation = async (gameId) =>
    await invoke("open_rom_location", { gameId });
  /** @type {GameDetailsIpc["refreshGameMetadata"]} */
  const refreshGameMetadata = async (gameId, serverUrl, token) =>
    await invoke("refresh_game_metadata", { gameId, serverUrl, token });
  /** @type {GameDetailsIpc["resumeSwitchSaveNormalSync"]} */
  const resumeSwitchSaveNormalSync = async (gameId) => {
    await invoke("resume_switch_save_normal_sync", { gameId });
  };
  /** @type {GameDetailsIpc["syncSwitchContent"]} */
  const syncSwitchContent = async (gameId) =>
    await invoke("sync_switch_content", { gameId });
  /** @type {GameDetailsIpc["syncCurrentSwitchSave"]} */
  const syncCurrentSwitchSave = async (gameId) =>
    await invoke("sync_current_switch_save", { gameId });
  /** @type {GameDetailsIpc["setSaveSyncEnabled"]} */
  const setSaveSyncEnabled = createSetSaveSyncEnabled(invoke);
  /** @type {GameDetailsIpc["toggleGameHidden"]} */
  const toggleGameHidden = async (gameId) =>
    await invoke("toggle_game_hidden", { gameId });
  /** @type {GameDetailsIpc["uploadGameSave"]} */
  const uploadGameSave = async (filePath, rommId, serverUrl, token) =>
    await invoke("upload_game_save", { filePath, rommId, serverUrl, token });
  /** @type {GameDetailsIpc["uploadSwitchSave"]} */
  const uploadSwitchSave = async (gameId, slot) =>
    await invoke("upload_switch_save", { gameId, slot });

  return {
    ...missingEmulatorRecoveryIpc,
    addGameToCollection,
    deleteLocalRom,
    downloadGameSave,
    downloadRom,
    downloadSwitchSave,
    getCollections,
    getGameDetailsConfig,
    getGameSaves,
    getRommRetroAchievements,
    getSwitchGameSaves,
    getSwitchSavePathInfo,
    getSwitchSaveRestoreProtection,
    openRomLocation,
    refreshGameMetadata,
    resumeSwitchSaveNormalSync,
    setSaveSyncEnabled,
    syncCurrentSwitchSave,
    syncSwitchContent,
    toggleGameHidden,
    uploadGameSave,
    uploadSwitchSave,
  };
};
