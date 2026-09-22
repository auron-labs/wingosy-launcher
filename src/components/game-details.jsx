import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { open as defaultOpenDialog } from "@tauri-apps/plugin-dialog";
import { useState } from "react";

import { getLaunchErrorPresentation } from "../immersive/launch-error";
import { useRomDownloads } from "../rom-downloads-context-value";
import { normalizeSyncState } from "../utils/game-filters";
import CollectionPickerDialog from "./game/collection-picker-dialog";
import {
  GameDetailsDownloadStatus,
  GameDetailsLaunchStatus,
  GameDetailsPlayControls,
} from "./game/game-details-actions-panel";
import { GameDetailsCloudSave } from "./game/game-details-cloud-save";
import { GameDetailsControlsHeader } from "./game/game-details-controls-header";
import { GameDetailsHeader } from "./game/game-details-header";
import { gameDetailsIpc } from "./game/game-details-ipc";
import { GameDetailsOverview } from "./game/game-details-overview";
import { GameDetailsSavesSection } from "./game/game-details-saves-section";
import { getCoverSrc } from "./game/game-details-utils";
import { useGameDetailsAchievements } from "./game/use-game-details-achievements";
import { useGameDetailsActions } from "./game/use-game-details-actions";
import { useGameDetailsRetroAchievements } from "./game/use-game-details-config";
import { useGameDetailsSaves } from "./game/use-game-details-saves";
import { useMissingEmulatorRecovery } from "./game/use-missing-emulator-recovery";

/** @typedef {import("./game/game-details-types").GameDetailsGame} GameDetailsGame */
/** @typedef {import("./game/game-details-types").GameDetailsLaunchErrorPresentation} GameDetailsLaunchErrorPresentation */
/** @typedef {import("./game/game-details-types").GameDetailsLaunchResult} GameDetailsLaunchResult */
/** @typedef {import("./game/game-details-types").GameDetailsPlatform} GameDetailsPlatform */
/** @typedef {import("./game/game-details-types").GameDetailsProgress} GameDetailsProgress */

/** @typedef {{game: GameDetailsGame, platforms: Array<[GameDetailsPlatform, number]>, onBack: () => void, onLaunch: (gameId: number|string) => Promise<GameDetailsLaunchResult|null|undefined>, onToggleFavorite: (gameId: number|string) => void, onGameUpdate?: (gameId: number|string) => void|Promise<void>, rommToken: string|null, rommUrl: string|null, onOpenSettings?: (() => void)|null, onOpenIntegrations?: (() => void)|null, dependencies?: {ipc?: import("./game/game-details-ipc").GameDetailsIpc, openDialog?: typeof defaultOpenDialog}}} GameDetailsProps */
/** @typedef {ReturnType<typeof useGameDetailsActions>} GameDetailsActions */
/** @typedef {ReturnType<typeof useGameDetailsAchievements>} GameDetailsAchievementsState */
/** @typedef {ReturnType<typeof useMissingEmulatorRecovery>} MissingEmulatorRecovery */
/** @typedef {{achievementsState: GameDetailsAchievementsState, retroachievementsEnabled: boolean}} GameDetailsAchievementResources */
/** @typedef {ReturnType<typeof useGameDetailsSaves>} GameDetailsSaves */
/** @typedef {{game: GameDetailsGame, isSwitch: boolean, platform: GameDetailsPlatform|null, coverSrc: string|null, showCover: boolean, romDl: GameDetailsProgress|null, launchProgress: GameDetailsProgress|null, switchContentProgress: GameDetailsProgress|null, hasLocalFile: boolean, launchErrorPresentation: GameDetailsLaunchErrorPresentation, visibleLaunchError: string|null, missingEmulatorRecovery: MissingEmulatorRecovery, actions: GameDetailsActions, achievementsState: GameDetailsAchievementsState, saves: GameDetailsSaves, canSyncSwitchContent: boolean, syncStatus: "remote-only"|"synced"|"downloaded-not-synced"|null, onBack: () => void, onImageError: () => void, onToggleFavorite: (gameId: number|string) => void, onOpenSettings: (() => void)|null, onOpenIntegrations: (() => void)|null, rommToken: string|null, rommUrl: string|null, retroachievementsEnabled: boolean}} GameDetailsViewProps */
/** @typedef {Omit<GameDetailsViewProps, "coverSrc"|"onBack"|"onImageError">} GameDetailsPanelProps */

