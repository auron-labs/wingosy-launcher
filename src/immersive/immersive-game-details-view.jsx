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

/** @param {{controller: DetailsController}} options View model. @returns {() => void} Save section callback. */
const createSaveSectionHandler =
  ({ controller }) =>
  () => {
    controller.actions.setMenuAnchor(null);
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
  const { actions } = controller;
  const onSaveScroll = createSaveSectionHandler({ controller });
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
    onDelete: () => {
      actions.setMenuAnchor(null);
      actions.setDeleteDialogOpen(true);
    },
    onHideGame: actions.handleHideGame,
    onOpenIntegrations,
    onOpenLocation: actions.handleOpenLocation,
    onRefreshMetadata: actions.handleRefreshMetadata,
    onResumeSwitchSaveNormalSync:
      controller.saves.handleResumeSwitchSaveNormalSync,
    onSaveScroll,
    onToggleFavorite,
    platformLabel,
    primaryActionRef: controller.primaryActionRef,
    refreshing: actions.refreshing,
    retroachievementsEnabled,
    romDl: controller.romDl,
    rommConfigured: controller.rommConfigured,
    saveStatus: controller.saves.saveStatus,
    savesSectionRef: controller.savesSectionRef,
    screenshots: game.screenshot_paths ?? [],
    setActionStatus: actions.setActionStatus,
    setDeleteDialogOpen: actions.setDeleteDialogOpen,
    setDownloadStatus: actions.setDownloadStatus,
    setMenuAnchor: actions.setMenuAnchor,
    switchContentProgress: controller.switchContentProgress,
    switchContentStatus: actions.switchContentStatus,
    switchContentSyncing: actions.switchContentSyncing,
    switchRestoreProtection: controller.saves.switchRestoreProtection,
    switchSyncBusy: controller.saves.switchSyncBusy,
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
