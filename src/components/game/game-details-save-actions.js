import { getSaveSyncErrorStatus } from "./game-details-utils";

/** @typedef {import("./game-details-types").GameDetailsGame} GameDetailsGame */
/** @typedef {import("./game-details-types").GameDetailsSave} GameDetailsSave */
/** @typedef {import("./game-details-types").GameDetailsStatus} GameDetailsStatus */

/** @typedef {{game: GameDetailsGame, ipc: typeof import("./game-details-ipc").gameDetailsIpc, openDialog: typeof import("@tauri-apps/plugin-dialog").open, isSwitch: boolean, rommToken: string|null, rommUrl: string|null, saveSyncInFlightRef: {current: boolean}, setSaveStatus: (status: GameDetailsStatus|null) => void, setSaves: (saves: GameDetailsSave[]) => void, setSavesLoaded: (loaded: boolean) => void, setSavesLoading: (loading: boolean) => void, setSwitchSyncBusy: (busy: boolean) => void, switchSlot: string, refreshSwitchRestoreProtection: () => Promise<void>}} SaveActionContextBase */
/** @typedef {SaveActionContextBase & {refreshSaveList: (preserveStatus?: boolean) => Promise<void>}} SaveActionContext */

/** @param {SaveActionContextBase} context Save action context. @returns {{rommId: number, serverUrl: string, token: string}|null} Valid remote save configuration. */
const getRemoteSaveConfig = (context) => {
  const { game, rommToken, rommUrl } = context;
  if (
    game.romm_id === null ||
    game.romm_id === undefined ||
    rommUrl === null ||
    rommUrl === "" ||
    rommToken === null ||
    rommToken === ""
  ) {
    return null;
  }
  return { rommId: game.romm_id, serverUrl: rommUrl, token: rommToken };
};

/** @param {SaveActionContextBase} context Save action context. @param {boolean} [preserveStatus] Keep the current status message. */
export const refreshGameSaveList = async (context, preserveStatus = false) => {
  const remote = getRemoteSaveConfig(context);
  if (remote === null) {
    return;
  }
  if (!preserveStatus) {
    context.setSaveStatus(null);
  }
  context.setSavesLoading(true);
  try {
    const result = await context.ipc.getGameSaves(
      remote.rommId,
      remote.serverUrl,
      remote.token
    );
    context.setSaves(result);
    context.setSavesLoaded(true);
  } finally {
    context.setSavesLoading(false);
  }
};

/** @param {SaveActionContext} context Save action context. @param {boolean} [isRetry] Whether this is a retry operation. */
export const listGameSaves = async (context, isRetry = false) => {
  if (getRemoteSaveConfig(context) === null) {
    return;
  }
  if (context.saveSyncInFlightRef.current) {
    return;
  }
  context.saveSyncInFlightRef.current = true;
  const retry = async () => {
    await listGameSaves(context, true);
  };
  try {
    await context.refreshSaveList(isRetry);
    if (isRetry) {
      context.setSaveStatus(null);
    }
  } catch (error) {
    context.setSaveStatus(getSaveSyncErrorStatus(error, retry));
  } finally {
    context.saveSyncInFlightRef.current = false;
  }
};

/** @param {SaveActionContext} context Save action context. @param {number} saveId Save identifier. @param {string|null|undefined} retrySlot Slot from a retry. */
export const downloadGameSaveAction = async (context, saveId, retrySlot) => {
  const remote = getRemoteSaveConfig(context);
  if (remote === null || context.saveSyncInFlightRef.current) {
    return;
  }
  const slot =
    retrySlot === undefined ? context.switchSlot.trim() || null : retrySlot;
  const retry = async () => {
    await downloadGameSaveAction(context, saveId, slot);
  };
  context.saveSyncInFlightRef.current = true;
  try {
    if (retrySlot === undefined) {
      context.setSaveStatus(null);
    }
    if (context.isSwitch) {
      context.setSwitchSyncBusy(true);
      const result = await context.ipc.downloadSwitchSave(
        context.game.id,
        saveId,
        slot
      );
      await context.refreshSwitchRestoreProtection();
      context.setSaveStatus({
        message: result.message ?? "Switch save restored to Eden",
        type: "success",
      });
      return;
    }
    const path = await context.ipc.downloadGameSave(
      remote.rommId,
      saveId,
      remote.serverUrl,
      remote.token
    );
    context.setSaveStatus({
      message: `Save downloaded to ${path}`,
      type: "success",
    });
  } catch (error) {
    context.setSaveStatus(getSaveSyncErrorStatus(error, retry));
  } finally {
    context.setSwitchSyncBusy(false);
    context.saveSyncInFlightRef.current = false;
  }
};

