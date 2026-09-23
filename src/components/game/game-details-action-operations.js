import { isGameDownloaded } from "../../utils/game-filters";
import { getErrorMessage } from "./game-details-utils";

/** @typedef {import("./game-details-types").GameDetailsCollection} GameDetailsCollection */
/** @typedef {import("./game-details-types").GameDetailsGame} GameDetailsGame */
/** @typedef {import("./game-details-types").GameDetailsLaunchResult} GameDetailsLaunchResult */
/** @typedef {import("./game-details-types").GameDetailsProgress} GameDetailsProgress */
/** @typedef {import("./game-details-types").GameDetailsStatus} GameDetailsStatus */

/** @typedef {{game: GameDetailsGame, canSyncSwitchContent: boolean, ipc: typeof import("./game-details-ipc").gameDetailsIpc, launchProgress: GameDetailsProgress|null, onBack: () => void, onGameUpdate?: (gameId: number|string) => void, onLaunch: (gameId: number|string) => Promise<GameDetailsLaunchResult|null|undefined>, onLaunchComplete?: (result: GameDetailsLaunchResult|null|undefined) => void, romDl: GameDetailsProgress|null, rommToken: string|null, rommUrl: string|null, launchActive: boolean, downloadActive: boolean, justDownloaded: boolean, downloadInFlightRef: {current: boolean}, launchInFlightRef: {current: boolean}, switchContentInFlightRef: {current: boolean}, refreshSwitchContentStatus?: () => Promise<void>, setActionStatus: (status: GameDetailsStatus|null) => void, setCollectionDialogOpen: (open: boolean) => void, setCollections: (collections: GameDetailsCollection[]) => void, setDeleteDialogOpen: (open: boolean) => void, setDownloadStatus: (status: GameDetailsStatus|null) => void, setDownloading: (downloading: boolean) => void, setJustDownloaded: (justDownloaded: boolean) => void, setLaunchError: (error: string|null) => void, setLaunchFailureDismissed: (dismissed: boolean) => void, setLaunching: (launching: boolean) => void, setMenuAnchor: (anchor: HTMLElement|null) => void, setRefreshing: (refreshing: boolean) => void, setSwitchContentSyncing: (syncing: boolean) => void}} GameDetailsActionContext */

/** @param {GameDetailsActionContext} context Action dependencies. */
export const launchGameAction = async (context) => {
  if (
    context.launchInFlightRef.current ||
    context.downloadActive ||
    context.switchContentInFlightRef.current
  ) {
    return;
  }
  context.launchInFlightRef.current = true;
  context.setLaunching(true);
  context.setLaunchError(null);
  try {
    const result = await context.onLaunch(context.game.id);
    context.onLaunchComplete?.(result);
    if (result?.success === false) {
      context.setLaunchError(getErrorMessage(result.error));
      context.setLaunchFailureDismissed(false);
    }
  } catch (error) {
    context.setLaunchError(getErrorMessage(error));
    context.setLaunchFailureDismissed(false);
  }
  context.launchInFlightRef.current = false;
  context.setLaunching(false);
};

/** @param {GameDetailsActionContext} context Action dependencies. */
export const downloadRomAction = async (context) => {
  if (
    context.downloadInFlightRef.current ||
    context.launchActive ||
    context.switchContentInFlightRef.current ||
    context.rommToken === null ||
    context.rommToken === "" ||
    context.rommUrl === null ||
    context.rommUrl === ""
  ) {
    return;
  }
  context.downloadInFlightRef.current = true;
  try {
    context.setDownloading(true);
    context.setDownloadStatus(null);
    await context.ipc.downloadRom(
      context.game.id,
      context.rommUrl,
      context.rommToken
    );
    context.setJustDownloaded(true);
    context.setDownloadStatus({
      message: "Downloaded! Ready to play.",
      type: "success",
    });
    context.onGameUpdate?.(context.game.id);
  } catch (error) {
    context.setDownloadStatus({
      message: getErrorMessage(error),
      type: "error",
    });
  }
  context.downloadInFlightRef.current = false;
  context.setDownloading(false);
};

