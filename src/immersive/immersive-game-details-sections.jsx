import DeleteIcon from "@mui/icons-material/Delete";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import FolderSpecialIcon from "@mui/icons-material/FolderSpecial";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import GameAchievementsSection from "../components/game/game-achievements-section";
import { formatDownloadLabel } from "../rom-downloads-format";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {{downloaded?: number|null, total?: number|null, percent?: number|null, stage?: string, file_index?: number|null, total_files?: number|null}} DownloadProgress */
/** @typedef {{message: string, type: "error"|"info"|"success"}} DetailsStatus */

/** @param {() => void|Promise<void>} action Async action. @returns {() => void} Event callback. */
const fireAndForget = (action) => () => {
  void action();
};

/** @param {unknown} value Candidate value. @returns {boolean} Whether the value contains text. */
const hasText = (value) =>
  value !== null && value !== undefined && value !== "";

/** @param {DownloadProgress|null} progress Download progress. @returns {boolean} Whether a determinate value is available. */
const hasProgressPercent = (progress) =>
  progress?.percent !== null && progress?.percent !== undefined;

/** @param {DownloadProgress|null} progress Switch progress. @returns {string} Progress label. */
const getSwitchStageLabel = (progress) => {
  if (progress?.stage === "registering") {
    return "Registering content with Eden…";
  }
  if (progress?.stage === "reusing") {
    return "Reusing unchanged content…";
  }
  return "Downloading Switch content…";
};

/** @param {DownloadProgress|null} progress Switch progress. @returns {string} Optional file count label. */
const getFileProgressLabel = (progress) => {
  if (
    progress?.file_index === null ||
    progress?.file_index === undefined ||
    progress.total_files === null ||
    progress.total_files === undefined
  ) {
    return "";
  }
  return ` (${progress.file_index}/${progress.total_files})`;
};

/** @typedef {{menuAnchor: HTMLElement|null, setMenuAnchor: (anchor: HTMLElement|null) => void, hasRomm: boolean, rommConfigured: boolean, refreshing: boolean, hasLocalFile: boolean, onSaveScroll: () => void, onAddToCollection: () => Promise<void>, onRefreshMetadata: () => Promise<void>, onOpenLocation: () => Promise<void>, onHideGame: () => Promise<void>, onDelete: () => void}} DetailsMenuProps */

/** @param {Pick<DetailsMenuProps, "hasRomm"|"rommConfigured"|"refreshing"|"onSaveScroll"|"onRefreshMetadata">} props RomM menu properties. */
const RommMenuItems = ({ hasRomm, rommConfigured, onSaveScroll }) => {
  if (!hasRomm || !rommConfigured) {
    return null;
  }
  return (
    <MenuItem onClick={onSaveScroll}>
      <ListItemIcon>
        <SaveIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText
        primary="Manage cached saves"
        secondary="RomM cloud saves"
        slotProps={{ secondary: { variant: "caption" } }}
      />
    </MenuItem>
  );
};

/** @param {Pick<DetailsMenuProps, "rommConfigured"|"refreshing"|"onRefreshMetadata">} props Refresh menu properties. */
const RommRefreshMenuItem = ({
  refreshing,
  rommConfigured,
  onRefreshMetadata,
}) => {
  if (!rommConfigured) {
    return null;
  }
  return (
    <MenuItem onClick={fireAndForget(onRefreshMetadata)} disabled={refreshing}>
      <ListItemIcon>
        <RefreshIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText
        primary={refreshing ? "Refreshing..." : "Refresh game data"}
        secondary="From RomM"
        slotProps={{ secondary: { variant: "caption" } }}
      />
    </MenuItem>
  );
};

/** @param {Pick<DetailsMenuProps, "hasLocalFile"|"onOpenLocation"|"onHideGame"|"onDelete">} props Local menu properties. */
const LocalMenuItems = ({
  hasLocalFile,
  onOpenLocation,
  onHideGame,
  onDelete,
}) => (
  <>
    {hasLocalFile ? (
      <MenuItem onClick={fireAndForget(onOpenLocation)}>
        <ListItemIcon>
          <FolderOpenIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Open ROM Location" />
      </MenuItem>
    ) : null}
    <MenuItem onClick={fireAndForget(onHideGame)}>
      <ListItemIcon>
        <VisibilityOffIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText primary="Hide Game" />
    </MenuItem>
    {hasLocalFile ? (
      <MenuItem onClick={onDelete} sx={{ color: "error.main" }}>
        <ListItemIcon>
          <DeleteIcon fontSize="small" color="error" />
        </ListItemIcon>
        <ListItemText primary="Delete Download" />
      </MenuItem>
    ) : null}
  </>
);

/** @param {DetailsMenuProps} props Menu properties. */
export const DetailsMenu = ({
  menuAnchor,
  setMenuAnchor,
  onAddToCollection,
  ...props
}) => {
  const closeMenu = () => {
    setMenuAnchor(null);
  };
  return (
    <Menu anchorEl={menuAnchor} open={menuAnchor !== null} onClose={closeMenu}>
      <RommMenuItems {...props} />
      <MenuItem onClick={fireAndForget(onAddToCollection)}>
        <ListItemIcon>
          <FolderSpecialIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary="Add to collection"
          secondary="Manual collections"
          slotProps={{ secondary: { variant: "caption" } }}
        />
      </MenuItem>
      <RommRefreshMenuItem {...props} />
      <Divider />
      <LocalMenuItems {...props} />
    </Menu>
  );
};

