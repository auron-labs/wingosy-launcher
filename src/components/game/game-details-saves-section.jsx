import CloseIcon from "@mui/icons-material/Close";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import SaveIcon from "@mui/icons-material/Save";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

/** @typedef {import("./game-details-types").GameDetailsGame} GameDetailsGame */
/** @typedef {import("./game-details-types").GameDetailsSave} GameDetailsSave */
/** @typedef {import("./game-details-types").GameDetailsStatus} GameDetailsStatus */
/** @typedef {import("./game-details-types").GameDetailsSwitchPathInfo} GameDetailsSwitchPathInfo */

/** @param {{pathInfo: GameDetailsSwitchPathInfo|null}} props Save context properties. */
const SwitchSaveContext = ({ pathInfo }) => (
  <>
    <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
      Eden / Argosy-compatible sync: zips the title save folder to RomM. Use
      named slots for separate backups (e.g. before a boss, different
      playthroughs). In-game Zelda slots share one folder — use different RomM
      slot names for separate exports.
    </Typography>
    {pathInfo && (
      <Typography
        color="text.secondary"
        sx={{ display: "block", mb: 2 }}
        variant="caption"
      >
        Title ID: {pathInfo.title_id} · Eden path: {pathInfo.local_save_path}
      </Typography>
    )}
  </>
);

/** @param {boolean} savesLoading Whether save loading is active. @param {boolean} savesLoaded Whether saves have been listed. */
const getSaveListLabel = (savesLoading, savesLoaded) => {
  if (savesLoading) {
    return "Loading...";
  }
  return savesLoaded ? "Refresh Saves" : "List Saves";
};

/**
 * @param {{isSwitch: boolean, savesLoaded: boolean, savesLoading: boolean, switchSyncBusy: boolean, onListSaves: () => Promise<void>, onUploadSwitchSave: () => Promise<void>, onDownloadSwitchSave: () => Promise<void>, onUploadSave: () => Promise<void>}} props Save actions and state.
 */
const SaveControls = ({
  isSwitch,
  onDownloadSwitchSave,
  onListSaves,
  onUploadSave,
  onUploadSwitchSave,
  savesLoaded,
  savesLoading,
  switchSyncBusy,
}) => (
  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 2 }}>
    <Button
      disabled={savesLoading}
      onClick={() => {
        void onListSaves();
      }}
      size="small"
      variant="outlined"
    >
      {getSaveListLabel(savesLoading, savesLoaded)}
    </Button>
    {isSwitch ? (
      <>
        <Button
          disabled={switchSyncBusy}
          onClick={() => {
            void onUploadSwitchSave();
          }}
          size="small"
          startIcon={<UploadFileIcon />}
          variant="outlined"
        >
          Sync to RomM
        </Button>
        <Button
          disabled={switchSyncBusy}
          onClick={() => {
            void onDownloadSwitchSave();
          }}
          size="small"
          startIcon={<FileDownloadIcon />}
          variant="outlined"
        >
          Restore from RomM
        </Button>
      </>
    ) : (
      <Button
        onClick={() => {
          void onUploadSave();
        }}
        size="small"
        startIcon={<UploadFileIcon />}
        variant="outlined"
      >
        Upload Save
      </Button>
    )}
  </Box>
);

/** @param {{saves: GameDetailsSave[], onDownloadSave: (saveId: number, retrySlot?: string|null) => Promise<void>}} props Save list properties. */
const SaveList = ({ onDownloadSave, saves }) => (
  <List dense sx={{ bgcolor: "rgba(0,0,0,0.15)", borderRadius: 2, mb: 2 }}>
    {saves.map((save) => (
      <ListItem
        key={save.id}
        secondaryAction={
          <IconButton
            edge="end"
            onClick={() => {
              void onDownloadSave(save.id);
            }}
            size="small"
            title="Download save"
          >
            <FileDownloadIcon fontSize="small" />
          </IconButton>
        }
      >
        <ListItemText
          primary={save.file_name}
          secondary={
            [save.slot, save.updated_at ?? save.created_at]
              .filter(Boolean)
              .join(" · ") || null
          }
        />
      </ListItem>
    ))}
  </List>
);