/** @param {GameDetailsActionContext} context Action dependencies. */
export const syncSwitchContentAction = async (context) => {
  if (
    context.switchContentInFlightRef.current ||
    context.launchActive ||
    context.downloadActive ||
    !context.canSyncSwitchContent
  ) {
    return;
  }
  context.switchContentInFlightRef.current = true;
  context.setSwitchContentSyncing(true);
  context.setActionStatus({
    message: "Syncing Switch updates and DLC…",
    type: "info",
  });
  try {
    const result = await context.ipc.syncSwitchContent(context.game.id);
    context.setActionStatus({
      message:
        result.message ??
        `Switch content synced: ${result.downloaded ?? 0} downloaded, ${result.reused ?? 0} reused.`,
      type: "success",
    });
    await context.refreshSwitchContentStatus?.();
  } catch (error) {
    context.setActionStatus({ message: getErrorMessage(error), type: "error" });
  }
  context.switchContentInFlightRef.current = false;
  context.setSwitchContentSyncing(false);
};

/** @param {GameDetailsActionContext} context Action dependencies. */
export const deleteDownloadAction = async (context) => {
  if (context.launchActive) {
    return;
  }
  try {
    context.setDeleteDialogOpen(false);
    context.setMenuAnchor(null);
    context.setActionStatus({ message: "Deleting ROM...", type: "info" });
    await context.ipc.deleteLocalRom(context.game.id);
    context.setActionStatus({
      message: "ROM deleted successfully",
      type: "success",
    });
    context.setJustDownloaded(false);
    context.onGameUpdate?.(context.game.id);
  } catch (error) {
    context.setActionStatus({ message: getErrorMessage(error), type: "error" });
  }
};

/** @param {GameDetailsActionContext} context Action dependencies. */
export const hideGameAction = async (context) => {
  try {
    context.setMenuAnchor(null);
    await context.ipc.toggleGameHidden(context.game.id);
    context.setActionStatus({
      message: "Game hidden. View hidden games in Settings.",
      type: "success",
    });
    context.onGameUpdate?.(context.game.id);
    setTimeout(context.onBack, 1500);
  } catch (error) {
    context.setActionStatus({ message: getErrorMessage(error), type: "error" });
  }
};

/** @param {GameDetailsActionContext} context Action dependencies. */
export const refreshMetadataAction = async (context) => {
  if (
    context.rommToken === null ||
    context.rommToken === "" ||
    context.rommUrl === null ||
    context.rommUrl === "" ||
    context.game.romm_id === null ||
    context.game.romm_id === undefined
  ) {
    return;
  }
  try {
    context.setMenuAnchor(null);
    context.setRefreshing(true);
    context.setActionStatus({
      message: "Refreshing metadata from RomM...",
      type: "info",
    });
    await context.ipc.refreshGameMetadata(
      context.game.id,
      context.rommUrl,
      context.rommToken
    );
    context.setActionStatus({
      message: "Metadata refreshed!",
      type: "success",
    });
    context.onGameUpdate?.(context.game.id);
  } catch (error) {
    context.setActionStatus({ message: getErrorMessage(error), type: "error" });
  }
  context.setRefreshing(false);
};

/** @param {GameDetailsActionContext} context Action dependencies. */
export const openLocationAction = async (context) => {
  try {
    context.setMenuAnchor(null);
    await context.ipc.openRomLocation(context.game.id);
  } catch (error) {
    context.setActionStatus({ message: getErrorMessage(error), type: "error" });
  }
};

/** @param {GameDetailsActionContext} context Action dependencies. */
export const addToCollectionAction = async (context) => {
  context.setMenuAnchor(null);
  try {
    const result = await context.ipc.getCollections();
    context.setCollections(result);
    context.setCollectionDialogOpen(true);
  } catch (error) {
    context.setActionStatus({ message: getErrorMessage(error), type: "error" });
  }
};

/** @param {GameDetailsActionContext} context Action dependencies. @param {number} collectionId Collection identifier. */
export const pickCollectionAction = async (context, collectionId) => {
  try {
    await context.ipc.addGameToCollection(collectionId, context.game.id);
    context.setActionStatus({
      message: "Added to collection.",
      type: "success",
    });
  } catch (error) {
    context.setActionStatus({ message: getErrorMessage(error), type: "error" });
  }
};

/** @param {GameDetailsGame} game Game being viewed. @param {boolean} justDownloaded Whether the game was just downloaded. @returns {boolean} Whether the game can be played. */
export const canPlayGame = (game, justDownloaded) =>
  isGameDownloaded(game, { justDownloaded }) ||
  (game.romm_id !== null && game.romm_id !== undefined);
