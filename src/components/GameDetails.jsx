import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { useEffect, useState } from "react";

import { getLaunchErrorPresentation } from "../immersive/launchError";
import { useRomDownloads } from "../RomDownloadsContext";
import { normalizeSyncState } from "../utils/gameFilters";
import CollectionPickerDialog from "./game/CollectionPickerDialog";
import {
  GameDetailsDownloadStatus,
  GameDetailsLaunchStatus,
  GameDetailsPlayControls,
} from "./game/game-details-actions-panel";
import { GameDetailsControlsHeader } from "./game/game-details-controls-header";
import { GameDetailsHeader } from "./game/game-details-header";
import { getGameDetailsConfig } from "./game/game-details-ipc";
import { GameDetailsOverview } from "./game/game-details-overview";
import { GameDetailsSavesSection } from "./game/game-details-saves-section";
import { getCoverSrc } from "./game/game-details-utils";
import { useGameDetailsActions } from "./game/use-game-details-actions";
import { useGameDetailsSaves } from "./game/use-game-details-saves";

/** @typedef {import("./game/game-details-types").GameDetailsGame} GameDetailsGame */
/** @typedef {import("./game/game-details-types").GameDetailsLaunchResult} GameDetailsLaunchResult */
/** @typedef {import("./game/game-details-types").GameDetailsPlatform} GameDetailsPlatform */

/** @typedef {{game: GameDetailsGame, platforms: Array<[GameDetailsPlatform, number]>, onBack: () => void, onLaunch: (gameId: number|string) => Promise<GameDetailsLaunchResult|null|undefined>, onToggleFavorite: (gameId: number|string) => void, onGameUpdate?: (gameId: number|string) => void|Promise<void>, rommToken: string|null, rommUrl: string|null, onOpenSettings?: (() => void)|null, onOpenIntegrations?: (() => void)|null}} GameDetailsProps */

/** @param {GameDetailsProps} props Component properties. */
const GameDetails = ({
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
}) => {
  const { getLaunchProgress, getProgress, getSwitchContentProgress } =
    useRomDownloads();
  const romDl = getProgress(game.id);
  const launchProgress = getLaunchProgress(game.id);
  const switchContentProgress = getSwitchContentProgress(game.id);
  const isSwitch = game.platform_id === "switch";
  const platform =
    platforms.find(([candidate]) => candidate.id === game.platform_id)?.[0] ??
    null;
  const syncState = normalizeSyncState(game.sync_state);
  const syncStatus =
    syncState === "remote_only"
      ? "remote-only"
      : syncState === "synced"
        ? "synced"
        : syncState && syncState !== "local_only"
          ? "downloaded-not-synced"
          : null;
  const [imgError, setImgError] = useState(false);
  const [retroachievementsEnabled, setRetroachievementsEnabled] =
    useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const coverSrc = getCoverSrc(game.cover_path);
  const showCover = Boolean(coverSrc) && !imgError;
  const canDownload = Boolean(game.romm_id && rommToken && rommUrl);
  const canSyncSwitchContent = Boolean(
    isSwitch && game.source === "RomM" && game.romm_id && rommToken && rommUrl
  );

  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      try {
        const config = await getGameDetailsConfig();
        if (!cancelled) {
          setRetroAchievementsEnabled(
            Boolean(config.display?.retroachievements_enabled)
          );
        }
      } catch {
        if (!cancelled) {
          setRetroachievementsEnabled(false);
        }
      }
    };
    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  const actions = useGameDetailsActions({
    canSyncSwitchContent,
    game,
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
  const saves = useGameDetailsSaves({ game, isSwitch, rommToken, rommUrl });
  const visibleLaunchProgress =
    actions.launching && launchProgress?.stage === "failure"
      ? null
      : launchProgress;
  const rawLaunchError =
    actions.launchError ?? visibleLaunchProgress?.error ?? null;
  const launchErrorPresentation = getLaunchErrorPresentation(
    rawLaunchError,
    platform?.name
  );
  const hasLocalFile =
    actions.justDownloaded || Boolean(game.local_file_path?.trim());

  return (
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
        onImageError={() => {
          setImgError(true);
        }}
        showCover={showCover}
      />
      <Box sx={{ pb: 3, px: { sm: 3, xs: 2 } }}>
        <Paper
          sx={{
            background: "linear-gradient(135deg, #1e1e26 0%, #252530 100%)",
            borderRadius: 3,
            p: 4,
          }}
        >
          <GameDetailsControlsHeader
            actionStatus={actions.actionStatus}
            deleteDialogOpen={deleteDialogOpen}
            game={game}
            hasLocalFile={hasLocalFile}
            menuAnchor={actions.menuAnchor}
            onAddToCollection={actions.openAddToCollection}
            onCancelDelete={() => {
              setDeleteDialogOpen(false);
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
              setDeleteDialogOpen(true);
            }}
            onToggleFavorite={onToggleFavorite}
            platform={platform}
            refreshing={actions.refreshing}
            rommToken={rommToken}
            rommUrl={rommUrl}
            showCover={showCover}
            syncStatus={syncStatus}
          />
          <GameDetailsPlayControls
            canDownload={canDownload}
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
            progress={visibleLaunchProgress}
          />
          <GameDetailsDownloadStatus
            downloading={actions.downloading}
            progress={romDl}
            status={actions.downloadStatus}
            switchContentProgress={switchContentProgress}
            switchContentSyncing={actions.switchContentSyncing}
          />
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
            saveStatus={saves.saveStatus}
            saves={saves.saves}
            savesLoaded={saves.savesLoaded}
            savesLoading={saves.savesLoading}
            setSwitchSlot={saves.setSwitchSlot}
            switchPathInfo={saves.switchPathInfo}
            switchSlot={saves.switchSlot}
            switchSyncBusy={saves.switchSyncBusy}
          />
        </Paper>
        <CollectionPickerDialog
          collections={actions.collections}
          gameName={game.name}
          onClose={() => {
            actions.setCollectionDialogOpen(false);
          }}
          onPick={actions.handlePickCollection}
          open={actions.collectionDialogOpen}
        />
      </Box>
    </Box>
  );
};

export default GameDetails;