/** @param {{saveStatus: GameDetailsStatus|null, savesLoading: boolean, switchSyncBusy: boolean, onClearStatus: () => void}} props Save status properties. */
const SaveStatusAlert = ({
  onClearStatus,
  saveStatus,
  savesLoading,
  switchSyncBusy,
}) => {
  if (!saveStatus) {
    return null;
  }
  return (
    <Alert
      action={
        saveStatus.retry ? (
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <Button
              color="inherit"
              disabled={switchSyncBusy || savesLoading}
              onClick={() => {
                void saveStatus.retry?.();
              }}
              size="small"
            >
              Retry
            </Button>
            <IconButton
              aria-label="Close"
              color="inherit"
              onClick={onClearStatus}
              size="small"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        ) : undefined
      }
      onClose={onClearStatus}
      severity={saveStatus.type}
      sx={{ mt: 1 }}
    >
      {saveStatus.message}
    </Alert>
  );
};

/** @typedef {{game: GameDetailsGame, isSwitch: boolean, rommToken: string|null, rommUrl: string|null, saves: GameDetailsSave[], savesLoaded: boolean, savesLoading: boolean, saveStatus: GameDetailsStatus|null, switchSlot: string, setSwitchSlot: (value: string) => void, switchPathInfo: GameDetailsSwitchPathInfo|null, switchSyncBusy: boolean, onListSaves: () => Promise<void>, onUploadSwitchSave: (retrySlot?: string|null) => Promise<void>, onDownloadSwitchSave: (retrySlot?: string|null) => Promise<void>, onUploadSave: (retryFilePath?: string|null) => Promise<void>, onDownloadSave: (saveId: number, retrySlot?: string|null) => Promise<void>, onClearStatus: () => void}} GameDetailsSavesSectionProps */

/** @param {GameDetailsSavesSectionProps} props Component properties. */
export const GameDetailsSavesSection = ({
  game,
  isSwitch,
  onClearStatus,
  onDownloadSave,
  onDownloadSwitchSave,
  onListSaves,
  onUploadSave,
  onUploadSwitchSave,
  saveStatus,
  saves,
  savesLoaded,
  savesLoading,
  setSwitchSlot,
  switchPathInfo,
  switchSlot,
  switchSyncBusy,
}) => {
  if (game.romm_id === null || game.romm_id === undefined) {
    return null;
  }
  return (
    <>
      <Divider sx={{ my: 3 }} />
      <Box sx={{ alignItems: "center", display: "flex", gap: 1, mb: 2 }}>
        <SaveIcon color="primary" />
        <Typography variant="h6">Saves</Typography>
      </Box>
      {isSwitch && <SwitchSaveContext pathInfo={switchPathInfo} />}
      {isSwitch && (
        <TextField
          fullWidth
          helperText='Default "autosave" matches Argosy latest-save sync; older "argosy-latest" saves still restore.'
          label="RomM slot (channel)"
          onChange={(event) => {
            setSwitchSlot(event.target.value);
          }}
          size="small"
          sx={{ maxWidth: 360, mb: 2 }}
          value={switchSlot}
        />
      )}
      <SaveControls
        isSwitch={isSwitch}
        onDownloadSwitchSave={onDownloadSwitchSave}
        onListSaves={onListSaves}
        onUploadSave={onUploadSave}
        onUploadSwitchSave={onUploadSwitchSave}
        savesLoaded={savesLoaded}
        savesLoading={savesLoading}
        switchSyncBusy={switchSyncBusy}
      />
      {savesLoaded && saves.length === 0 && (
        <Typography color="text.secondary" variant="body2">
          No saves found on server.
        </Typography>
      )}
      {saves.length > 0 && (
        <SaveList onDownloadSave={onDownloadSave} saves={saves} />
      )}
      <SaveStatusAlert
        onClearStatus={onClearStatus}
        saveStatus={saveStatus}
        savesLoading={savesLoading}
        switchSyncBusy={switchSyncBusy}
      />
    </>
  );
};
