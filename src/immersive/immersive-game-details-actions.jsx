import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SyncIcon from "@mui/icons-material/Sync";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";

import { FocusBrackets } from "./immersive-shell";
import { DetailsMenu } from "./immersive-game-details-sections";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */

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
  <Box sx={{ position: "relative" }}>
    <FocusBrackets active={!launchActive && !downloading} />
    <Button
      ref={primaryActionRef}
      variant="contained"
      size="large"
      startIcon={<PlayArrowIcon />}
      onClick={fireAndForget(handleLaunchGame)}
      disabled={launchActive || downloading || switchContentSyncing}
      sx={{
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.light",
          outlineOffset: 4,
        },
        bgcolor: "primary.main",
        borderRadius: 2.5,
        boxShadow: "0 8px 32px rgba(99, 102, 241, 0.45)",
        fontSize: "1.2rem",
        fontWeight: 800,
        px: 5,
        py: 1.75,
        textTransform: "none",
      }}
    >
      {launchActive ? "Preparing..." : "Play"}
    </Button>
  </Box>
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
        sx={{
          borderRadius: 2.5,
          fontSize: "1.2rem",
          fontWeight: 800,
          px: 5,
          py: 1.75,
          textTransform: "none",
        }}
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
    size="medium"
    startIcon={downloading ? null : <CloudDownloadIcon />}
    onClick={fireAndForget(handleDownloadRom)}
    disabled={downloading || switchContentSyncing}
    sx={{
      borderColor: "rgba(255,255,255,0.22)",
      borderRadius: 2,
      color: "common.white",
      fontWeight: 700,
      textTransform: "none",
    }}
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
    size="medium"
    startIcon={switchContentSyncing ? null : <SyncIcon />}
    onClick={fireAndForget(handleSyncSwitchContent)}
    disabled={switchContentSyncing || launchActive || downloading}
    sx={{
      borderColor: "rgba(255,255,255,0.22)",
      borderRadius: 2,
      color: "common.white",
      fontWeight: 700,
      textTransform: "none",
    }}
  >
    {switchContentSyncing ? "Syncing Updates & DLC…" : "Sync Updates & DLC"}
  </Button>
);

/** @param {{game: ImmersiveGame, onToggleFavorite: (gameId: number|string) => void|Promise<void>}} props Favorite action properties. */
const FavoriteAction = ({ game, onToggleFavorite }) => {
  const favorited = game.is_favorite === true;
  return (
    <Tooltip title={favorited ? "Unfavorite" : "Favorite"} arrow>
      <IconButton
        aria-label={favorited ? "Unfavorite" : "Favorite"}
        onClick={fireAndForget(async () => {
          await onToggleFavorite(game.id);
        })}
        sx={{
          "&:focus-visible": {
            outline: "2px solid",
            outlineColor: "primary.light",
            outlineOffset: 2,
          },
          border: "1px solid rgba(255,255,255,0.22)",
          borderRadius: 2.5,
          color: favorited ? "#f87171" : "primary.light",
          height: 64,
          width: 64,
        }}
      >
        {favorited ? <FavoriteIcon /> : <FavoriteBorderIcon />}
      </IconButton>
    </Tooltip>
  );
};

/** @param {{menuAnchor: HTMLElement|null, setMenuAnchor: (anchor: HTMLElement|null) => void, menuProps: object}} props More action properties. */
const MoreAction = ({ menuAnchor, setMenuAnchor, menuProps }) => (
  <>
    <Tooltip title="More options" arrow>
      <IconButton
        aria-label="More options"
        onClick={(event) => {
          setMenuAnchor(event.currentTarget);
        }}
        sx={{
          "&:focus-visible": {
            outline: "2px solid",
            outlineColor: "primary.light",
            outlineOffset: 2,
          },
          border: "1px solid rgba(255,255,255,0.22)",
          borderRadius: 2.5,
          color: "text.secondary",
          height: 64,
          width: 64,
        }}
      >
        <MoreHorizIcon />
      </IconButton>
    </Tooltip>
    <DetailsMenu
      menuAnchor={menuAnchor}
      setMenuAnchor={setMenuAnchor}
      {...menuProps}
    />
  </>
);

/** @param {{primaryActionRef: {current: HTMLButtonElement|null}, canPlay: boolean, hasRomm: boolean, rommConfigured: boolean, hasLocalFile: boolean, canDownload: boolean, canSyncSwitchContent: boolean, downloading: boolean, launchActive: boolean, switchContentSyncing: boolean, handleLaunchGame: () => Promise<void>, handleDownloadRom: () => Promise<void>, handleSyncSwitchContent: () => Promise<void>, game: ImmersiveGame, onToggleFavorite: (gameId: number|string) => void|Promise<void>, menuAnchor: HTMLElement|null, setMenuAnchor: (anchor: HTMLElement|null) => void, menuProps: object}} props Action properties. */
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
    menuAnchor,
    menuProps,
    onToggleFavorite,
    primaryActionRef,
    rommConfigured,
    setMenuAnchor,
    switchContentSyncing,
  } = props;
  const showPrimary = canPlay || (hasRomm && !hasLocalFile);
  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: "center", flexWrap: "wrap" }}
      >
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
        <FavoriteAction game={game} onToggleFavorite={onToggleFavorite} />
        <MoreAction
          menuAnchor={menuAnchor}
          setMenuAnchor={setMenuAnchor}
          menuProps={menuProps}
        />
      </Stack>
      {showPrimary &&
      (canDownload || canSyncSwitchContent) &&
      hasLocalFile ? (
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
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
        </Stack>
      ) : null}
    </Stack>
  );
};
