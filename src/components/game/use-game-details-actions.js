import { useRef, useState } from "react";

import { isGameDownloaded } from "../../utils/gameFilters";
import {
  addGameToCollection,
  deleteLocalRom,
  downloadRom,
  getCollections,
  openRomLocation,
  refreshGameMetadata,
  syncSwitchContent,
  toggleGameHidden,
} from "./game-details-ipc";
import { getErrorMessage } from "./game-details-utils";

/** @typedef {import("./game-details-types").GameDetailsCollection} GameDetailsCollection */
/** @typedef {import("./game-details-types").GameDetailsGame} GameDetailsGame */
/** @typedef {import("./game-details-types").GameDetailsLaunchResult} GameDetailsLaunchResult */
/** @typedef {import("./game-details-types").GameDetailsProgress} GameDetailsProgress */
/** @typedef {import("./game-details-types").GameDetailsStatus} GameDetailsStatus */

/** @typedef {{game: GameDetailsGame, rommToken: string|null, rommUrl: string|null, canSyncSwitchContent: boolean, romDl: GameDetailsProgress|null, launchProgress: GameDetailsProgress|null, onLaunch: (gameId: number|string) => Promise<GameDetailsLaunchResult|null|undefined>, onGameUpdate?: (gameId: number|string) => void, onBack: () => void}} GameDetailsActionsOptions */

