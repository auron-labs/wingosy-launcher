import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useRef } from "react";

import { GameDetailsSavesSection } from "../components/game/game-details-saves-section";
import {
  DetailsStatusArea,
  DetailsSummary,
} from "./immersive-game-details-sections";
import {
  HeroBackdrop,
  ImmersiveShellLayout,
  ImmersiveTopBar,
} from "./immersive-shell";
import { getImmersiveCoverSrc } from "./immersive-shell-utils";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {import("./immersive-types").PlatformEntry} PlatformEntry */
/** @typedef {{downloaded?: number|null, total?: number|null, percent?: number|null, stage?: string, file_index?: number|null, total_files?: number|null}} DownloadProgress */
/** @typedef {{message: string, type: "error"|"info"|"success"}} DetailsStatus */
/** @typedef {Record<string, string>} DetailsColors */

/** @typedef {{game: ImmersiveGame, achievementState: ReturnType<typeof import("../components/game/use-game-details-achievements").useGameDetailsAchievements>, colors: DetailsColors, detailsRef: {current: HTMLElement|null}, screenshots: string[], getMediaSrc: (url: string) => string|null, onBack: () => void, onGoToLibrarySection?: ((section: string) => void)|null, section?: string|null, platforms?: PlatformEntry[], selectedPlatform?: string|null, onSelectedPlatformChange?: ((platform: string|null) => void)|null, searchQuery?: string, onSearchChange?: ((query: string) => void)|null, platformLabel?: string|null, retroachievementsEnabled: boolean, onOpenIntegrations: (() => void)|null, menuAnchor: HTMLElement|null, setMenuAnchor: (anchor: HTMLElement|null) => void, hasRomm: boolean, rommConfigured: boolean, refreshing: boolean, hasLocalFile: boolean, onOpenLocation: () => Promise<void>, onHideGame: () => Promise<void>, onAddToCollection: () => Promise<void>, onRefreshMetadata: () => Promise<void>, onDelete: () => void, onSaveScroll: () => void, downloading: boolean, romDl: DownloadProgress|null, downloadStatus: DetailsStatus|null, setDownloadStatus: (status: DetailsStatus|null) => void, actionStatus: DetailsStatus|null, setActionStatus: (status: DetailsStatus|null) => void, saveStatus: import("../components/game/game-details-types").GameDetailsStatus|null, onClearSaveStatus: () => void, onResumeSwitchSaveNormalSync: () => Promise<void>, isSwitch: boolean, switchRestoreProtection: import("../components/game/game-details-types").GameDetailsSwitchSaveRestoreProtection|null, switchSyncBusy: boolean, switchContentSyncing: boolean, switchContentStatus: import("../components/game/game-details-types").GameDetailsSwitchContentStatus|null, switchContentProgress: DownloadProgress|null, canPlay: boolean, launchActive: boolean, primaryActionRef: {current: HTMLButtonElement|null}, handleLaunchGame: () => Promise<void>, handleDownloadRom: () => Promise<void>, canDownload: boolean, canSyncSwitchContent: boolean, handleSyncSwitchContent: () => Promise<void>, onToggleFavorite: (gameId: number|string) => void|Promise<void>, setDeleteDialogOpen: (open: boolean) => void, savesSectionRef: {current: HTMLElement|null}, saveHistoryOpen?: boolean, setSaveHistoryOpen?: (open: boolean) => void, onCreateBackup: () => Promise<void>, onDownloadSave: (saveId: number, retrySlot?: string|null) => Promise<void>, onEnableSaveSync: () => Promise<void>, onListSaves: () => Promise<void>, onSyncCurrentSave: () => Promise<void>, onUploadSave: (retryFilePath?: string|null) => Promise<void>, saveSyncEnabled?: boolean, saves?: import("../components/game/game-details-types").GameDetailsSave[], savesLoaded?: boolean, savesLoading?: boolean, switchPathInfo?: import("../components/game/game-details-types").GameDetailsSwitchPathInfo|null}} ImmersiveDetailsContentProps */

/** @param {import("react").FocusEvent<HTMLElement>} event Focus event. */
const markDetailsActionFocus = ({ target }) => {
  if (
    target instanceof HTMLElement &&
    target.matches("button:not(:disabled)")
  ) {
    target.dataset.controllerFocused = "true";
  }
};

/** @param {import("react").FocusEvent<HTMLElement>} event Blur event. */
const clearDetailsActionFocus = ({ target }) => {
  if (
    target instanceof HTMLElement &&
    target.matches("button:not(:disabled)")
  ) {
    delete target.dataset.controllerFocused;
  }
};

/** @param {ImmersiveDetailsContentProps} props Details menu properties. */
const getDetailsMenuProps = ({
  hasLocalFile,
  hasRomm,
  onAddToCollection,
  onDelete,
  onHideGame,
  onOpenLocation,
  onRefreshMetadata,
  onSaveScroll,
  refreshing,
  rommConfigured,
}) => ({
  hasLocalFile,
  hasRomm,
  onAddToCollection,
  onDelete,
  onHideGame,
  onOpenLocation,
  onRefreshMetadata,
  onSaveScroll,
  refreshing,
  rommConfigured,
});

