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

import ConfirmDestructiveDialog from "../confirm-destructive-dialog";
import SyncStatusChip from "../sync-status-chip";
import StatusChip from "./status-chip";

/** @typedef {import("./game-details-types").GameDetailsGame} GameDetailsGame */
/** @typedef {import("./game-details-types").GameDetailsPlatform} GameDetailsPlatform */
/** @typedef {import("./game-details-types").GameDetailsStatus} GameDetailsStatus */

/** @typedef {{game: GameDetailsGame, hasLocalFile: boolean, menuAnchor: HTMLElement|null, onAddToCollection: () => Promise<void>, onHideGame: () => Promise<void>, onMenuClose: () => void, onOpenLocation: () => Promise<void>, onRefreshMetadata: () => Promise<void>, onRequestDelete: () => void, refreshing: boolean, rommToken: string|null, rommUrl: string|null}} GameDetailsMenuProps */
/** @typedef {{canRefresh: boolean, hasLocalFile: boolean, onAddToCollection: () => Promise<void>, onHideGame: () => Promise<void>, onOpenLocation: () => Promise<void>, onRefreshMetadata: () => Promise<void>, onRequestDelete: () => void, refreshing: boolean}} GameDetailsMenuItemsProps */
/** @typedef {{game: GameDetailsGame, hasLocalFile: boolean, menuAnchor: HTMLElement|null, onAddToCollection: () => Promise<void>, onHideGame: () => Promise<void>, onMenuClose: () => void, onOpenLocation: () => Promise<void>, onOpenMenu: (event: import("react").MouseEvent<HTMLElement>) => void, onRefreshMetadata: () => Promise<void>, onRequestDelete: () => void, onToggleFavorite: (gameId: number|string) => void, refreshing: boolean, rommToken: string|null, rommUrl: string|null}} GameDetailsActionButtonsProps */

/** @param {GameDetailsMenuItemsProps} props Menu item properties. */
const GameDetailsMenuItems = ({
  canRefresh,
  hasLocalFile,
  onAddToCollection,
  onHideGame,
  onOpenLocation,
  onRefreshMetadata,
  onRequestDelete,
  refreshing,
}) => (
  <>
    <MenuItem
      onClick={() => {
        void onAddToCollection();
      }}
    >
      <ListItemIcon>
        <FolderSpecialIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText
        primary="Add to collection"
        secondary="Manual collections"
      />
    </MenuItem>
    {canRefresh && (
      <MenuItem
        disabled={refreshing}
        onClick={() => {
          void onRefreshMetadata();
        }}
      >
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
      <MenuItem
        onClick={() => {
          void onOpenLocation();
        }}
      >
        <ListItemIcon>
          <FolderOpenIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Open ROM Location</ListItemText>
      </MenuItem>
    )}
    <MenuItem
      onClick={() => {
        void onHideGame();
      }}
    >
      <ListItemIcon>
        <VisibilityOffIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText>Hide Game</ListItemText>
    </MenuItem>
  </>
);

/** @param {GameDetailsMenuProps} props Menu properties. */
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
}) => {
  const canRefresh =
    game.romm_id !== null &&
    game.romm_id !== undefined &&
    rommToken !== null &&
    rommToken !== "" &&
    rommUrl !== null &&
    rommUrl !== "";

  return (
    <Menu
      anchorEl={menuAnchor}
      onClose={onMenuClose}
      open={menuAnchor !== null}
    >
      <GameDetailsMenuItems
        canRefresh={canRefresh}
        hasLocalFile={hasLocalFile}
        onAddToCollection={onAddToCollection}
        onHideGame={onHideGame}
        onOpenLocation={onOpenLocation}
        onRefreshMetadata={onRefreshMetadata}
        onRequestDelete={onRequestDelete}
        refreshing={refreshing}
      />
    </Menu>
  );
};

/** @param {{game: GameDetailsGame, platform: GameDetailsPlatform|null, syncStatus: "checking"|"downloaded-not-synced"|"not-configured"|"offline"|"online"|"remote-only"|"synced"|null, showCover: boolean}} props Status properties. */
const GameDetailsStatusChips = ({ game, platform, showCover, syncStatus }) => (
  <>
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
      {syncStatus !== null && <SyncStatusChip status={syncStatus} />}
      {game.genres?.map((genre) => (
        <Chip key={genre} label={genre} size="small" variant="outlined" />
      ))}
    </Box>
  </>
);

