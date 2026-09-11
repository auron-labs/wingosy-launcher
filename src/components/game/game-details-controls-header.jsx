import DeleteIcon from "@mui/icons-material/Delete";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import FolderSpecialIcon from "@mui/icons-material/FolderSpecial";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import ConfirmDestructiveDialog from "../ConfirmDestructiveDialog";
import SyncStatusChip from "../SyncStatusChip";
import StatusChip from "./StatusChip";

/** @typedef {import("./game-details-types").GameDetailsGame} GameDetailsGame */
/** @typedef {import("./game-details-types").GameDetailsPlatform} GameDetailsPlatform */
/** @typedef {import("./game-details-types").GameDetailsStatus} GameDetailsStatus */

/** @typedef {{game: GameDetailsGame, showCover: boolean, platform: GameDetailsPlatform|null, syncStatus: string|null, hasLocalFile: boolean, rommToken: string|null, rommUrl: string|null, refreshing: boolean, menuAnchor: HTMLElement|null, onMenuOpen: (event: import("react").MouseEvent<HTMLElement>) => void, onMenuClose: () => void, onAddToCollection: () => Promise<void>, onRefreshMetadata: () => Promise<void>, onOpenLocation: () => Promise<void>, onHideGame: () => Promise<void>, onRequestDelete: () => void, deleteDialogOpen: boolean, onCancelDelete: () => void, onConfirmDelete: () => Promise<void>, onToggleFavorite: (gameId: number|string) => void, actionStatus: GameDetailsStatus|null, onClearActionStatus: () => void}} GameDetailsControlsHeaderProps */

/** @param {GameDetailsControlsHeaderProps} props Component properties. */
export const GameDetailsControlsHeader = ({
  actionStatus,
  deleteDialogOpen,
  game,
  hasLocalFile,
  menuAnchor,
  onAddToCollection,
  onCancelDelete,
  onClearActionStatus,
  onConfirmDelete,
  onHideGame,
  onMenuClose,
  onMenuOpen,
  onOpenLocation,
  onRefreshMetadata,
  onRequestDelete,
  onToggleFavorite,
  platform,
  refreshing,
  rommToken,
  rommUrl,
  showCover,
  syncStatus,
}) => (
  <>
    <Box
      sx={{
        alignItems: "flex-start",
        display: "flex",
        justifyContent: "space-between",
      }}
    >
      <Box sx={{ flex: 1 }}>
        {!showCover && (
          <Typography gutterBottom variant="h4">
            {game.name}
          </Typography>
        )}
        <Box
          data-testid="game-status-chips"
          sx={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
            mb: 3,
          }}
        >
          <StatusChip label={platform?.name ?? game.platform_id} />
          {game.source === "RomM" && <StatusChip label="RomM" />}
          {syncStatus && <SyncStatusChip status={syncStatus} />}
          {game.genres?.map((genre) => (
            <Chip key={genre} label={genre} size="small" variant="outlined" />
          ))}
        </Box>
      </Box>
      <Box sx={{ alignItems: "center", display: "flex" }}>
        <Tooltip title={game.is_favorite ? "Remove favorite" : "Add favorite"}>
          <IconButton
            aria-label={
              game.is_favorite
                ? `Remove ${game.name} from favorites`
                : `Add ${game.name} to favorites`
            }
            aria-pressed={Boolean(game.is_favorite)}
            onClick={() => {
              onToggleFavorite(game.id);
            }}
            size="large"
            sx={{ height: 48, ml: 1, width: 48 }}
          >
            {game.is_favorite ? (
              <FavoriteIcon color="error" fontSize="large" />
            ) : (
              <FavoriteBorderIcon fontSize="large" />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title="More options">
          <IconButton
            aria-label="More options"
            onClick={onMenuOpen}
            size="large"
            sx={{ height: 48, width: 48 }}
          >
            <MoreVertIcon fontSize="large" />
          </IconButton>
        </Tooltip>
        <GameDetailsMenu
          game={game}
          hasLocalFile={hasLocalFile}
          menuAnchor={menuAnchor}
          onAddToCollection={onAddToCollection}
          onHideGame={onHideGame}
          onMenuClose={onMenuClose}
          onOpenLocation={onOpenLocation}
          onRefreshMetadata={onRefreshMetadata}
          onRequestDelete={onRequestDelete}
          refreshing={refreshing}
          rommToken={rommToken}
          rommUrl={rommUrl}
        />
      </Box>
    </Box>
    {actionStatus && (
      <Alert
        onClose={onClearActionStatus}
        severity={actionStatus.type}
        sx={{ mb: 2 }}
      >
        {actionStatus.message}
      </Alert>
    )}
    <ConfirmDestructiveDialog
      confirmLabel="Delete"
      message={`This will delete the local ROM file for "${game.name}".${
        game.romm_id
          ? " The game will remain in your library (from RomM) and can be re-downloaded."
          : " This will remove the game from your library completely."
      }`}
      onCancel={onCancelDelete}
      onConfirm={onConfirmDelete}
      open={deleteDialogOpen}
      title="Delete Downloaded ROM?"
    />
  </>
);

/** @param {{game: GameDetailsGame, hasLocalFile: boolean, menuAnchor: HTMLElement|null, onAddToCollection: () => Promise<void>, onHideGame: () => Promise<void>, onMenuClose: () => void, onOpenLocation: () => Promise<void>, onRefreshMetadata: () => Promise<void>, onRequestDelete: () => void, refreshing: boolean, rommToken: string|null, rommUrl: string|null}} props Menu properties. */
const GameDetailsMenu = ({
  game,
  hasLocalFile,
  menuAnchor,
  onAddToCollection,
  onHideGame,
  onMenuClose,
  onOpenLocation,
  onRefreshMetadata,
  onRequestDelete,
  refreshing,
  rommToken,
  rommUrl,
}) => (
  <Menu anchorEl={menuAnchor} onClose={onMenuClose} open={Boolean(menuAnchor)}>
    <MenuItem onClick={() => void onAddToCollection()}>
      <ListItemIcon>
        <FolderSpecialIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText
        primary="Add to collection"
        secondary="Manual collections"
      />
    </MenuItem>
    {game.romm_id && rommToken && rommUrl && (
      <MenuItem disabled={refreshing} onClick={() => void onRefreshMetadata()}>
        <ListItemIcon>
          <RefreshIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={refreshing ? "Refreshing..." : "Refresh game data"}
          secondary="From RomM"
        />
      </MenuItem>
    )}
    {hasLocalFile && <Divider />}
    {hasLocalFile && (
      <MenuItem onClick={onRequestDelete} sx={{ color: "error.main" }}>
        <ListItemIcon>
          <DeleteIcon color="error" fontSize="small" />
        </ListItemIcon>
        <ListItemText>Delete Download</ListItemText>
      </MenuItem>
    )}
    {hasLocalFile && <Divider />}
    {hasLocalFile && (
      <MenuItem onClick={() => void onOpenLocation()}>
        <ListItemIcon>
          <FolderOpenIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Open ROM Location</ListItemText>
      </MenuItem>
    )}
    <MenuItem onClick={() => void onHideGame()}>
      <ListItemIcon>
        <VisibilityOffIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText>Hide Game</ListItemText>
    </MenuItem>
  </Menu>
);