/** @param {ImmersiveDetailsContentProps} props Save section properties. */
const DetailsSharedSaves = (props) => {
  const {
    game,
    isSwitch,
    launchActive,
    onClearSaveStatus,
    onCreateBackup,
    onDownloadSave,
    onEnableSaveSync,
    onListSaves,
    onResumeSwitchSaveNormalSync,
    onSyncCurrentSave,
    onUploadSave,
    saveHistoryOpen,
    saveStatus,
    saveSyncEnabled,
    saves,
    savesLoaded,
    savesLoading,
    setSaveHistoryOpen,
    switchPathInfo,
    switchRestoreProtection,
    switchSyncBusy,
  } = props;
  return (
    <GameDetailsSavesSection
      game={game}
      historyOpen={saveHistoryOpen === true}
      isSwitch={isSwitch}
      launchActive={launchActive}
      onClearStatus={onClearSaveStatus}
      onCloseHistory={() => {
        setSaveHistoryOpen?.(false);
      }}
      onCreateBackup={onCreateBackup}
      onDownloadSave={onDownloadSave}
      onEnableSaveSync={onEnableSaveSync}
      onListSaves={onListSaves}
      onResumeSwitchSaveNormalSync={onResumeSwitchSaveNormalSync}
      onSyncCurrentSave={onSyncCurrentSave}
      onUploadSave={onUploadSave}
      saveStatus={saveStatus}
      saveSyncEnabled={saveSyncEnabled === true}
      saves={saves ?? []}
      savesLoaded={savesLoaded === true}
      savesLoading={savesLoading === true}
      switchPathInfo={switchPathInfo ?? null}
      switchRestoreProtection={switchRestoreProtection}
      switchSyncBusy={switchSyncBusy}
    />
  );
};

/** @param {ImmersiveDetailsContentProps} props Save section properties. */
const DetailsSavesSection = (props) => {
  const { hasRomm, isSwitch, rommConfigured, savesSectionRef } = props;
  if (!hasRomm || !rommConfigured) {
    return null;
  }
  const sharedSaves = <DetailsSharedSaves {...props} />;
  if (!isSwitch) {
    return (
      <Box ref={savesSectionRef} sx={{ maxWidth: 720 }}>
        {sharedSaves}
      </Box>
    );
  }
  return (
    <Box ref={savesSectionRef} sx={{ maxWidth: 720, mt: 4 }}>
      <Divider sx={{ mb: 2, opacity: 0.2 }} />
      <Box
        component="h2"
        sx={{
          color: "rgba(245,241,232,0.85)",
          fontSize: "1rem",
          fontWeight: 700,
          m: 0,
          mb: 1,
        }}
      >
        Saves (RomM)
      </Box>
      {sharedSaves}
    </Box>
  );
};

/** @param {ImmersiveDetailsContentProps} props Panel properties. */
const DetailsPanelContent = (props) => {
  const menuProps = getDetailsMenuProps(props);
  return (
    <>
      <DetailsSummary {...props} menuProps={menuProps} />
      <DetailsStatusArea {...props} />
      <DetailsSavesSection {...props} />
    </>
  );
};

/** @param {{onBack: () => void}} props Back line properties. */
const DetailsBackLine = ({ onBack }) => (
  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
    <Button
      data-argosy-sound="back"
      startIcon={<ArrowBackIcon />}
      onClick={onBack}
      color="inherit"
      sx={{
        borderRadius: 2,
        color: "rgba(245,241,232,0.75)",
        fontWeight: 600,
        px: 1.5,
        textTransform: "none",
      }}
    >
      Back
    </Button>
    <Typography sx={{ color: "rgba(245,241,232,0.45)", fontSize: "0.95rem" }}>
      to library
    </Typography>
  </Stack>
);

/** @returns {HTMLInputElement|null} Initial search input ref. */
const getInitialSearchInputRef = () => null;

/** @param {Pick<ImmersiveDetailsContentProps, "game"|"section"|"onGoToLibrarySection"|"searchQuery"|"onSearchChange">} props Frame properties. */
const DetailsFrame = (props) => {
  const { game, section, onGoToLibrarySection, searchQuery, onSearchChange } =
    props;
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const searchInputRef = useRef(getInitialSearchInputRef());
  return (
    <Box
      sx={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        minHeight: 0,
        minWidth: 0,
        position: "relative",
      }}
    >
      <HeroBackdrop
        coverSrc={getImmersiveCoverSrc(game.cover_path)}
        reducedMotion={reducedMotion}
      />
      <Box sx={{ position: "relative", zIndex: 1 }}>
        <ImmersiveTopBar
          section={section ?? null}
          onSectionChange={onGoToLibrarySection ?? null}
          searchInputRef={searchInputRef}
          searchQuery={searchQuery ?? ""}
          onSearchChange={onSearchChange ?? undefined}
        />
      </Box>
    </Box>
  );
};

/** @param {ImmersiveDetailsContentProps} props Component properties. */
const ImmersiveGameDetailsContent = (props) => {
  const { detailsRef, onBack } = props;
  return (
    <ImmersiveShellLayout>
      <Box
        data-testid="immersive-game-details"
        sx={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <DetailsFrame {...props} />
        <Box
          ref={detailsRef}
          sx={{
            flex: 1,
            minHeight: 0,
            overflowX: "hidden",
            overflowY: "auto",
            overscrollBehavior: "contain",
            position: "relative",
            px: { lg: 5, md: 4, xs: 2.5 },
            py: 2,
            zIndex: 1,
          }}
          onFocus={markDetailsActionFocus}
          onBlur={clearDetailsActionFocus}
        >
          <DetailsBackLine onBack={onBack} />
          <DetailsPanelContent {...props} />
        </Box>
      </Box>
    </ImmersiveShellLayout>
  );
};

export default ImmersiveGameDetailsContent;