/** @param {GameDetailsActionsOptions} options Hook options. */
export const useGameDetailsActions = ({
  canSyncSwitchContent,
  game,
  launchProgress,
  onBack,
  onGameUpdate,
  onLaunch,
  romDl,
  rommToken,
  rommUrl,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState(
    /** @type {string|null} */ (null)
  );
  const [downloadStatus, setDownloadStatus] = useState(
    /** @type {GameDetailsStatus|null} */ (null)
  );
  const [justDownloaded, setJustDownloaded] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(
    /** @type {HTMLElement|null} */ (null)
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionStatus, setActionStatus] = useState(
    /** @type {GameDetailsStatus|null} */ (null)
  );
  const [switchContentSyncing, setSwitchContentSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [collections, setCollections] = useState(
    /** @type {GameDetailsCollection[]} */ ([])
  );
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const downloadInFlightRef = useRef(false);
  const launchInFlightRef = useRef(false);
  const switchContentInFlightRef = useRef(false);

  const launchActive = launching || Boolean(launchProgress?.active);
  const downloadActive = downloading || Boolean(romDl);

  const handleLaunchGame = async () => {
    if (
      launchInFlightRef.current ||
      downloadActive ||
      switchContentInFlightRef.current
    ) {
      return;
    }
    launchInFlightRef.current = true;
    setLaunching(true);
    setLaunchError(null);
    try {
      const result = await onLaunch(game.id);
      if (result?.success === false) {
        setLaunchError(result.error ?? "Unable to launch game");
      }
    } catch (error) {
      setLaunchError(getErrorMessage(error));
    } finally {
      launchInFlightRef.current = false;
      setLaunching(false);
    }
  };

  const handleDownloadRom = async () => {
    if (
      downloadInFlightRef.current ||
      launchActive ||
      switchContentInFlightRef.current ||
      !rommToken ||
      !rommUrl
    ) {
      return;
    }
    downloadInFlightRef.current = true;
    try {
      setDownloading(true);
      setDownloadStatus(null);
      await downloadRom(game.id, rommUrl, rommToken);
      setJustDownloaded(true);
      setDownloadStatus({
        message: "Downloaded! Ready to play.",
        type: "success",
      });
      onGameUpdate?.(game.id);
    } catch (error) {
      setDownloadStatus({ message: getErrorMessage(error), type: "error" });
    } finally {
      downloadInFlightRef.current = false;
      setDownloading(false);
    }
  };

  const handleSyncSwitchContent = async () => {
    if (
      switchContentInFlightRef.current ||
      launchActive ||
      downloadActive ||
      !canSyncSwitchContent
    ) {
      return;
    }
    switchContentInFlightRef.current = true;
    setSwitchContentSyncing(true);
    setActionStatus({
      message: "Syncing Switch updates and DLC…",
      type: "info",
    });
    try {
      const result = await syncSwitchContent(game.id);
      setActionStatus({
        message:
          result.message ??
          `Switch content synced: ${result.downloaded ?? 0} downloaded, ${result.reused ?? 0} reused.`,
        type: "success",
      });
    } catch (error) {
      setActionStatus({
        message: `${getErrorMessage(error)} Choose “Sync Updates & DLC” to retry after correcting the issue.`,
        type: "error",
      });
    } finally {
      switchContentInFlightRef.current = false;
      setSwitchContentSyncing(false);
    }
  };

  const handleDeleteDownload = async () => {
    if (launchActive) {
      return;
    }
    try {
      setDeleteDialogOpen(false);
      setMenuAnchor(null);
      setActionStatus({ message: "Deleting ROM...", type: "info" });
      await deleteLocalRom(game.id);
      setActionStatus({ message: "ROM deleted successfully", type: "success" });
      setJustDownloaded(false);
      onGameUpdate?.(game.id);
    } catch (error) {
      setActionStatus({ message: getErrorMessage(error), type: "error" });
    }
  };

  const handleHideGame = async () => {
    try {
      setMenuAnchor(null);
      await toggleGameHidden(game.id);
      setActionStatus({
        message: "Game hidden. View hidden games in Settings.",
        type: "success",
      });
      onGameUpdate?.(game.id);
      setTimeout(onBack, 1500);
    } catch (error) {
      setActionStatus({ message: getErrorMessage(error), type: "error" });
    }
  };

  const handleRefreshMetadata = async () => {
    if (!rommToken || !rommUrl || !game.romm_id) {
      return;
    }
    try {
      setMenuAnchor(null);
      setRefreshing(true);
      setActionStatus({
        message: "Refreshing metadata from RomM...",
        type: "info",
      });
      await refreshGameMetadata(game.id, rommUrl, rommToken);
      setActionStatus({ message: "Metadata refreshed!", type: "success" });
      onGameUpdate?.(game.id);
    } catch (error) {
      setActionStatus({ message: getErrorMessage(error), type: "error" });
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenLocation = async () => {
    try {
      setMenuAnchor(null);
      await openRomLocation(game.id);
    } catch (error) {
      setActionStatus({ message: getErrorMessage(error), type: "error" });
    }
  };

  const openAddToCollection = async () => {
    setMenuAnchor(null);
    try {
      const result = await getCollections();
      setCollections(result);
      setCollectionDialogOpen(true);
    } catch (error) {
      setActionStatus({ message: getErrorMessage(error), type: "error" });
    }
  };

  const handlePickCollection = async (collectionId) => {
    try {
      await addGameToCollection(collectionId, game.id);
      setActionStatus({ message: "Added to collection.", type: "success" });
    } catch (error) {
      setActionStatus({ message: getErrorMessage(error), type: "error" });
    }
  };

  return {
    actionStatus,
    canPlay:
      isGameDownloaded(game, { justDownloaded }) || Boolean(game.romm_id),
    collectionDialogOpen,
    collections,
    deleteDialogOpen,
    downloadActive,
    downloadStatus,
    downloading,
    handleDeleteDownload,
    handleDownloadRom,
    handleHideGame,
    handleLaunchGame,
    handleOpenLocation,
    handlePickCollection,
    handleRefreshMetadata,
    handleSyncSwitchContent,
    justDownloaded,
    launchActive,
    launchError,
    launching,
    menuAnchor,
    openAddToCollection,
    refreshing,
    setActionStatus,
    setCollectionDialogOpen,
    setDeleteDialogOpen,
    setMenuAnchor,
    setSwitchContentSyncing,
    switchContentInFlightRef,
    switchContentSyncing,
  };
};