const noOp = () => null;

/** @param {GameDetailsProps["onGameUpdate"]} onGameUpdate Update callback. @returns {(gameId: GameDetailsGame["id"]) => void} Callback that does not hold up the current UI action. */
const createGameUpdateNotifier = (onGameUpdate) => (gameId) => {
  void onGameUpdate?.(gameId);
};

/** @param {GameDetailsGame} game Game being viewed. @param {string|null} rommToken RomM token. @param {string|null} rommUrl RomM URL. @returns {boolean} Whether the game has remote access configured. */
const hasRemoteAccess = (game, rommToken, rommUrl) =>
  game.romm_id !== null &&
  game.romm_id !== undefined &&
  rommToken !== null &&
  rommToken !== "" &&
  rommUrl !== null &&
  rommUrl !== "";

/** @param {string|null} syncState Normalized sync state. @returns {"remote-only"|"synced"|"downloaded-not-synced"|null} Display sync status. */
const getSyncStatus = (syncState) => {
  if (syncState === "remote_only") {
    return "remote-only";
  }
  if (syncState === "synced") {
    return "synced";
  }
  if (syncState !== null && syncState !== "local_only") {
    return "downloaded-not-synced";
  }
  return null;
};

/** @param {boolean} launching Whether a launch is active. @param {boolean} launchFailureDismissed Whether the current failure was dismissed. @param {GameDetailsProgress|null} launchProgress Current launch progress. @returns {GameDetailsProgress|null} Progress visible in the details view. */
const getVisibleLaunchProgress = (
  launching,
  launchFailureDismissed,
  launchProgress
) =>
  (launching || launchFailureDismissed) && launchProgress?.stage === "failure"
    ? null
    : launchProgress;

/** @param {string|null} launchError Current launch error. @param {boolean} launchFailureDismissed Whether the current failure was dismissed. @returns {string|null} Launch error visible in the details view. */
const getVisibleLaunchError = (launchError, launchFailureDismissed) =>
  launchFailureDismissed ? null : launchError;

/** @param {string|null} launchError Current launch error. @param {GameDetailsProgress|null} launchProgress Current launch progress. @param {GameDetailsPlatform|null} platform Current game platform. @returns {GameDetailsLaunchErrorPresentation} Launch error presentation. */
const getGameDetailsLaunchPresentation = (
  launchError,
  launchProgress,
  platform
) =>
  getLaunchErrorPresentation(
    launchError ?? launchProgress?.error ?? null,
    platform?.name
  );

/** @param {GameDetailsGame} game Game being viewed. @param {GameDetailsActions} actions Current action state. @param {boolean} imgError Whether the cover image failed. @param {GameDetailsProgress|null} launchProgress Current launch progress. @param {GameDetailsPlatform|null} platform Current platform. @returns {{coverSrc: string|null, showCover: boolean, hasLocalFile: boolean, launchProgress: GameDetailsProgress|null, launchErrorPresentation: GameDetailsLaunchErrorPresentation, visibleLaunchError: string|null}} Display state. */
const getGameDetailsDisplayState = (
  game,
  actions,
  imgError,
  launchProgress,
  platform
) => {
  const coverSrc = getCoverSrc(game.cover_path);
  const showCover = Boolean(coverSrc) && !imgError;
  const hasLocalFile =
    actions.justDownloaded || Boolean(game.local_file_path?.trim());
  const visibleLaunchProgress = getVisibleLaunchProgress(
    actions.launching,
    actions.launchFailureDismissed,
    launchProgress
  );
  const visibleLaunchError = getVisibleLaunchError(
    actions.launchError,
    actions.launchFailureDismissed
  );
  return {
    coverSrc,
    hasLocalFile,
    launchErrorPresentation: getGameDetailsLaunchPresentation(
      visibleLaunchError,
      visibleLaunchProgress,
      platform
    ),
    launchProgress: visibleLaunchProgress,
    showCover,
    visibleLaunchError,
  };
};