/** @param {{game: GameDetailsGame, onToggleFavorite: (gameId: number|string) => void}} props Favorite button properties. */
const GameDetailsFavoriteButton = ({ game, onToggleFavorite }) => {
  const isFavorite = game.is_favorite === true;
  return (
    <Tooltip title={isFavorite ? "Remove favorite" : "Add favorite"}>
      <IconButton
        aria-label={
          isFavorite
            ? `Remove ${game.name} from favorites`
            : `Add ${game.name} to favorites`
        }
        aria-pressed={isFavorite}
        onClick={() => {
          onToggleFavorite(game.id);
        }}
        size="large"
        sx={{ height: 48, ml: 1, width: 48 }}
      >
        {isFavorite ? (
          <FavoriteIcon color="error" fontSize="large" />
        ) : (
          <FavoriteBorderIcon fontSize="large" />
        )}
      </IconButton>
    </Tooltip>
  );
};

/** @param {{game: GameDetailsGame, deleteDialogOpen: boolean, onCancelDelete: () => void, onConfirmDelete: () => Promise<void>}} props Delete dialog properties. */
const GameDetailsDeleteDialog = ({
  deleteDialogOpen,
  game,
  onCancelDelete,
  onConfirmDelete,
}) => (
  <ConfirmDestructiveDialog
    confirmLabel="Delete"
    message={`This will delete the local ROM file for "${game.name}".${
      game.romm_id !== null && game.romm_id !== undefined
        ? " The game will remain in your library (from RomM) and can be re-downloaded."
        : " This will remove the game from your library completely."
    }`}
    onCancel={onCancelDelete}
    onConfirm={() => {
      void onConfirmDelete();
    }}
    open={deleteDialogOpen}
    title="Delete Downloaded ROM?"
  />
);

/** @typedef {{game: GameDetailsGame, showCover: boolean, platform: GameDetailsPlatform|null, syncStatus: "checking"|"downloaded-not-synced"|"not-configured"|"offline"|"online"|"remote-only"|"synced"|null, hasLocalFile: boolean, rommToken: string|null, rommUrl: string|null, refreshing: boolean, menuAnchor: HTMLElement|null, onMenuOpen: (event: import("react").MouseEvent<HTMLElement>) => void, onMenuClose: () => void, onAddToCollection: () => Promise<void>, onRefreshMetadata: () => Promise<void>, onOpenLocation: () => Promise<void>, onHideGame: () => Promise<void>, onRequestDelete: () => void, deleteDialogOpen: boolean, onCancelDelete: () => void, onConfirmDelete: () => Promise<void>, onToggleFavorite: (gameId: number|string) => void, actionStatus: GameDetailsStatus|null, onClearActionStatus: () => void}} GameDetailsControlsHeaderProps */

/** @param {GameDetailsActionButtonsProps} props Action button properties. */
const GameDetailsActionButtons = ({
  game,
  hasLocalFile,
  menuAnchor,
  onAddToCollection,
  onHideGame,
  onMenuClose,
  onOpenLocation,
  onOpenMenu,
  onRefreshMetadata,
  onRequestDelete,
  onToggleFavorite,
  refreshing,
  rommToken,
  rommUrl,
}) => (
  <Box sx={{ alignItems: "center", display: "flex" }}>
    <GameDetailsFavoriteButton
      game={game}
      onToggleFavorite={onToggleFavorite}
    />
    <Tooltip title="More options">
      <IconButton
        aria-label="More options"
        onClick={onOpenMenu}
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
);

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
        <GameDetailsStatusChips
          game={game}
          platform={platform}
          showCover={showCover}
          syncStatus={syncStatus}
        />
      </Box>
      <GameDetailsActionButtons
        game={game}
        hasLocalFile={hasLocalFile}
        menuAnchor={menuAnchor}
        onAddToCollection={onAddToCollection}
        onHideGame={onHideGame}
        onMenuClose={onMenuClose}
        onOpenLocation={onOpenLocation}
        onOpenMenu={onMenuOpen}
        onRefreshMetadata={onRefreshMetadata}
        onRequestDelete={onRequestDelete}
        onToggleFavorite={onToggleFavorite}
        refreshing={refreshing}
        rommToken={rommToken}
        rommUrl={rommUrl}
      />
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
    <GameDetailsDeleteDialog
      deleteDialogOpen={deleteDialogOpen}
      game={game}
      onCancelDelete={onCancelDelete}
      onConfirmDelete={onConfirmDelete}
    />
  </>
);
