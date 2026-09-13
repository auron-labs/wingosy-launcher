import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import DeleteIcon from "@mui/icons-material/Delete";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SyncIcon from "@mui/icons-material/Sync";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */

const BUTTON_SX = {
  borderRadius: 2,
  fontWeight: 700,
  py: 1.6,
  textTransform: "none",
};

/** @param {() => void|Promise<void>} action Async action. @returns {() => void} Event callback. */
const fireAndForget = (action) => () => {
  void action();
};

/** @param {{primaryActionRef: {current: HTMLButtonElement|null}, downloading: boolean, launchActive: boolean, switchContentSyncing: boolean, handleLaunchGame: () => Promise<void>}} props Play action properties. */
const PlayAction = ({
  primaryActionRef,
  downloading,
  launchActive,
  switchContentSyncing,
  handleLaunchGame,
}) => (
  <Button
    ref={primaryActionRef}
    variant="contained"
    size="large"
    startIcon={<PlayArrowIcon />}
    onClick={fireAndForget(handleLaunchGame)}
    disabled={launchActive || downloading || switchContentSyncing}
    sx={{ ...BUTTON_SX, fontSize: "1.05rem", px: 4 }}
  >
    {launchActive ? "Preparing..." : "Play"}
  </Button>
);

/** @param {{primaryActionRef: {current: HTMLButtonElement|null}, downloading: boolean, switchContentSyncing: boolean, rommConfigured: boolean, handleDownloadRom: () => Promise<void>}} props Download action properties. */
const DownloadAction = ({
  primaryActionRef,
  downloading,
  switchContentSyncing,
  rommConfigured,
  handleDownloadRom,
}) => (
  <Tooltip
    title={
      rommConfigured ? "" : "Connect to RomM server in Settings to download"
    }
    arrow
  >
    <span>
      <Button
        ref={primaryActionRef}
        variant="contained"
        size="large"
        startIcon={downloading ? null : <CloudDownloadIcon />}
        onClick={fireAndForget(handleDownloadRom)}
        disabled={downloading || switchContentSyncing || !rommConfigured}
        sx={{ ...BUTTON_SX, fontSize: "1.05rem", px: 4 }}
      >
        {downloading ? "Downloading..." : "Download"}
      </Button>
    </span>
  </Tooltip>
);

/** @param {{downloading: boolean, switchContentSyncing: boolean, handleDownloadRom: () => Promise<void>}} props Redownload action properties. */
const RedownloadAction = ({
  downloading,
  switchContentSyncing,
  handleDownloadRom,
}) => (
  <Button
    variant="outlined"
    size="large"
    startIcon={downloading ? null : <CloudDownloadIcon />}
    onClick={fireAndForget(handleDownloadRom)}
    disabled={downloading || switchContentSyncing}
    sx={{ ...BUTTON_SX, px: 3 }}
  >
    {downloading ? "Downloading..." : "Re-download"}
  </Button>
);

/** @param {{downloading: boolean, launchActive: boolean, switchContentSyncing: boolean, handleSyncSwitchContent: () => Promise<void>}} props Switch action properties. */
const SwitchContentAction = ({
  downloading,
  launchActive,
  switchContentSyncing,
  handleSyncSwitchContent,
}) => (
  <Button
    variant="outlined"
    size="large"
    startIcon={switchContentSyncing ? null : <SyncIcon />}
    onClick={fireAndForget(handleSyncSwitchContent)}
    disabled={switchContentSyncing || launchActive || downloading}
    sx={{ ...BUTTON_SX, px: 3 }}
  >
    {switchContentSyncing ? "Syncing Updates & DLC…" : "Sync Updates & DLC"}
  </Button>
);

/** @param {{game: ImmersiveGame, onToggleFavorite: (gameId: number|string) => void|Promise<void>}} props Favorite action properties. */
const FavoriteAction = ({ game, onToggleFavorite }) => (
  <Button
    variant="outlined"
    size="large"
    startIcon={
      game.is_favorite === true ? <FavoriteIcon /> : <FavoriteBorderIcon />
    }
    onClick={fireAndForget(async () => {
      await onToggleFavorite(game.id);
    })}
    sx={{ ...BUTTON_SX, fontSize: "1.05rem", px: 4 }}
  >
    {game.is_favorite === true ? "Unfavorite" : "Favorite"}
  </Button>
);

/** @param {{setDeleteDialogOpen: (open: boolean) => void}} props Delete action properties. */
const DeleteAction = ({ setDeleteDialogOpen }) => (
  <Button
    variant="outlined"
    size="large"
    color="error"
    startIcon={<DeleteIcon />}
    onClick={() => {
      setDeleteDialogOpen(true);
    }}
    sx={{ ...BUTTON_SX, px: 3 }}
  >
    Delete
  </Button>
);

/** @param {{primaryActionRef: {current: HTMLButtonElement|null}, canPlay: boolean, hasRomm: boolean, rommConfigured: boolean, hasLocalFile: boolean, canDownload: boolean, canSyncSwitchContent: boolean, downloading: boolean, launchActive: boolean, switchContentSyncing: boolean, handleLaunchGame: () => Promise<void>, handleDownloadRom: () => Promise<void>, handleSyncSwitchContent: () => Promise<void>, game: ImmersiveGame, onToggleFavorite: (gameId: number|string) => void|Promise<void>, setDeleteDialogOpen: (open: boolean) => void}} props Action properties. */
export const DetailsActions = (props) => {
  const {
    canDownload,
    canPlay,
    canSyncSwitchContent,
    downloading,
    game,
    handleDownloadRom,
    handleLaunchGame,
    handleSyncSwitchContent,
    hasLocalFile,
    hasRomm,
    launchActive,
    onToggleFavorite,
    primaryActionRef,
    rommConfigured,
    setDeleteDialogOpen,
    switchContentSyncing,
  } = props;
  return (
    <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
      {canPlay ? (
        <PlayAction
          downloading={downloading}
          handleLaunchGame={handleLaunchGame}
          launchActive={launchActive}
          primaryActionRef={primaryActionRef}
          switchContentSyncing={switchContentSyncing}
        />
      ) : null}
      {hasRomm && !hasLocalFile ? (
        <DownloadAction
          downloading={downloading}
          handleDownloadRom={handleDownloadRom}
          primaryActionRef={primaryActionRef}
          rommConfigured={rommConfigured}
          switchContentSyncing={switchContentSyncing}
        />
      ) : null}
      {canDownload && hasLocalFile ? (
        <RedownloadAction
          downloading={downloading}
          handleDownloadRom={handleDownloadRom}
          switchContentSyncing={switchContentSyncing}
        />
      ) : null}
      {canSyncSwitchContent ? (
        <SwitchContentAction
          downloading={downloading}
          handleSyncSwitchContent={handleSyncSwitchContent}
          launchActive={launchActive}
          switchContentSyncing={switchContentSyncing}
        />
      ) : null}
      <FavoriteAction game={game} onToggleFavorite={onToggleFavorite} />
      {hasLocalFile ? (
        <DeleteAction setDeleteDialogOpen={setDeleteDialogOpen} />
      ) : null}
    </Stack>
  );
};