/** @param {{actions: GameDetailsActions, game: GameDetailsGame, imgError: boolean, ipc: typeof gameDetailsIpc, launchProgress: GameDetailsProgress|null, platform: GameDetailsPlatform|null}} options Display and missing-emulator recovery state. */
const useGameDetailsDisplayState = ({
  actions,
  game,
  imgError,
  ipc,
  launchProgress,
  platform,
}) => {
  const displayState = getGameDetailsDisplayState(
    game,
    actions,
    imgError,
    launchProgress,
    platform
  );
  return {
    ...displayState,
    missingEmulatorRecovery: useMissingEmulatorRecovery({
      ipc,
      launchError:
        actions.launchError ?? displayState.launchProgress?.error ?? null,
      launchErrorPresentation: displayState.launchErrorPresentation,
      platformId: game.platform_id,
    }),
  };
};

/** @param {GameDetailsGame} game Game being viewed. @param {Array<[GameDetailsPlatform, number]>} platforms Available platforms. @param {string|null} rommToken RomM token. @param {string|null} rommUrl RomM URL. @returns {{isSwitch: boolean, platform: GameDetailsPlatform|null, syncStatus: "remote-only"|"synced"|"downloaded-not-synced"|null, canSyncSwitchContent: boolean}} Derived game details state. */
const getGameDetailsViewState = (game, platforms, rommToken, rommUrl) => {
  const isSwitch = game.platform_id === "switch";
  const platform =
    platforms.find(([candidate]) => candidate.id === game.platform_id)?.[0] ??
    null;
  const syncStatus = getSyncStatus(normalizeSyncState(game.sync_state));
  const canSyncSwitchContent =
    isSwitch &&
    game.source === "RomM" &&
    hasRemoteAccess(game, rommToken, rommUrl);
  return { canSyncSwitchContent, isSwitch, platform, syncStatus };
};

/** @param {GameDetailsProps} props Game details properties. @param {import("./game/game-details-ipc").GameDetailsIpc} ipc Game details IPC. @returns {GameDetailsAchievementResources} Achievement resources. */
const useGameDetailsAchievementState = (props, ipc) => {
  const enabled = useGameDetailsRetroAchievements(ipc);
  return {
    achievementsState: useGameDetailsAchievements({
      game: props.game,
      ipc,
      retroachievementsEnabled: enabled,
      rommToken: props.rommToken,
      rommUrl: props.rommUrl,
    }),
    retroachievementsEnabled: enabled,
  };
};

/** @param {GameDetailsPanelProps & {onOpenSaveHistory?: () => void}} props Playback controls and status content. */
const GameDetailsProgressContent = ({
  actions,
  canSyncSwitchContent,
  game,
  hasLocalFile,
  launchErrorPresentation,
  launchProgress,
  isSwitch,
  missingEmulatorRecovery,
  onOpenSaveHistory = noOp,
  onOpenSettings,
  romDl,
  rommToken,
  rommUrl,
  saves,
  switchContentProgress,
  visibleLaunchError,
}) => (
  <>
    <GameDetailsPlayControls
      canDownload={hasRemoteAccess(game, rommToken, rommUrl)}
      canPlay={actions.canPlay}
      canSyncSwitchContent={canSyncSwitchContent}
      cloudSaveStatus={
        isSwitch && hasRemoteAccess(game, rommToken, rommUrl) ? (
          <GameDetailsCloudSave
            onOpenHistory={onOpenSaveHistory}
            saveSyncEnabled={saves.saveSyncEnabled}
          />
        ) : null
      }
      downloading={actions.downloading}
      game={game}
      hasLocalFile={hasLocalFile}
      launchActive={actions.launchActive}
      onDownload={actions.handleDownloadRom}
      onLaunch={actions.handleLaunchGame}
      onSyncSwitchContent={actions.handleSyncSwitchContent}
      saveSyncBusy={saves.switchSyncBusy}
      switchContentStatus={actions.switchContentStatus}
      switchContentSyncing={actions.switchContentSyncing}
    />
    <GameDetailsLaunchStatus
      downloadActive={actions.downloadActive}
      launchActive={actions.launchActive}
      launchError={visibleLaunchError}
      onDismiss={actions.handleDismissLaunchFailure}
      onOpenSettings={onOpenSettings}
      onRetry={actions.handleLaunchGame}
      presentation={launchErrorPresentation}
      progress={launchProgress}
      recovery={missingEmulatorRecovery}
    />
    <GameDetailsDownloadStatus
      downloading={actions.downloading}
      progress={romDl}
      status={actions.downloadStatus}
      switchContentProgress={switchContentProgress}
      switchContentSyncing={actions.switchContentSyncing}
    />
  </>
);

