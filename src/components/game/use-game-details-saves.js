import { useCallback, useEffect, useRef, useState } from "react";

import {
  createSwitchBackupName,
  downloadGameSaveAction,
  downloadSwitchSaveAction,
  listGameSaves,
  refreshGameSaveList,
  resumeSwitchSaveNormalSyncAction,
  syncCurrentSwitchSaveAction,
  uploadGameSaveAction,
  uploadSwitchSaveAction,
} from "./game-details-save-actions";
import { getSaveSyncErrorStatus } from "./game-details-utils";

/** @typedef {import("./game-details-types").GameDetailsGame} GameDetailsGame */
/** @typedef {import("./game-details-types").GameDetailsSave} GameDetailsSave */
/** @typedef {import("./game-details-types").GameDetailsStatus} GameDetailsStatus */
/** @typedef {import("./game-details-types").GameDetailsSwitchPathInfo} GameDetailsSwitchPathInfo */
/** @typedef {import("./game-details-types").GameDetailsSwitchSaveRestoreProtection} GameDetailsSwitchSaveRestoreProtection */

/** @typedef {{game: GameDetailsGame, ipc: typeof import("./game-details-ipc").gameDetailsIpc, openDialog: typeof import("@tauri-apps/plugin-dialog").open, isSwitch: boolean, rommToken: string|null, rommUrl: string|null}} GameDetailsSavesOptions */

/** @type {GameDetailsSave[]} */
const EMPTY_SAVES = [];
/** @returns {GameDetailsStatus|null} Initial save status. */
const getInitialSaveStatus = () => null;
/** @returns {GameDetailsSwitchPathInfo|null} Initial Switch path information. */
const getInitialSwitchPathInfo = () => null;
/** @returns {GameDetailsSwitchSaveRestoreProtection|null} Initial Eden restore protection. */
const getInitialSwitchRestoreProtection = () => null;
/** @returns {{gameId: GameDetailsGame["id"]|null, protection: GameDetailsSwitchSaveRestoreProtection|null}} Initial protected game state. */
const getInitialProtectedGame = () => ({
  gameId: null,
  protection: getInitialSwitchRestoreProtection(),
});

/** @param {unknown} value IPC restore protection. @returns {value is GameDetailsSwitchSaveRestoreProtection} Whether the value contains a revision object. */
const isSwitchRestoreProtection = (value) => {
  if (!(value instanceof Object) || !("selected_revision" in value)) {
    return false;
  }
  return value.selected_revision instanceof Object;
};

/** @param {unknown} value Restore protection returned by IPC. @returns {GameDetailsSwitchSaveRestoreProtection|null} */
const toSwitchRestoreProtection = (value) =>
  isSwitchRestoreProtection(value) ? value : null;

/** @param {GameDetailsGame} game Game being viewed. @param {boolean} isSwitch Whether the game uses Switch saves. @param {GameDetailsSavesOptions["ipc"]} ipc Game details IPC. @returns {GameDetailsSwitchPathInfo|null} Switch save path information. */
const useSwitchSavePathInfo = (game, isSwitch, ipc) => {
  const [switchPathInfo, setSwitchPathInfo] = useState(
    getInitialSwitchPathInfo
  );

  useEffect(() => {
    let cancelled = false;
    if (isSwitch && game.romm_id !== null && game.romm_id !== undefined) {
      const loadPathInfo = async () => {
        try {
          const info = await ipc.getSwitchSavePathInfo(game.id);
          if (!cancelled) {
            setSwitchPathInfo(info);
          }
        } catch {
          if (!cancelled) {
            setSwitchPathInfo(null);
          }
        }
      };
      void loadPathInfo();
    }
    return () => {
      cancelled = true;
    };
  }, [game.id, game.romm_id, ipc, isSwitch]);

  return switchPathInfo;
};

