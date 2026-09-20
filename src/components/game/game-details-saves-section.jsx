import CloseIcon from "@mui/icons-material/Close";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import RefreshIcon from "@mui/icons-material/Refresh";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import { useEffect, useRef, useState } from "react";

import { formatLastPlayed } from "./game-details-utils";

/** @typedef {import("./game-details-types").GameDetailsGame} GameDetailsGame */
/** @typedef {import("./game-details-types").GameDetailsSave} GameDetailsSave */
/** @typedef {import("./game-details-types").GameDetailsStatus} GameDetailsStatus */
/** @typedef {import("./game-details-types").GameDetailsSwitchPathInfo} GameDetailsSwitchPathInfo */
/** @typedef {import("./game-details-types").GameDetailsSwitchSaveRestoreProtection} GameDetailsSwitchSaveRestoreProtection */

/** @param {GameDetailsSave} save Save history item. */
const getSaveLabel = (save) =>
  !save.slot || save.slot === "autosave" || save.slot === "argosy-latest"
    ? "Current cloud save"
    : "Save backup";

/** @param {GameDetailsSave} save Save history item. */
const getSaveTime = (save) =>
  formatLastPlayed(save.updated_at ?? save.created_at) ?? "Date unavailable";

/** @param {{saveStatus: GameDetailsStatus|null, savesLoading: boolean, syncBusy: boolean, onClearStatus: () => void}} props Save operation status. */
const SaveStatusAlert = ({
  onClearStatus,
  saveStatus,
  savesLoading,
  syncBusy,
}) => {
  if (!saveStatus) return null;
  return (
    <Alert
      action={
        saveStatus.retry ? (
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <Button
              color="inherit"
              disabled={syncBusy || savesLoading}
              onClick={() => void saveStatus.retry?.()}
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
      sx={{ mt: 2 }}
    >
      {saveStatus.message}
    </Alert>
  );
};

/** @param {{pathInfo: GameDetailsSwitchPathInfo|null}} props Switch technical details. */
const SwitchTechnicalDetails = ({ pathInfo }) =>
  pathInfo && (
    <Box component="details" sx={{ color: "text.secondary", mt: 2 }}>
      <Typography
        component="summary"
        sx={{ cursor: "pointer" }}
        variant="caption"
      >
        Technical details
      </Typography>
      <Typography sx={{ mt: 1, overflowWrap: "anywhere" }} variant="caption">
        Title ID: {pathInfo.title_id}
        <br />
        Eden save location: {pathInfo.local_save_path}
      </Typography>
    </Box>
  );

/** @param {{protection: GameDetailsSwitchSaveRestoreProtection, onResumeSwitchSaveNormalSync: () => Promise<void>, switchSyncBusy: boolean}} props Protected revision properties. */
const SwitchRestoreProtectionNotice = ({
  onResumeSwitchSaveNormalSync,
  protection,
  switchSyncBusy,
}) => {
  const revision = protection.selected_revision;
  const metadata = [
    revision.file_name,
    revision.slot,
    revision.updated_at ?? revision.created_at,
  ].filter(Boolean);
  return (
    <Alert
      action={
        <Button
          color="inherit"
          disabled={switchSyncBusy}
          onClick={() => void onResumeSwitchSaveNormalSync()}
          size="small"
        >
          Resume normal sync
        </Button>
      }
      severity="info"
      sx={{ mb: 2 }}
    >
      <Typography component="span" sx={{ fontWeight: 700 }} variant="body2">
        Protected Eden revision
      </Typography>
      <Typography component="span" sx={{ display: "block" }} variant="body2">
        Automatic sync will keep this restored revision until local save
        contents change or you resume normal sync.
      </Typography>
      {metadata.length > 0 && (
        <Typography
          component="span"
          sx={{ display: "block" }}
          variant="caption"
        >
          Selected revision: {metadata.join(" · ")}
        </Typography>
      )}
    </Alert>
  );
};

/** @param {{saves: GameDetailsSave[], onRestore: (save: GameDetailsSave) => void, restoreDisabled: boolean}} props History entries. */
const SaveHistoryList = ({ onRestore, restoreDisabled, saves }) => (
  <List data-testid="cloud-save-history-list" disablePadding>
    {saves.map((save) => (
      <ListItem
        divider
        key={save.id}
        secondaryAction={
          <Button
            disabled={restoreDisabled}
            onClick={() => onRestore(save)}
            size="small"
          >
            Restore…
          </Button>
        }
      >
        <ListItemText
          primary={getSaveLabel(save)}
          secondary={getSaveTime(save)}
        />
      </ListItem>
    ))}
  </List>
);

/** @param {{operationsDisabled: boolean, onCreateBackup: () => Promise<void>, onEnableSaveSync: () => Promise<void>, onListSaves: () => Promise<void>, onSyncCurrentSave: () => Promise<void>, saveSyncEnabled: boolean, savesLoading: boolean}} props Secondary history controls. */
const SaveHistoryControls = ({
  operationsDisabled,
  onCreateBackup,
  onEnableSaveSync,
  onListSaves,
  onSyncCurrentSave,
  saveSyncEnabled,
  savesLoading,
}) => (
  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 }}>
    {!saveSyncEnabled && (
      <Button
        disabled={operationsDisabled}
        onClick={() => void onEnableSaveSync()}
        size="small"
      >
        Enable automatic sync
      </Button>
    )}
    <Button
      disabled={operationsDisabled}
      onClick={() => void onCreateBackup()}
      size="small"
      variant="contained"
    >
      Back up now
    </Button>
    <Button
      disabled={operationsDisabled}
      onClick={() => void onSyncCurrentSave()}
      size="small"
    >
      Sync current save
    </Button>
    <Button
      disabled={savesLoading || operationsDisabled}
      onClick={() => void onListSaves()}
      size="small"
      startIcon={<RefreshIcon />}
    >
      Refresh
    </Button>
  </Box>
);

