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
import { GameDetailsControlsHeader } from "./game/game-details-controls-header";
import { GameDetailsHeader } from "./game/game-details-header";
import { gameDetailsIpc } from "./game/game-details-ipc";
import { GameDetailsOverview } from "./game/game-details-overview";
import { GameDetailsSavesSection } from "./game/game-details-saves-section";
import { getCoverSrc } from "./game/game-details-utils";
import { useGameDetailsActions } from "./game/use-game-details-actions";
import { useGameDetailsRetroAchievements } from "./game/use-game-details-config";
import { useGameDetailsSaves } from "./game/use-game-details-saves";

/** @typedef {import("./game/game-details-types").GameDetailsGame} GameDetailsGame */
/** @typedef {import("./game/game-details-types").GameDetailsLaunchErrorPresentation} GameDetailsLaunchErrorPresentation */
/** @typedef {import("./game/game-details-types").GameDetailsLaunchResult} GameDetailsLaunchResult */
/** @typedef {import("./game/game-details-types").GameDetailsPlatform} GameDetailsPlatform */
/** @typedef {import("./game/game-details-types").GameDetailsProgress} GameDetailsProgress */

/** @typedef {{game: GameDetailsGame, platforms: Array<[GameDetailsPlatform, number]>, onBack: () => void, onLaunch: (gameId: number|string) => Promise<GameDetailsLaunchResult|null|undefined>, onToggleFavorite: (gameId: number|string) => void, onGameUpdate?: (gameId: number|string) => void|Promise<void>, rommToken: string|null, rommUrl: string|null, onOpenSettings?: (() => void)|null, onOpenIntegrations?: (() => void)|null, dependencies?: {ipc?: import("./game/game-details-ipc").GameDetailsIpc, openDialog?: typeof defaultOpenDialog}}} GameDetailsProps */
/** @typedef {ReturnType<typeof useGameDetailsActions>} GameDetailsActions */
/** @typedef {ReturnType<typeof useGameDetailsSaves>} GameDetailsSaves */
/** @typedef {{game: GameDetailsGame, isSwitch: boolean, platform: GameDetailsPlatform|null, coverSrc: string|null, showCover: boolean, romDl: GameDetailsProgress|null, launchProgress: GameDetailsProgress|null, switchContentProgress: GameDetailsProgress|null, hasLocalFile: boolean, launchErrorPresentation: GameDetailsLaunchErrorPresentation, actions: GameDetailsActions, saves: GameDetailsSaves, canSyncSwitchContent: boolean, syncStatus: "remote-only"|"synced"|"downloaded-not-synced"|null, onBack: () => void, onImageError: () => void, onToggleFavorite: (gameId: number|string) => void, onOpenSettings: (() => void)|null, onOpenIntegrations: (() => void)|null, rommToken: string|null, rommUrl: string|null, retroachievementsEnabled: boolean}} GameDetailsViewProps */
/** @typedef {Omit<GameDetailsViewProps, "coverSrc"|"onBack"|"onImageError">} GameDetailsPanelProps */

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

/** @param {boolean} launching Whether a launch is active. @param {GameDetailsProgress|null} launchProgress Current launch progress. @returns {GameDetailsProgress|null} Progress visible in the details view. */
const getVisibleLaunchProgress = (launching, launchProgress) =>
  launching && launchProgress?.stage === "failure" ? null : launchProgress;

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