/** @param {GameDetailsPanelProps & {onOpenSaveHistory?: () => void}} props Header controls and playback status. */
const GameDetailsActionContent = (props) => {
  const {
    actions,
    game,
    hasLocalFile,
    onToggleFavorite,
    platform,
    rommToken,
    rommUrl,
    showCover,
    syncStatus,
  } = props;
  return (
    <>
      <GameDetailsControlsHeader
        actionStatus={actions.actionStatus}
        deleteDialogOpen={actions.deleteDialogOpen}
        game={game}
        hasLocalFile={hasLocalFile}
        menuAnchor={actions.menuAnchor}
        onAddToCollection={actions.handleAddToCollection}
        onCancelDelete={() => {
          actions.setDeleteDialogOpen(false);
        }}
        onClearActionStatus={() => {
          actions.setActionStatus(null);
        }}
        onConfirmDelete={actions.handleDeleteDownload}
        onHideGame={actions.handleHideGame}
        onMenuClose={() => {
          actions.setMenuAnchor(null);
        }}
        onMenuOpen={(event) => {
          actions.setMenuAnchor(event.currentTarget);
        }}
        onOpenLocation={actions.handleOpenLocation}
        onRefreshMetadata={actions.handleRefreshMetadata}
        onRequestDelete={() => {
          actions.setMenuAnchor(null);
          actions.setDeleteDialogOpen(true);
        }}
        onToggleFavorite={onToggleFavorite}
        platform={platform}
        refreshing={actions.refreshing}
        rommToken={rommToken}
        rommUrl={rommUrl}
        showCover={showCover}
        syncStatus={syncStatus}
      />
      <GameDetailsProgressContent {...props} />
    </>
  );
};

/** @param {GameDetailsPanelProps} props Overview and save content. */
const GameDetailsPanelContent = (props) => {
  const [saveHistoryOpen, setSaveHistoryOpen] = useState(false);
  const {
    actions,
    game,
    isSwitch,
    achievementsState,
    onOpenIntegrations,
    retroachievementsEnabled,
    saves,
  } = props;
  return (
    <>
      <GameDetailsActionContent
        {...props}
        onOpenSaveHistory={() => {
          setSaveHistoryOpen(true);
        }}
      />
      <GameDetailsOverview
        achievementsState={achievementsState}
        game={game}
        onOpenIntegrations={onOpenIntegrations}
        retroachievementsEnabled={retroachievementsEnabled}
      />
      <GameDetailsSavesSection
        game={game}
        historyOpen={saveHistoryOpen}
        isSwitch={isSwitch}
        launchActive={actions.launchActive}
        onClearStatus={() => {
          saves.setSaveStatus(null);
        }}
        onCloseHistory={() => {
          setSaveHistoryOpen(false);
        }}
        onCreateBackup={saves.handleCreateSwitchBackup}
        onDownloadSave={saves.handleDownloadSave}
        onEnableSaveSync={saves.handleEnableSaveSync}
        onListSaves={saves.handleListSaves}
        onResumeSwitchSaveNormalSync={saves.handleResumeSwitchSaveNormalSync}
        onSyncCurrentSave={saves.handleSyncCurrentSwitchSave}
        onUploadSave={saves.handleUploadSave}
        saveStatus={saves.saveStatus}
        saveSyncEnabled={saves.saveSyncEnabled}
        saves={saves.saves}
        savesLoaded={saves.savesLoaded}
        savesLoading={saves.savesLoading}
        switchPathInfo={saves.switchPathInfo}
        switchRestoreProtection={saves.switchRestoreProtection}
        switchSyncBusy={saves.switchSyncBusy}
      />
    </>
  );
};

/** @param {GameDetailsPanelProps} props Details panel properties. */
const GameDetailsPanel = (props) => (
  <Box sx={{ pb: 3, px: { sm: 3, xs: 2 } }}>
    <Paper
      sx={{
        background: "linear-gradient(135deg, #1e1e26 0%, #252530 100%)",
        borderRadius: 3,
        p: 4,
      }}
    >
      <GameDetailsPanelContent {...props} />
    </Paper>
  </Box>
);