/** @param {{launchActive: boolean, onCreateBackup: () => Promise<void>, onClearStatus: () => void, onEnableSaveSync: () => Promise<void>, onListSaves: () => Promise<void>, onSyncCurrentSave: () => Promise<void>, open: boolean, saveStatus: GameDetailsStatus|null, saveSyncEnabled: boolean, saves: GameDetailsSave[], savesLoaded: boolean, savesLoading: boolean, switchPathInfo: GameDetailsSwitchPathInfo|null, switchSyncBusy: boolean, onRequestRestore: (save: GameDetailsSave) => void, onClose: () => void}} props Switch save history dialog properties. */
const SwitchSaveHistoryDialog = ({
  launchActive,
  onClearStatus,
  onClose,
  onCreateBackup,
  onEnableSaveSync,
  onListSaves,
  onRequestRestore,
  onSyncCurrentSave,
  open,
  saveStatus,
  saveSyncEnabled,
  saves,
  savesLoaded,
  savesLoading,
  switchPathInfo,
  switchSyncBusy,
}) => {
  const historyLoadAttempted = useRef(false);
  const operationsDisabled = launchActive || switchSyncBusy;
  useEffect(() => {
    if (!open) {
      historyLoadAttempted.current = false;
      return;
    }
    if (
      !switchSyncBusy &&
      !savesLoaded &&
      !savesLoading &&
      !historyLoadAttempted.current
    ) {
      historyLoadAttempted.current = true;
      void onListSaves();
    }
  }, [onListSaves, open, savesLoaded, savesLoading, switchSyncBusy]);
  return (
    <Dialog
      aria-label="Save history"
      fullWidth
      maxWidth="sm"
      onClose={onClose}
      open={open}
    >
      <DialogTitle>Save history</DialogTitle>
      <DialogContent>
        {saveStatus?.conflict ? (
          <Alert severity="warning">
            <Typography variant="subtitle2">Choose a save carefully</Typography>
            <Typography variant="body2">
              Your local and cloud saves both changed. Wingosy cannot safely
              merge them or replace either copy automatically. Choose a specific
              cloud save below only if you want to replace the local one; your
              current local save will be kept first.
            </Typography>
          </Alert>
        ) : (
          <Typography color="text.secondary" variant="body2">
            Restore a saved copy when you need it. Each restore keeps your
            current local save first.
          </Typography>
        )}
        {savesLoading && (
          <Typography color="text.secondary" sx={{ mt: 2 }} variant="body2">
            Loading save history…
          </Typography>
        )}
        {savesLoaded && !savesLoading && saves.length === 0 && (
          <Typography color="text.secondary" sx={{ mt: 2 }} variant="body2">
            No cloud saves yet.
          </Typography>
        )}
        {saves.length > 0 && (
          <SaveHistoryList
            onRestore={onRequestRestore}
            restoreDisabled={operationsDisabled}
            saves={saves}
          />
        )}
        <SaveHistoryControls
          operationsDisabled={operationsDisabled}
          onCreateBackup={onCreateBackup}
          onEnableSaveSync={onEnableSaveSync}
          onListSaves={onListSaves}
          onSyncCurrentSave={onSyncCurrentSave}
          saveSyncEnabled={saveSyncEnabled}
          savesLoading={savesLoading}
        />
        <SwitchTechnicalDetails pathInfo={switchPathInfo} />
        <SaveStatusAlert
          onClearStatus={onClearStatus}
          saveStatus={saveStatus}
          savesLoading={savesLoading}
          syncBusy={switchSyncBusy}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

/** @param {{onCancel: () => void, onConfirm: () => Promise<void>, open: boolean, save: GameDetailsSave|null, syncBusy: boolean}} props Restore confirmation state. */
const RestoreSaveDialog = ({ onCancel, onConfirm, open, save, syncBusy }) => (
  <Dialog aria-label="Restore save" onClose={onCancel} open={open}>
    <DialogTitle>Restore this save?</DialogTitle>
    <DialogContent>
      <Typography variant="body2">
        This will replace the save used by this game on this PC.
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }} variant="body2">
        Your current local save will be backed up first, so it remains
        recoverable.
      </Typography>
      {save && (
        <Typography sx={{ mt: 2 }} variant="body2">
          {getSaveLabel(save)} from {getSaveTime(save)}
        </Typography>
      )}
    </DialogContent>
    <DialogActions>
      <Button disabled={syncBusy} onClick={onCancel}>
        Cancel
      </Button>
      <Button
        disabled={syncBusy}
        onClick={() => void onConfirm()}
        variant="contained"
      >
        Restore save
      </Button>
    </DialogActions>
  </Dialog>
);