/** @param {GameDetailsGame} game Game being viewed. @param {boolean} isSwitch Whether the game uses Switch saves. @param {GameDetailsSavesOptions["ipc"]} ipc Game details IPC. @returns {{switchRestoreProtection: GameDetailsSwitchSaveRestoreProtection|null, refreshSwitchRestoreProtection: () => Promise<void>}} Eden restore protection state. */
const useSwitchRestoreProtection = (game, isSwitch, ipc) => {
  const [protectedGame, setProtectedGame] = useState(getInitialProtectedGame);
  const switchRestoreProtection =
    isSwitch && protectedGame.gameId === game.id
      ? protectedGame.protection
      : null;
  const refreshSwitchRestoreProtection = useCallback(async () => {
    if (!isSwitch) {
      return;
    }
    try {
      const protection = toSwitchRestoreProtection(
        await ipc.getSwitchSaveRestoreProtection(game.id)
      );
      setProtectedGame({ gameId: game.id, protection });
    } catch {
      // Preserve the last known protected revision when a refresh is unavailable.
    }
  }, [game.id, ipc, isSwitch]);

  useEffect(() => {
    let cancelled = false;
    const loadProtection = async () => {
      try {
        const protection = toSwitchRestoreProtection(
          await ipc.getSwitchSaveRestoreProtection(game.id)
        );
        if (!cancelled) {
          setProtectedGame({ gameId: game.id, protection });
        }
      } catch {
        if (!cancelled) {
          setProtectedGame({ gameId: game.id, protection: null });
        }
      }
    };
    if (isSwitch) {
      void loadProtection();
    }
    return () => {
      cancelled = true;
    };
  }, [game.id, ipc, isSwitch]);

  return { refreshSwitchRestoreProtection, switchRestoreProtection };
};

/** @param {GameDetailsSavesOptions["ipc"]} ipc Game details IPC. @returns {{saveSyncEnabled: boolean, setSaveSyncEnabled: (enabled: boolean) => void}} Automatic save sync preference state. */
const useSaveSyncEnabled = (ipc) => {
  const [saveSyncEnabled, setSaveSyncEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadSyncState = async () => {
      try {
        const config = await ipc.getGameDetailsConfig();
        if (!cancelled) {
          setSaveSyncEnabled(config.romm?.sync_saves === true);
        }
      } catch {
        if (!cancelled) {
          setSaveSyncEnabled(false);
        }
      }
    };
    void loadSyncState();
    return () => {
      cancelled = true;
    };
  }, [ipc]);

  return { saveSyncEnabled, setSaveSyncEnabled };
};

/** @param {import("./game-details-types").GameDetailsLaunchResult|null|undefined} result Completed launch result. @returns {GameDetailsStatus|null} Status to display, or null when nothing changed. */
const getLaunchSaveSyncStatus = (result) => {
  const syncWarnings = Array.isArray(result?.save_sync_warnings)
    ? result.save_sync_warnings.filter((warning) =>
        /^(?:pre|post)-launch save sync:/iu.test(warning)
      )
    : [];
  if (syncWarnings.length > 0) {
    const warningStatus = getSaveSyncErrorStatus(syncWarnings.join("\n"));
    return warningStatus.conflict === true
      ? warningStatus
      : {
          ...warningStatus,
          message:
            "Automatic cloud sync did not finish. Review the cloud copies below, then use Sync current save after resolving the issue.",
        };
  }
  if (
    Array.isArray(result?.save_sync_messages) &&
    result.save_sync_messages.length > 0
  ) {
    return { message: "Cloud save sync completed.", type: "success" };
  }
  return null;
};

/** @typedef {{handleCreateSwitchBackup: () => Promise<void>, handleDownloadSave: (saveId: number, retrySlot?: string|null) => Promise<void>, handleDownloadSwitchSave: (retrySlot?: string|null) => Promise<void>, handleEnableSaveSync: () => Promise<void>, handleListSaves: (isRetry?: boolean) => Promise<void>, handleResumeSwitchSaveNormalSync: () => Promise<void>, handleSyncCurrentSwitchSave: () => Promise<void>, handleUploadSave: (retryFilePath?: string|null) => Promise<void>, handleUploadSwitchSave: (retrySlot?: string|null) => Promise<void>}} SaveActionHandlers */