/** @param {{game: ImmersiveGame, platformLabel?: string|null}} props Badge properties. */
const DetailsBadges = ({ game, platformLabel }) => (
  <Stack
    direction="row"
    spacing={2}
    sx={{ alignItems: "center", flexWrap: "wrap" }}
  >
    {hasText(platformLabel) ? (
      <Chip
        label={platformLabel}
        sx={{
          bgcolor: "rgba(255,255,255,0.08)",
          color: "#fff",
          fontWeight: 900,
        }}
      />
    ) : null}
    {game.is_favorite === true ? (
      <Chip
        label="Favorite"
        sx={{
          bgcolor: "rgba(239,68,68,0.18)",
          color: "#fff",
          fontWeight: 900,
        }}
      />
    ) : null}
  </Stack>
);

/** @param {{game: ImmersiveGame, platformLabel?: string|null, setMenuAnchor: (anchor: HTMLElement|null) => void, menuAnchor: HTMLElement|null, menuProps: Omit<DetailsMenuProps, "menuAnchor"|"setMenuAnchor">}} props Summary header properties. */
const DetailsSummaryHeader = ({
  game,
  platformLabel,
  setMenuAnchor,
  menuAnchor,
  menuProps,
}) => (
  <Stack
    direction="row"
    spacing={2}
    sx={{
      alignItems: "center",
      flexWrap: "wrap",
      justifyContent: "space-between",
      mb: 2,
    }}
  >
    <DetailsBadges game={game} platformLabel={platformLabel} />
    <IconButton
      color="inherit"
      aria-label="More options"
      onClick={(event) => {
        setMenuAnchor(event.currentTarget);
      }}
    >
      <MoreVertIcon />
    </IconButton>
    <DetailsMenu
      menuAnchor={menuAnchor}
      setMenuAnchor={setMenuAnchor}
      {...menuProps}
    />
  </Stack>
);

/** @param {{game: ImmersiveGame, platformLabel?: string|null, retroachievementsEnabled: boolean, onOpenIntegrations: (() => void)|null, setMenuAnchor: (anchor: HTMLElement|null) => void, menuAnchor: HTMLElement|null, menuProps: Omit<DetailsMenuProps, "menuAnchor"|"setMenuAnchor">}} props Summary properties. */
export const DetailsSummary = (props) => {
  const { game, retroachievementsEnabled, onOpenIntegrations } = props;
  return (
    <>
      <DetailsSummaryHeader {...props} />
      <Typography
        variant="h3"
        sx={{
          color: "text.primary",
          fontWeight: 800,
          letterSpacing: "-0.5px",
          mb: 1,
        }}
      >
        {game.name}
      </Typography>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ lineHeight: 1.8, maxWidth: 1100 }}
      >
        {game.summary ?? "No description available."}
      </Typography>
      <Divider sx={{ my: 3, opacity: 0.12 }} />
      <GameAchievementsSection
        gameName={game.name}
        retroAchievementsEnabled={retroachievementsEnabled}
        onOpenIntegrations={onOpenIntegrations}
      />
      <Divider sx={{ my: 3, opacity: 0.12 }} />
    </>
  );
};

/** @param {{downloading: boolean, romDl: DownloadProgress|null, downloadStatus: DetailsStatus|null, setDownloadStatus: (status: DetailsStatus|null) => void, actionStatus: DetailsStatus|null, setActionStatus: (status: DetailsStatus|null) => void, switchContentSyncing: boolean, switchContentProgress: DownloadProgress|null}} props Status properties. */
export const DetailsStatusArea = ({
  downloading,
  romDl,
  downloadStatus,
  setDownloadStatus,
  actionStatus,
  setActionStatus,
  switchContentSyncing,
  switchContentProgress,
}) => (
  <>
    {downloading ? (
      <Box sx={{ mb: 2 }}>
        <LinearProgress
          variant={hasProgressPercent(romDl) ? "determinate" : "indeterminate"}
          value={romDl?.percent ?? undefined}
          sx={{ borderRadius: 2 }}
        />
        {romDl ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 0.5 }}
          >
            {formatDownloadLabel(romDl)}
          </Typography>
        ) : null}
      </Box>
    ) : null}
    {downloadStatus ? (
      <Alert
        severity={downloadStatus.type}
        sx={{ mb: 2 }}
        onClose={() => {
          setDownloadStatus(null);
        }}
      >
        {downloadStatus.message}
      </Alert>
    ) : null}
    {actionStatus ? (
      <Alert
        severity={actionStatus.type}
        sx={{ mb: 2 }}
        onClose={() => {
          setActionStatus(null);
        }}
      >
        {actionStatus.message}
      </Alert>
    ) : null}
    {switchContentSyncing ? (
      <Box sx={{ mb: 2 }} data-testid="switch-content-sync-progress">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {getSwitchStageLabel(switchContentProgress)}
          {getFileProgressLabel(switchContentProgress)}
        </Typography>
        <LinearProgress
          variant={
            hasProgressPercent(switchContentProgress)
              ? "determinate"
              : "indeterminate"
          }
          value={switchContentProgress?.percent ?? undefined}
          sx={{ borderRadius: 2 }}
        />
        {switchContentProgress?.downloaded !== null &&
        switchContentProgress?.downloaded !== undefined ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 0.5 }}
          >
            {formatDownloadLabel(switchContentProgress)}
          </Typography>
        ) : null}
      </Box>
    ) : null}
  </>
);