/** @param {GameDetailsGame} game Game being viewed. @param {GameDetailsActions} actions Current action state. @param {boolean} imgError Whether the cover image failed. @param {GameDetailsProgress|null} launchProgress Current launch progress. @param {GameDetailsPlatform|null} platform Current platform. @returns {{coverSrc: string|null, showCover: boolean, hasLocalFile: boolean, launchProgress: GameDetailsProgress|null, launchErrorPresentation: GameDetailsLaunchErrorPresentation}} Display state. */
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
    launchProgress
  );
  return {
    coverSrc,
    hasLocalFile,
    launchErrorPresentation: getGameDetailsLaunchPresentation(
      actions.launchError,
      visibleLaunchProgress,
      platform
    ),
    launchProgress: visibleLaunchProgress,
    showCover,
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

/** @param {GameDetailsPanelProps} props Playback controls and status content. */
const GameDetailsProgressContent = ({
  actions,
  canSyncSwitchContent,
  game,
  hasLocalFile,
  launchErrorPresentation,
  launchProgress,
  onOpenSettings,
  romDl,
  rommToken,
  rommUrl,
  switchContentProgress,
}) => (
  <>
    <GameDetailsPlayControls
      canDownload={hasRemoteAccess(game, rommToken, rommUrl)}
      canPlay={actions.canPlay}
      canSyncSwitchContent={canSyncSwitchContent}
      downloading={actions.downloading}
      game={game}
      hasLocalFile={hasLocalFile}
      launchActive={actions.launchActive}
      onDownload={actions.handleDownloadRom}
      onLaunch={actions.handleLaunchGame}
      onSyncSwitchContent={actions.handleSyncSwitchContent}
      switchContentSyncing={actions.switchContentSyncing}
    />
    <GameDetailsLaunchStatus
      downloadActive={actions.downloadActive}
      launchActive={actions.launchActive}
      launchError={actions.launchError}
      onOpenSettings={onOpenSettings}
      onRetry={actions.handleLaunchGame}
      presentation={launchErrorPresentation}
      progress={launchProgress}
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

/** @param {GameDetailsPanelProps} props Header controls and playback status. */
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
  const {
    game,
    isSwitch,
    onOpenIntegrations,
    retroachievementsEnabled,
    rommToken,
    rommUrl,
    saves,
  } = props;
  return (
    <>
      <GameDetailsActionContent {...props} />
      <GameDetailsOverview
        game={game}
        onOpenIntegrations={onOpenIntegrations}
        retroachievementsEnabled={retroachievementsEnabled}
      />
      <GameDetailsSavesSection
        game={game}
        isSwitch={isSwitch}
        onClearStatus={() => {
          saves.setSaveStatus(null);
        }}
        onDownloadSave={saves.handleDownloadSave}
        onDownloadSwitchSave={saves.handleDownloadSwitchSave}
        onListSaves={saves.handleListSaves}
        onUploadSave={saves.handleUploadSave}
        onUploadSwitchSave={saves.handleUploadSwitchSave}
        rommToken={rommToken}
        rommUrl={rommUrl}
        saveStatus={saves.saveStatus}
        saves={saves.saves}
        savesLoaded={saves.savesLoaded}
        savesLoading={saves.savesLoading}
        setSwitchSlot={saves.setSwitchSlot}
        switchPathInfo={saves.switchPathInfo}
        switchSlot={saves.switchSlot}
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
  canSyncSwitchContent,
  coverSrc,
  game,
  hasLocalFile,
  isSwitch,
  launchErrorPresentation,
  launchProgress,
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
      canSyncSwitchContent={canSyncSwitchContent}
      game={game}
      hasLocalFile={hasLocalFile}
      isSwitch={isSwitch}
      launchErrorPresentation={launchErrorPresentation}
      launchProgress={launchProgress}
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
  /** @type {{ipc?: typeof gameDetailsIpc, openDialog?: typeof defaultOpenDialog}} */
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
  const actions = useGameDetailsActions({
    canSyncSwitchContent,
    game,
    ipc,
    launchProgress,
    onBack,
    onGameUpdate: (gameId) => {
      void onGameUpdate?.(gameId);
    },
    onLaunch,
    romDl,
    rommToken,
    rommUrl,
  });
  const saves = useGameDetailsSaves({
    game,
    ipc,
    isSwitch,
    openDialog,
    rommToken,
    rommUrl,
  });
  const retroachievementsEnabled = useGameDetailsRetroAchievements(ipc);
  const displayState = getGameDetailsDisplayState(
    game,
    actions,
    imgError,
    launchProgress,
    platform
  );
  return {
    ...displayState,
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