/** @param {{saves: GameDetailsSave[], onDownloadSave: (saveId: number) => Promise<void>}} props Non-Switch save list. */
const StandardSaveList = ({ onDownloadSave, saves }) => (
  <List dense sx={{ bgcolor: "rgba(0,0,0,0.15)", borderRadius: 2, mb: 2 }}>
    {saves.map((save) => (
      <ListItem
        key={save.id}
        secondaryAction={
          <IconButton
            edge="end"
            onClick={() => void onDownloadSave(save.id)}
            size="small"
            title="Download save"
          >
            <FileDownloadIcon fontSize="small" />
          </IconButton>
        }
      >
        <ListItemText primary="Cloud save" secondary={getSaveTime(save)} />
      </ListItem>
    ))}
  </List>
);

/** @typedef {{game: GameDetailsGame, isSwitch: boolean, historyOpen: boolean, launchActive: boolean, onCloseHistory: () => void, onClearStatus: () => void, onCreateBackup: () => Promise<void>, onDownloadSave: (saveId: number, retrySlot?: string|null) => Promise<void>, onEnableSaveSync: () => Promise<void>, onListSaves: () => Promise<void>, onSyncCurrentSave: () => Promise<void>, onUploadSave: (retryFilePath?: string|null) => Promise<void>, onResumeSwitchSaveNormalSync: () => Promise<void>, saveStatus: GameDetailsStatus|null, saveSyncEnabled: boolean, saves: GameDetailsSave[], savesLoaded: boolean, savesLoading: boolean, switchPathInfo: GameDetailsSwitchPathInfo|null, switchRestoreProtection: GameDetailsSwitchSaveRestoreProtection|null, switchSyncBusy: boolean}} GameDetailsSavesSectionProps */

