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
import { useSwitchContentStatus } from "./use-switch-content-status";

/** @typedef {import("./game-details-types").GameDetailsGame} GameDetailsGame */
/** @typedef {import("./game-details-types").GameDetailsLaunchResult} GameDetailsLaunchResult */
/** @typedef {import("./game-details-types").GameDetailsProgress} GameDetailsProgress */
/** @typedef {import("./game-details-types").GameDetailsStatus} GameDetailsStatus */

/** @typedef {{game: GameDetailsGame, ipc?: typeof import("./game-details-ipc").gameDetailsIpc, rommToken: string|null, rommUrl: string|null, canSyncSwitchContent: boolean, romDl: GameDetailsProgress|null, launchProgress: GameDetailsProgress|null, onLaunch: (gameId: number|string) => Promise<GameDetailsLaunchResult|null|undefined>, onLaunchComplete?: (result: GameDetailsLaunchResult|null|undefined) => void, onGameUpdate?: (gameId: number|string) => void, onBack: () => void}} GameDetailsActionsOptions */

/** @param {import("./game-details-action-operations").GameDetailsActionContext} actionContext Action dependencies. */
const createActionHandlers = (actionContext) => ({
  handleAddToCollection: async () => {
    await addToCollectionAction(actionContext);
  },
  handleDeleteDownload: async () => {
    await deleteDownloadAction(actionContext);
  },
  handleDownloadRom: async () => {
    await downloadRomAction(actionContext);
  },
  handleHideGame: async () => {
    await hideGameAction(actionContext);
  },
  handleLaunchGame: async () => {
    await launchGameAction(actionContext);
  },
  handleOpenLocation: async () => {
    await openLocationAction(actionContext);
  },
  /** @param {number} collectionId Collection identifier. */
  handlePickCollection: async (collectionId) => {
    await pickCollectionAction(actionContext, collectionId);
  },
  handleRefreshMetadata: async () => {
    await refreshMetadataAction(actionContext);
  },
  handleSyncSwitchContent: async () => {
    await syncSwitchContentAction(actionContext);
  },
});

/** @param {GameDetailsActionsOptions} options Hook options. */
export const useGameDetailsActions = (options) => {
  const state = useGameDetailsActionState();
  const ipc = options.ipc ?? gameDetailsIpc;
  const { refreshSwitchContentStatus, switchContentStatus } =
    useSwitchContentStatus({
      eligible: options.canSyncSwitchContent,
      game: options.game,
      ipc,
    });
  const launchActive =
    state.launching || Boolean(options.launchProgress?.active);
  const downloadActive = state.downloading || Boolean(options.romDl);
  const actionContext = {
    ...options,
    ipc,
    ...state,
    downloadActive,
    launchActive,
    refreshSwitchContentStatus,
  };
  const handlers = createActionHandlers(actionContext);
  /** @param {GameDetailsStatus|null} status Download status. */
  const setDownloadStatus = (status) => {
    state.setDownloadStatus(status);
  };

  return {
    ...handlers,
    actionStatus: state.actionStatus,
    canPlay: canPlayGame(options.game, state.justDownloaded),
    collectionDialogOpen: state.collectionDialogOpen,
    collections: state.collections,
    deleteDialogOpen: state.deleteDialogOpen,
    downloadActive,
    downloadStatus: state.downloadStatus,
    downloading: state.downloading,
    handleDismissLaunchFailure: state.handleDismissLaunchFailure,
    justDownloaded: state.justDownloaded,
    launchActive,
    launchError: state.launchError,
    launchFailureDismissed: state.launchFailureDismissed,
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
    switchContentStatus,
    switchContentSyncing: state.switchContentSyncing,
  };
};