/** @param {SaveActionContext} context Save action context. @param {string|null|undefined} retrySlot Slot from a retry. */
export const uploadSwitchSaveAction = async (context, retrySlot) => {
  if (
    context.game.romm_id === null ||
    context.game.romm_id === undefined ||
    context.saveSyncInFlightRef.current
  ) {
    return;
  }
  const slot =
    retrySlot === undefined ? context.switchSlot.trim() || null : retrySlot;
  const retry = async () => {
    await uploadSwitchSaveAction(context, slot);
  };
  context.saveSyncInFlightRef.current = true;
  try {
    context.setSwitchSyncBusy(true);
    if (retrySlot === undefined) {
      context.setSaveStatus({
        message: "Uploading Eden save to RomM…",
        type: "info",
      });
    }
    const result = await context.ipc.uploadSwitchSave(context.game.id, slot);
    await context.refreshSwitchRestoreProtection();
    context.setSaveStatus({
      message: result.message ?? "Uploaded to RomM",
      type: "success",
    });
    try {
      await context.refreshSaveList(true);
    } catch (error) {
      context.setSaveStatus(
        getSaveSyncErrorStatus(error, async () => {
          await listGameSaves(context, true);
        })
      );
    }
  } catch (error) {
    context.setSaveStatus(getSaveSyncErrorStatus(error, retry));
  } finally {
    context.setSwitchSyncBusy(false);
    context.saveSyncInFlightRef.current = false;
  }
};

/** @param {SaveActionContext} context Save action context. @param {string|null|undefined} retrySlot Slot from a retry. */
export const downloadSwitchSaveAction = async (context, retrySlot) => {
  if (
    context.game.romm_id === null ||
    context.game.romm_id === undefined ||
    context.saveSyncInFlightRef.current
  ) {
    return;
  }
  const slot =
    retrySlot === undefined ? context.switchSlot.trim() || null : retrySlot;
  const retry = async () => {
    await downloadSwitchSaveAction(context, slot);
  };
  context.saveSyncInFlightRef.current = true;
  try {
    context.setSwitchSyncBusy(true);
    if (retrySlot === undefined) {
      context.setSaveStatus({
        message: "Downloading save from RomM to Eden…",
        type: "info",
      });
    }
    const result = await context.ipc.downloadSwitchSave(
      context.game.id,
      null,
      slot
    );
    await context.refreshSwitchRestoreProtection();
    context.setSaveStatus({
      message: result.message ?? "Restored to Eden",
      type: "success",
    });
  } catch (error) {
    context.setSaveStatus(getSaveSyncErrorStatus(error, retry));
  } finally {
    context.setSwitchSyncBusy(false);
    context.saveSyncInFlightRef.current = false;
  }
};

/** @param {SaveActionContext} context Save action context. */
export const resumeSwitchSaveNormalSyncAction = async (context) => {
  if (
    !context.isSwitch ||
    context.game.romm_id === null ||
    context.game.romm_id === undefined ||
    context.saveSyncInFlightRef.current
  ) {
    return;
  }
  const retry = async () => {
    await resumeSwitchSaveNormalSyncAction(context);
  };
  context.saveSyncInFlightRef.current = true;
  try {
    context.setSwitchSyncBusy(true);
    context.setSaveStatus({
      message: "Resuming normal Eden save sync…",
      type: "info",
    });
    await context.ipc.resumeSwitchSaveNormalSync(context.game.id);
    await context.refreshSwitchRestoreProtection();
    context.setSaveStatus({
      message: "Normal Eden save sync resumed.",
      type: "success",
    });
  } catch (error) {
    context.setSaveStatus(getSaveSyncErrorStatus(error, retry));
  } finally {
    context.setSwitchSyncBusy(false);
    context.saveSyncInFlightRef.current = false;
  }
};

/** @param {SaveActionContext} context Save action context. @param {string|null|undefined} retryFilePath Save path from a retry. */
export const uploadGameSaveAction = async (context, retryFilePath) => {
  const remote = getRemoteSaveConfig(context);
  if (remote === null || context.saveSyncInFlightRef.current) {
    return;
  }
  let filePath = retryFilePath ?? null;
  const retry = async () => {
    await uploadGameSaveAction(context, filePath);
  };
  context.saveSyncInFlightRef.current = true;
  try {
    if (filePath === null || filePath === "") {
      const selected = await context.openDialog({
        filters: [
          {
            extensions: ["sav", "srm", "state", "ss0", "dat", "*"],
            name: "Save Files",
          },
        ],
        multiple: false,
      });
      if (selected === null || Array.isArray(selected) || selected === "") {
        return;
      }
      filePath = selected;
    }
    if (retryFilePath === undefined) {
      context.setSaveStatus({ message: "Uploading save...", type: "info" });
    }
    await context.ipc.uploadGameSave(
      filePath,
      remote.rommId,
      remote.serverUrl,
      remote.token
    );
    context.setSaveStatus({ message: "Save uploaded!", type: "success" });
    try {
      await context.refreshSaveList(true);
    } catch (error) {
      context.setSaveStatus(
        getSaveSyncErrorStatus(error, async () => {
          await listGameSaves(context, true);
        })
      );
    }
  } catch (error) {
    context.setSaveStatus(getSaveSyncErrorStatus(error, retry));
  } finally {
    context.saveSyncInFlightRef.current = false;
  }
};