/** @param {GameDetailsViewProps} props View properties. */
const GameDetailsView = ({
  actions,
  achievementsState,
  canSyncSwitchContent,
  coverSrc,
  game,
  hasLocalFile,
  isSwitch,
  launchErrorPresentation,
  launchProgress,
  missingEmulatorRecovery,
  onBack,
  onOpenIntegrations,
  onOpenSettings,
  onImageError,
  onToggleFavorite,
  platform,
  retroachievementsEnabled,
  romDl,
  rommToken,
  rommUrl,
  saves,
  showCover,
  switchContentProgress,
  syncStatus,
  visibleLaunchError,
}) => (
  <Box
    sx={{
      maxWidth: { md: 1400, xl: 1800, xs: "100%" },
      mx: "auto",
      width: "100%",
    }}
  >
    <GameDetailsHeader
      coverSrc={coverSrc}
      game={game}
      onBack={onBack}
      onImageError={onImageError}
      showCover={showCover}
    />
    <GameDetailsPanel
      actions={actions}
      achievementsState={achievementsState}
      canSyncSwitchContent={canSyncSwitchContent}
      game={game}
      hasLocalFile={hasLocalFile}
      isSwitch={isSwitch}
      launchErrorPresentation={launchErrorPresentation}
      launchProgress={launchProgress}
      missingEmulatorRecovery={missingEmulatorRecovery}
      onOpenIntegrations={onOpenIntegrations}
      onOpenSettings={onOpenSettings}
      onToggleFavorite={onToggleFavorite}
      platform={platform}
      retroachievementsEnabled={retroachievementsEnabled}
      romDl={romDl}
      rommToken={rommToken}
      rommUrl={rommUrl}
      saves={saves}
      showCover={showCover}
      switchContentProgress={switchContentProgress}
      syncStatus={syncStatus}
      visibleLaunchError={visibleLaunchError}
    />
    <CollectionPickerDialog
      collections={actions.collections}
      gameName={game.name}
      onClose={() => {
        actions.setCollectionDialogOpen(false);
      }}
      onPick={(collectionId) => {
        void actions.handlePickCollection(collectionId);
      }}
      open={actions.collectionDialogOpen}
    />
  </Box>
);

/** @param {GameDetailsProps} props Component properties. @returns {GameDetailsViewProps} View state. */
const useGameDetailsController = (props) => {
  const {
    game,
    onBack,
    onGameUpdate,
    onLaunch,
    onOpenIntegrations = null,
    onOpenSettings = null,
    onToggleFavorite,
    platforms,
    rommToken,
    rommUrl,
  } = props;
  const dependencies = props.dependencies ?? {};
  const ipc = dependencies.ipc ?? gameDetailsIpc;
  const openDialog = dependencies.openDialog ?? defaultOpenDialog;
  const { getLaunchProgress, getProgress, getSwitchContentProgress } =
    useRomDownloads();
  const romDl = getProgress(game.id);
  const launchProgress = getLaunchProgress(game.id);
  const switchContentProgress = getSwitchContentProgress(game.id);
  const { canSyncSwitchContent, isSwitch, platform, syncStatus } =
    getGameDetailsViewState(game, platforms, rommToken, rommUrl);
  const [imgError, setImgError] = useState(false);
  const saves = useGameDetailsSaves({
    game,
    ipc,
    isSwitch,
    openDialog,
    rommToken,
    rommUrl,
  });
  const actions = useGameDetailsActions({
    canSyncSwitchContent,
    game,
    ipc,
    launchProgress,
    onBack,
    onGameUpdate: createGameUpdateNotifier(onGameUpdate),
    onLaunch,
    onLaunchComplete: saves.handleLaunchSaveSyncResult,
    romDl,
    rommToken,
    rommUrl,
  });
  const { achievementsState, retroachievementsEnabled } =
    useGameDetailsAchievementState(props, ipc);
  const displayState = useGameDetailsDisplayState({
    actions,
    game,
    imgError,
    ipc,
    launchProgress,
    platform,
  });
  return {
    ...displayState,
    achievementsState,
    actions,
    canSyncSwitchContent,
    game,
    isSwitch,
    onBack,
    onImageError: () => {
      setImgError(true);
    },
    onOpenIntegrations,
    onOpenSettings,
    onToggleFavorite,
    platform,
    retroachievementsEnabled,
    romDl,
    rommToken,
    rommUrl,
    saves,
    switchContentProgress,
    syncStatus,
  };
};

/** @param {GameDetailsProps} props Component properties. */
const GameDetails = (props) => (
  <GameDetailsView {...useGameDetailsController(props)} />
);

export default GameDetails;