/** @param {GameDetailsSavesSectionProps} props Component properties. */
export const GameDetailsSavesSection = ({
  game,
  historyOpen,
  isSwitch,
  launchActive,
  onClearStatus,
  onCloseHistory,
  onCreateBackup,
  onDownloadSave,
  onEnableSaveSync,
  onListSaves,
  onResumeSwitchSaveNormalSync,
  onSyncCurrentSave,
  onUploadSave,
  saveStatus,
  saveSyncEnabled,
  saves,
  savesLoaded,
  savesLoading,
  switchPathInfo,
  switchRestoreProtection,
  switchSyncBusy,
}) => {
  const [restoreSave, setRestoreSave] = useState(
    /** @type {GameDetailsSave|null} */ (null)
  );
  if (game.romm_id === null || game.romm_id === undefined) return null;
  if (isSwitch) {
    const closeRestore = () => setRestoreSave(null);
    const confirmRestore = async () => {
      if (!restoreSave) return;
      await onDownloadSave(restoreSave.id);
      closeRestore();
    };
    return (
      <>
        {switchRestoreProtection !== null && (
          <SwitchRestoreProtectionNotice
            onResumeSwitchSaveNormalSync={onResumeSwitchSaveNormalSync}
            protection={switchRestoreProtection}
            switchSyncBusy={switchSyncBusy}
          />
        )}
        {!historyOpen && (
          <SaveStatusAlert
            onClearStatus={onClearStatus}
            saveStatus={saveStatus}
            savesLoading={savesLoading}
            syncBusy={switchSyncBusy}
          />
        )}
        <SwitchSaveHistoryDialog
          launchActive={launchActive}
          onClearStatus={onClearStatus}
          onClose={onCloseHistory}
          onCreateBackup={onCreateBackup}
          onEnableSaveSync={onEnableSaveSync}
          onListSaves={onListSaves}
          onRequestRestore={setRestoreSave}
          onSyncCurrentSave={onSyncCurrentSave}
          open={historyOpen}
          saveStatus={saveStatus}
          saveSyncEnabled={saveSyncEnabled}
          saves={saves}
          savesLoaded={savesLoaded}
          savesLoading={savesLoading}
          switchPathInfo={switchPathInfo}
          switchSyncBusy={switchSyncBusy}
        />
        <RestoreSaveDialog
          onCancel={closeRestore}
          onConfirm={confirmRestore}
          open={restoreSave !== null}
          save={restoreSave}
          syncBusy={switchSyncBusy}
        />
      </>
    );
  }
  return (
    <>
      <Divider sx={{ my: 3 }} />
      <Typography sx={{ mb: 2 }} variant="h6">
        Saves
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
        <Button
          disabled={savesLoading}
          onClick={() => void onListSaves()}
          size="small"
          variant="outlined"
        >
          {savesLoaded ? "Refresh saves" : "Show saves"}
        </Button>
        <Button
          onClick={() => void onUploadSave()}
          size="small"
          variant="outlined"
        >
          Upload Save
        </Button>
      </Box>
      {savesLoaded && saves.length === 0 && (
        <Typography color="text.secondary" variant="body2">
          No saves found on server.
        </Typography>
      )}
      {saves.length > 0 && (
        <StandardSaveList onDownloadSave={onDownloadSave} saves={saves} />
      )}
      <SaveStatusAlert
        onClearStatus={onClearStatus}
        saveStatus={saveStatus}
        savesLoading={savesLoading}
        syncBusy={switchSyncBusy}
      />
    </>
  );
};
