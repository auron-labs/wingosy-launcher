import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import { alpha } from "@mui/material/styles";

import GameScreenshotsSection from "../components/game/game-screenshots-section";
import { DetailsActions } from "./immersive-game-details-actions";
import {
  DetailsStatusArea,
  DetailsSummary,
} from "./immersive-game-details-sections";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {{downloaded?: number|null, total?: number|null, percent?: number|null, stage?: string, file_index?: number|null, total_files?: number|null}} DownloadProgress */
/** @typedef {{message: string, type: "error"|"info"|"success"}} DetailsStatus */
/** @typedef {Record<string, string>} DetailsColors */

/** @typedef {{game: ImmersiveGame, colors: DetailsColors, detailsRef: {current: HTMLElement|null}, screenshots: string[], getMediaSrc: (url: string) => string|null, onBack: () => void, platformLabel?: string|null, retroachievementsEnabled: boolean, onOpenIntegrations: (() => void)|null, menuAnchor: HTMLElement|null, setMenuAnchor: (anchor: HTMLElement|null) => void, hasRomm: boolean, rommConfigured: boolean, refreshing: boolean, hasLocalFile: boolean, onOpenLocation: () => Promise<void>, onHideGame: () => Promise<void>, onAddToCollection: () => Promise<void>, onRefreshMetadata: () => Promise<void>, onDelete: () => void, onSaveScroll: () => void, downloading: boolean, romDl: DownloadProgress|null, downloadStatus: DetailsStatus|null, setDownloadStatus: (status: DetailsStatus|null) => void, actionStatus: DetailsStatus|null, setActionStatus: (status: DetailsStatus|null) => void, switchContentSyncing: boolean, switchContentProgress: DownloadProgress|null, canPlay: boolean, launchActive: boolean, primaryActionRef: {current: HTMLButtonElement|null}, handleLaunchGame: () => Promise<void>, handleDownloadRom: () => Promise<void>, canDownload: boolean, canSyncSwitchContent: boolean, handleSyncSwitchContent: () => Promise<void>, onToggleFavorite: (gameId: number|string) => void|Promise<void>, setDeleteDialogOpen: (open: boolean) => void, savesSectionRef: {current: HTMLElement|null}}} ImmersiveDetailsContentProps */

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

/** @param {{colors: DetailsColors, children: import("react").ReactNode}} props Paper properties. */
const DetailsPaper = ({ colors, children }) => (
  <Paper
    elevation={0}
    sx={(theme) => ({
      bgcolor:
        theme.palette.mode === "dark"
          ? alpha(theme.palette.background.paper, 0.98)
          : theme.palette.background.paper,
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: 3,
      boxShadow: `0 20px 56px ${alpha("#000", theme.palette.mode === "dark" ? 0.55 : 0.12)}`,
      overflow: "hidden",
    })}
  >
    <Box
      sx={{
        background: `radial-gradient(1200px 500px at 15% 0%, ${alpha(colors.primary, 0.22)} 0%, transparent 55%), radial-gradient(900px 450px at 85% 10%, ${alpha(colors.primaryLight, 0.14)} 0%, transparent 58%)`,
        p: 4,
      }}
    >
      {children}
    </Box>
  </Paper>
);

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

/** @param {Pick<ImmersiveDetailsContentProps, "hasRomm"|"rommConfigured"|"savesSectionRef">} props Save section properties. */
const DetailsSavesSection = ({ hasRomm, rommConfigured, savesSectionRef }) => {
  if (!hasRomm || !rommConfigured) {
    return null;
  }
  return (
    <Box ref={savesSectionRef} sx={{ mt: 4 }}>
      <Divider sx={{ mb: 2, opacity: 0.12 }} />
      <Box
        component="h2"
        sx={{ fontSize: "1rem", fontWeight: 700, m: 0, mb: 1 }}
      >
        Saves (RomM)
      </Box>
      <Box
        component="p"
        sx={{ color: "text.secondary", fontSize: "0.875rem", m: 0 }}
      >
        Select <strong>Manage cached saves</strong> in this game&apos;s More
        options menu to jump here when cloud saves are configured on the server.
      </Box>
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
      <DetailsActions {...props} />
      <DetailsSavesSection {...props} />
    </>
  );
};

/** @param {ImmersiveDetailsContentProps} props Component properties. */
const ImmersiveGameDetailsContent = (props) => {
  const { colors, detailsRef, getMediaSrc, onBack, screenshots } = props;
  return (
    <Box
      ref={detailsRef}
      data-testid="immersive-game-details"
      sx={{
        backgroundImage: `radial-gradient(1000px 380px at 10% -5%, ${alpha(colors.primary, 0.12)} 0%, transparent 52%), radial-gradient(800px 320px at 92% 5%, ${alpha(colors.primaryLight, 0.07)} 0%, transparent 48%)`,
        bgcolor: "background.default",
        flex: 1,
        minHeight: 0,
        overflowX: "hidden",
        overflowY: "auto",
        overscrollBehavior: "contain",
        p: 5,
      }}
      onFocus={markDetailsActionFocus}
      onBlur={clearDetailsActionFocus}
    >
      <Button
        data-argosy-sound="back"
        startIcon={<ArrowBackIcon />}
        onClick={onBack}
        color="inherit"
        sx={{
          borderRadius: 2,
          fontWeight: 700,
          mb: 3,
          px: 2.5,
          textTransform: "none",
        }}
      >
        Back
      </Button>
      <GameScreenshotsSection
        urls={screenshots}
        getMediaSrc={getMediaSrc}
        isRommGame={props.hasRomm}
      />
      <DetailsPaper colors={colors}>
        <DetailsPanelContent {...props} />
      </DetailsPaper>
    </Box>
  );
};

export default ImmersiveGameDetailsContent;
