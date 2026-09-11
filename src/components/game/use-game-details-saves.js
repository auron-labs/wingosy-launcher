import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";

import {
  downloadGameSave,
  downloadSwitchSave,
  getGameSaves,
  getSwitchSavePathInfo,
  uploadGameSave,
  uploadSwitchSave,
} from "./game-details-ipc";
import { getSaveSyncErrorStatus } from "./game-details-utils";

/** @typedef {import("./game-details-types").GameDetailsGame} GameDetailsGame */
/** @typedef {import("./game-details-types").GameDetailsSave} GameDetailsSave */
/** @typedef {import("./game-details-types").GameDetailsStatus} GameDetailsStatus */
/** @typedef {import("./game-details-types").GameDetailsSwitchPathInfo} GameDetailsSwitchPathInfo */

/** @typedef {{game: GameDetailsGame, isSwitch: boolean, rommToken: string|null, rommUrl: string|null}} GameDetailsSavesOptions */

/** @param {GameDetailsSavesOptions} options Hook options. */
export const useGameDetailsSaves = ({ game, isSwitch, rommToken, rommUrl }) => {
  const [saves, setSaves] = useState(/** @type {GameDetailsSave[]} */ ([]));
  const [savesLoaded, setSavesLoaded] = useState(false);
  const [savesLoading, setSavesLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(
    /** @type {GameDetailsStatus|null} */ (null)
  );
  const [switchSlot, setSwitchSlot] = useState("autosave");
  const [switchPathInfo, setSwitchPathInfo] = useState(
    /** @type {GameDetailsSwitchPathInfo|null} */ (null)
  );
  const [switchSyncBusy, setSwitchSyncBusy] = useState(false);
  const saveSyncInFlightRef = useRef(false);

  useEffect(() => {
    if (!isSwitch || !game.romm_id) {
      return;
    }
    let cancelled = false;
    const loadPathInfo = async () => {
      try {
        const info = await getSwitchSavePathInfo(game.id);
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
    return () => {
      cancelled = true;
    };
  }, [game.id, game.romm_id, isSwitch]);

  const refreshSaveList = async (preserveStatus = false) => {
    if (!preserveStatus) {
      setSaveStatus(null);
    }
    setSavesLoading(true);
    try {
      const result = await getGameSaves(game.romm_id, rommUrl, rommToken);
      setSaves(result);
      setSavesLoaded(true);
    } finally {
      setSavesLoading(false);
    }
  };

  const handleListSaves = async (isRetry = false) => {
    if (
      !game.romm_id ||
      !rommToken ||
      !rommUrl ||
      saveSyncInFlightRef.current
    ) {
      return;
    }
    saveSyncInFlightRef.current = true;
    const retry =  async () => handleListSaves(true);
    try {
      await refreshSaveList(isRetry);
      if (isRetry) {
        setSaveStatus(null);
      }
    } catch (error) {
      setSaveStatus(getSaveSyncErrorStatus(error, retry));
    } finally {
      saveSyncInFlightRef.current = false;
    }
  };

  const handleDownloadSave = async (saveId, retrySlot) => {
    if (
      !game.romm_id ||
      !rommToken ||
      !rommUrl ||
      saveSyncInFlightRef.current
    ) {
      return;
    }
    const slot =
      retrySlot === undefined ? switchSlot.trim() || null : retrySlot;
    const retrying = retrySlot !== undefined;
    const retry =  async () => handleDownloadSave(saveId, slot);
    saveSyncInFlightRef.current = true;
    try {
      if (!retrying) {
        setSaveStatus(null);
      }
      if (isSwitch) {
        setSwitchSyncBusy(true);
        const result = await downloadSwitchSave(game.id, saveId, slot);
        setSaveStatus({
          message: result.message ?? "Switch save restored to Eden",
          type: "success",
        });
        return;
      }
      const path = await downloadGameSave(
        game.romm_id,
        saveId,
        rommUrl,
        rommToken
      );
      setSaveStatus({ message: `Save downloaded to ${path}`, type: "success" });
    } catch (error) {
      setSaveStatus(getSaveSyncErrorStatus(error, retry));
    } finally {
      setSwitchSyncBusy(false);
      saveSyncInFlightRef.current = false;
    }
  };

  const handleUploadSwitchSave = async (retrySlot) => {
    if (!game.romm_id || saveSyncInFlightRef.current) {
      return;
    }
    const slot =
      typeof retrySlot === "string" || retrySlot === null
        ? retrySlot
        : switchSlot.trim() || null;
    const retrying = typeof retrySlot === "string" || retrySlot === null;
    const retry =  async () => handleUploadSwitchSave(slot);
    saveSyncInFlightRef.current = true;
    try {
      setSwitchSyncBusy(true);
      if (!retrying) {
        setSaveStatus({
          message: "Uploading Eden save to RomM…",
          type: "info",
        });
      }
      const result = await uploadSwitchSave(game.id, slot);
      setSaveStatus({
        message: result.message ?? "Uploaded to RomM",
        type: "success",
      });
      try {
        await refreshSaveList(true);
      } catch (error) {
        setSaveStatus(
          getSaveSyncErrorStatus(error,  async () => handleListSaves(true))
        );
      }
    } catch (error) {
      setSaveStatus(getSaveSyncErrorStatus(error, retry));
    } finally {
      setSwitchSyncBusy(false);
      saveSyncInFlightRef.current = false;
    }
  };

  const handleDownloadSwitchSave = async (retrySlot) => {
    if (!game.romm_id || saveSyncInFlightRef.current) {
      return;
    }
    const slot =
      typeof retrySlot === "string" || retrySlot === null
        ? retrySlot
        : switchSlot.trim() || null;
    const retrying = typeof retrySlot === "string" || retrySlot === null;
    const retry =  async () => handleDownloadSwitchSave(slot);
    saveSyncInFlightRef.current = true;
    try {
      setSwitchSyncBusy(true);
      if (!retrying) {
        setSaveStatus({
          message: "Downloading save from RomM to Eden…",
          type: "info",
        });
      }
      const result = await downloadSwitchSave(game.id, null, slot);
      setSaveStatus({
        message: result.message ?? "Restored to Eden",
        type: "success",
      });
    } catch (error) {
      setSaveStatus(getSaveSyncErrorStatus(error, retry));
    } finally {
      setSwitchSyncBusy(false);
      saveSyncInFlightRef.current = false;
    }
  };

  const handleUploadSave = async (retryFilePath) => {
    if (
      !game.romm_id ||
      !rommToken ||
      !rommUrl ||
      saveSyncInFlightRef.current
    ) {
      return;
    }
    let filePath = typeof retryFilePath === "string" ? retryFilePath : null;
    const retrying = typeof retryFilePath === "string";
    const retry =  async () => handleUploadSave(filePath);
    saveSyncInFlightRef.current = true;
    try {
      if (!filePath) {
        filePath = await (
          open({
            filters: [
              {
                extensions: ["sav", "srm", "state", "ss0", "dat", "*"],
                name: "Save Files",
              },
            ],
            multiple: false,
          })
        );
        if (!filePath) {
          return;
        }
      }
      if (!retrying) {
        setSaveStatus({ message: "Uploading save...", type: "info" });
      }
      await uploadGameSave(filePath, game.romm_id, rommUrl, rommToken);
      setSaveStatus({ message: "Save uploaded!", type: "success" });
      try {
        await refreshSaveList(true);
      } catch (error) {
        setSaveStatus(
          getSaveSyncErrorStatus(error,  async () => handleListSaves(true))
        );
      }
    } catch (error) {
      setSaveStatus(getSaveSyncErrorStatus(error, retry));
    } finally {
      saveSyncInFlightRef.current = false;
    }
  };

  return {
    handleDownloadSave,
    handleDownloadSwitchSave,
    handleListSaves,
    handleUploadSave,
    handleUploadSwitchSave,
    saveStatus,
    saves,
    savesLoaded,
    savesLoading,
    setSaveStatus,
    setSwitchSlot,
    switchPathInfo,
    switchSlot,
    switchSyncBusy,
  };
};
