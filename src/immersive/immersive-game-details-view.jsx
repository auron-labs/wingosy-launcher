import {
  getMediaSrc,
  launchStageLabel,
} from "../components/game/game-details-utils";
import { formatDownloadLabel } from "../rom-downloads-format";
import ImmersiveGameDetailsContent from "./immersive-game-details-content";
import ImmersiveGameDetailsDialogs from "./immersive-game-details-dialogs";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {ReturnType<(typeof import("./use-immersive-game-details-controller.js"))["useImmersiveGameDetailsController"]>} DetailsController */
/** @typedef {{game: ImmersiveGame, platformLabel?: string, onBack: () => void, onToggleFavorite: (gameId: number|string) => void|Promise<void>, onOpenSettings: () => void, onOpenIntegrations: (() => void)|null, retroachievementsEnabled: boolean, controller: DetailsController}} ImmersiveGameDetailsViewProps */

/** @param {{downloaded?: number|null, total?: number|null, percent?: number|null}|null|undefined} progress Download progress. @returns {string} Formatted progress. */
const launchProgressLabel = (progress) => {
  const downloadLabel = formatDownloadLabel(progress);
  const hasPercent =
    progress?.percent !== null && progress?.percent !== undefined;
  const hasNoTotal = progress?.total === null || progress?.total === undefined;
  if (hasPercent && hasNoTotal) {
    return `${progress.percent}%${downloadLabel ? ` · ${downloadLabel}` : ""}`;
  }
  return downloadLabel;
};

/** @param {{controller: DetailsController, game: ImmersiveGame}} options View model. @returns {() => void} Save management callback. */
const createSaveSectionHandler =
  ({ controller, game }) =>
  () => {
    controller.actions.setMenuAnchor(null);
    if (game.platform_id === "switch") {
      controller.setSaveHistoryOpen(true);
      return;
    }
    void controller.saves.handleListSaves();
    controller.savesSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

/** @param {Omit<ImmersiveGameDetailsViewProps, "onOpenSettings">} props View properties. */
const createContentProps = ({
  controller,
  game,
  onBack,
  onOpenIntegrations,
  onToggleFavorite,
  platformLabel,
  retroachievementsEnabled,
}) => {
  const { actions, saves } = controller;
  const onSaveScroll = createSaveSectionHandler({ controller, game });
  return {
    achievementState: controller.achievementState,
    actionStatus: actions.actionStatus,
    canDownload: controller.canDownload,
    canPlay: controller.canPlay,
    canSyncSwitchContent: controller.canSyncSwitchContent,
    colors: controller.colors,
    detailsRef: controller.detailsRef,
    downloadStatus: actions.downloadStatus,
    downloading: actions.downloading,
    game,
    getMediaSrc,
    handleDownloadRom: actions.handleDownloadRom,
    handleLaunchGame: actions.handleLaunchGame,
    handleSyncSwitchContent: actions.handleSyncSwitchContent,
    hasLocalFile: controller.hasLocalFile,
    hasRomm: controller.hasRomm,
    isSwitch: game.platform_id === "switch",
    launchActive: actions.launchActive,
    menuAnchor: actions.menuAnchor,
    onAddToCollection: actions.handleAddToCollection,
    onBack,
    onClearSaveStatus: () => {
      controller.saves.setSaveStatus(null);
    },
    onCreateBackup: saves.handleCreateSwitchBackup,
    onDelete: () => {
      actions.setMenuAnchor(null);
      actions.setDeleteDialogOpen(true);
    },
    onDownloadSave: saves.handleDownloadSave,
    onEnableSaveSync: saves.handleEnableSaveSync,
    onHideGame: actions.handleHideGame,
    onListSaves: saves.handleListSaves,
    onOpenIntegrations,
    onOpenLocation: actions.handleOpenLocation,
    onRefreshMetadata: actions.handleRefreshMetadata,
    onResumeSwitchSaveNormalSync: saves.handleResumeSwitchSaveNormalSync,
    onSaveScroll,
    onSyncCurrentSave: saves.handleSyncCurrentSwitchSave,
    onToggleFavorite,
    onUploadSave: saves.handleUploadSave,
    platformLabel,
    primaryActionRef: controller.primaryActionRef,
    refreshing: actions.refreshing,
    retroachievementsEnabled,
    romDl: controller.romDl,
    rommConfigured: controller.rommConfigured,
    saveHistoryOpen: controller.saveHistoryOpen,
    saveStatus: controller.saves.saveStatus,
    saveSyncEnabled: saves.saveSyncEnabled,
    saves: saves.saves,
    savesLoaded: saves.savesLoaded,
    savesLoading: saves.savesLoading,
    savesSectionRef: controller.savesSectionRef,
    screenshots: game.screenshot_paths ?? [],
    setActionStatus: actions.setActionStatus,
    setDeleteDialogOpen: actions.setDeleteDialogOpen,
    setDownloadStatus: actions.setDownloadStatus,
    setMenuAnchor: actions.setMenuAnchor,
    setSaveHistoryOpen: controller.setSaveHistoryOpen,
    switchContentProgress: controller.switchContentProgress,
    switchContentStatus: actions.switchContentStatus,
    switchContentSyncing: actions.switchContentSyncing,
    switchPathInfo: saves.switchPathInfo,
    switchRestoreProtection: saves.switchRestoreProtection,
    switchSyncBusy: saves.switchSyncBusy,
  };
};

/** @param {ImmersiveGameDetailsViewProps} props View properties. */
const ImmersiveGameDetailsView = ({
  controller,
  game,
  onBack,
  onOpenIntegrations,
  onOpenSettings,
  onToggleFavorite,
  platformLabel,
  retroachievementsEnabled,
}) => {
  const contentProps = createContentProps({
    controller,
    game,
    onBack,
    onOpenIntegrations,
    onToggleFavorite,
    platformLabel,
    retroachievementsEnabled,
  });
  const { actions } = controller;
  return (
    <>
      <ImmersiveGameDetailsContent {...contentProps} />
      <ImmersiveGameDetailsDialogs
        collectionDialogOpen={actions.collectionDialogOpen}
        collections={actions.collections}
        deleteDialogOpen={actions.deleteDialogOpen}
        game={game}
        onDeleteDownload={actions.handleDeleteDownload}
        onLaunchGame={actions.handleLaunchGame}
        onPickCollection={actions.handlePickCollection}
        launchDialogOpen={controller.launchDialogOpen}
        launchErrorPresentation={controller.launchErrorPresentation}
        launchFailure={controller.launchFailure}
        missingEmulatorRecovery={controller.missingEmulatorRecovery}
        launchActive={actions.launchActive}
        launchProgressLabel={launchProgressLabel}
        launchStageLabel={launchStageLabel}
        onBack={onBack}
        onOpenSettings={onOpenSettings}
        retryableLaunchFailure={controller.retryableLaunchFailure}
        setCollectionDialogOpen={actions.setCollectionDialogOpen}
        setDeleteDialogOpen={actions.setDeleteDialogOpen}
        visibleLaunchProgress={controller.visibleLaunchProgress}
      />
    </>
  );
};

export default ImmersiveGameDetailsView;