/** @param {() => import("./game-details-save-actions").SaveActionContext} getActionContext Action context getter. @param {(enabled: boolean) => void} setSaveSyncEnabled Save sync preference setter. @returns {SaveActionHandlers} Save action handlers bound to the context. */
const buildSaveActionHandlers = (getActionContext, setSaveSyncEnabled) => ({
  handleCreateSwitchBackup: async () => {
    await uploadSwitchSaveAction(getActionContext(), createSwitchBackupName());
  },
  handleDownloadSave: async (saveId, retrySlot) => {
    await downloadGameSaveAction(getActionContext(), saveId, retrySlot);
  },
  handleDownloadSwitchSave: async (retrySlot) => {
    await downloadSwitchSaveAction(getActionContext(), retrySlot);
  },
  handleEnableSaveSync: async () => {
    try {
      await getActionContext().ipc.setSaveSyncEnabled(true);
      setSaveSyncEnabled(true);
      getActionContext().setSaveStatus({
        message: "Automatic save sync is enabled for future launches.",
        type: "success",
      });
    } catch (error) {
      getActionContext().setSaveStatus({
        message: `Could not enable automatic save sync: ${error instanceof Error ? error.message : String(error)}`,
        type: "error",
      });
    }
  },
  handleListSaves: async (isRetry = false) => {
    await listGameSaves(getActionContext(), isRetry);
  },
  handleResumeSwitchSaveNormalSync: async () => {
    await resumeSwitchSaveNormalSyncAction(getActionContext());
  },
  handleSyncCurrentSwitchSave: async () => {
    await syncCurrentSwitchSaveAction(getActionContext());
  },
  handleUploadSave: async (retryFilePath) => {
    await uploadGameSaveAction(getActionContext(), retryFilePath);
  },
  handleUploadSwitchSave: async (retrySlot) => {
    await uploadSwitchSaveAction(getActionContext(), retrySlot);
  },
});

/** @param {GameDetailsSavesOptions} options Hook options. */
export const useGameDetailsSaves = ({
  game,
  ipc,
  isSwitch,
  openDialog,
  rommToken,
  rommUrl,
}) => {
  const [saves, setSaves] = useState(EMPTY_SAVES);
  const [savesLoaded, setSavesLoaded] = useState(false);
  const [savesLoading, setSavesLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(getInitialSaveStatus);
  const switchPathInfo = useSwitchSavePathInfo(game, isSwitch, ipc);
  const { refreshSwitchRestoreProtection, switchRestoreProtection } =
    useSwitchRestoreProtection(game, isSwitch, ipc);
  const [switchSyncBusy, setSwitchSyncBusy] = useState(false);
  const { saveSyncEnabled, setSaveSyncEnabled } = useSaveSyncEnabled(ipc);
  const saveSyncInFlightRef = useRef(false);

  const baseActionContext = {
    game,
    ipc,
    isSwitch,
    openDialog,
    refreshSwitchRestoreProtection,
    rommToken,
    rommUrl,
    saveSyncInFlightRef,
    setSaveStatus,
    setSaves,
    setSavesLoaded,
    setSavesLoading,
    setSwitchSyncBusy,
  };
  /** @param {boolean} [preserveStatus] Keep the current status message. */
  const refreshSaveList = async (preserveStatus = false) => {
    await refreshGameSaveList(baseActionContext, preserveStatus);
  };
  const actionContext = { ...baseActionContext, refreshSaveList };
  const actionHandlers = buildSaveActionHandlers(
    () => actionContext,
    setSaveSyncEnabled
  );

  /** @param {import("./game-details-types").GameDetailsLaunchResult|null|undefined} result Completed launch result. */
  const handleLaunchSaveSyncResult = (result) => {
    if (!isSwitch) {
      return;
    }
    const status = getLaunchSaveSyncStatus(result);
    if (status !== null) {
      setSaveStatus(status);
    }
  };

  return {
    ...actionHandlers,
    handleLaunchSaveSyncResult,
    saveStatus,
    saveSyncEnabled,
    saves,
    savesLoaded,
    savesLoading,
    setSaveStatus,
    switchPathInfo,
    switchRestoreProtection,
    switchSyncBusy,
  };
};
