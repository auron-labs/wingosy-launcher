import DeleteIcon from "@mui/icons-material/Delete";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import FolderSpecialIcon from "@mui/icons-material/FolderSpecial";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

/** @typedef {{menuAnchor: HTMLElement|null, setMenuAnchor: (anchor: HTMLElement|null) => void, hasRomm: boolean, rommConfigured: boolean, refreshing: boolean, hasLocalFile: boolean, onSaveScroll: () => void, onAddToCollection: () => Promise<void>, onRefreshMetadata: () => Promise<void>, onOpenLocation: () => Promise<void>, onHideGame: () => Promise<void>, onDelete: () => void}} DetailsMenuProps */

/** @param {() => void|Promise<void>} action Async action. @returns {() => void} Event callback. */
const fireAndForget = (action) => () => {
  void action();
};

/** @param {Pick<DetailsMenuProps, "hasRomm"|"rommConfigured"|"onSaveScroll">} props RomM menu properties. */
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
