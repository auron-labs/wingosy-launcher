import {
  addToCollectionAction,
  canPlayGame,
  deleteDownloadAction,
  downloadRomAction,
  hideGameAction,
  launchGameAction,
  openLocationAction,
  pickCollectionAction,
  refreshMetadataAction,
  syncSwitchContentAction,
} from "./game-details-action-operations";
import { gameDetailsIpc } from "./game-details-ipc";
import { useGameDetailsActionState } from "./use-game-details-action-state";

/** @typedef {import("./game-details-types").GameDetailsGame} GameDetailsGame */
/** @typedef {import("./game-details-types").GameDetailsLaunchResult} GameDetailsLaunchResult */
/** @typedef {import("./game-details-types").GameDetailsProgress} GameDetailsProgress */
/** @typedef {import("./game-details-types").GameDetailsStatus} GameDetailsStatus */

/** @typedef {{game: GameDetailsGame, ipc?: typeof import("./game-details-ipc").gameDetailsIpc, rommToken: string|null, rommUrl: string|null, canSyncSwitchContent: boolean, romDl: GameDetailsProgress|null, launchProgress: GameDetailsProgress|null, onLaunch: (gameId: number|string) => Promise<GameDetailsLaunchResult|null|undefined>, onLaunchComplete?: (result: GameDetailsLaunchResult|null|undefined) => void, onGameUpdate?: (gameId: number|string) => void, onBack: () => void}} GameDetailsActionsOptions */

/** @param {GameDetailsActionsOptions} options Hook options. */
export const useGameDetailsActions = (options) => {
  const state = useGameDetailsActionState();
  const ipc = options.ipc ?? gameDetailsIpc;
  const launchActive =
    state.launching || Boolean(options.launchProgress?.active);
  const downloadActive = state.downloading || Boolean(options.romDl);
  const actionContext = {
    ...options,
    ipc,
    ...state,
    downloadActive,
    launchActive,
  };

  const handleLaunchGame = async () => {
    await launchGameAction(actionContext);
  };
  const handleDownloadRom = async () => {
    await downloadRomAction(actionContext);
  };
  const handleSyncSwitchContent = async () => {
    await syncSwitchContentAction(actionContext);
  };
  const handleDeleteDownload = async () => {
    await deleteDownloadAction(actionContext);
  };
  const handleHideGame = async () => {
    await hideGameAction(actionContext);
  };
  const handleRefreshMetadata = async () => {
    await refreshMetadataAction(actionContext);
  };
  const handleOpenLocation = async () => {
    await openLocationAction(actionContext);
  };
  const handleAddToCollection = async () => {
    await addToCollectionAction(actionContext);
  };
  /** @param {number} collectionId Collection identifier. */
  const handlePickCollection = async (collectionId) => {
    await pickCollectionAction(actionContext, collectionId);
  };
  /** @param {GameDetailsStatus|null} status Download status. */
  const setDownloadStatus = (status) => {
    state.setDownloadStatus(status);
  };

  return {
    actionStatus: state.actionStatus,
    canPlay: canPlayGame(options.game, state.justDownloaded),
    collectionDialogOpen: state.collectionDialogOpen,
    collections: state.collections,
    deleteDialogOpen: state.deleteDialogOpen,
    downloadActive,
    downloadStatus: state.downloadStatus,
    downloading: state.downloading,
    handleAddToCollection,
    handleDeleteDownload,
    handleDownloadRom,
    handleHideGame,
    handleLaunchGame,
    handleOpenLocation,
    handlePickCollection,
    handleRefreshMetadata,
    handleSyncSwitchContent,
    justDownloaded: state.justDownloaded,
    launchActive,
    launchError: state.launchError,
    launching: state.launching,
    menuAnchor: state.menuAnchor,
    refreshing: state.refreshing,
    setActionStatus: state.setActionStatus,
    setCollectionDialogOpen: state.setCollectionDialogOpen,
    setDeleteDialogOpen: state.setDeleteDialogOpen,
    setDownloadStatus,
    setMenuAnchor: state.setMenuAnchor,
    setSwitchContentSyncing: state.setSwitchContentSyncing,
    switchContentInFlightRef: state.switchContentInFlightRef,
    switchContentSyncing: state.switchContentSyncing,
  };
};
