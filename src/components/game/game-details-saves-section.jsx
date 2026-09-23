import FileDownloadIcon from "@mui/icons-material/FileDownload";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import { useState } from "react";

import {
  RestoreSaveDialog,
  SaveStatusAlert,
  SwitchRestoreProtectionNotice,
  SwitchSaveHistoryDialog,
} from "./game-details-save-history";
import { getSaveTime } from "./game-details-utils";

/** @typedef {import("./game-details-types").GameDetailsGame} GameDetailsGame */
/** @typedef {import("./game-details-types").GameDetailsSave} GameDetailsSave */
/** @typedef {import("./game-details-types").GameDetailsStatus} GameDetailsStatus */
/** @typedef {import("./game-details-types").GameDetailsSwitchPathInfo} GameDetailsSwitchPathInfo */
/** @typedef {import("./game-details-types").GameDetailsSwitchSaveRestoreProtection} GameDetailsSwitchSaveRestoreProtection */

/** @param {{saves: GameDetailsSave[], onDownloadSave: (saveId: number) => Promise<void>}} props Non-Switch save list. */
const StandardSaveList = ({ onDownloadSave, saves }) => (
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
        <ListItemText primary="Cloud save" secondary={getSaveTime(save)} />
      </ListItem>
    ))}
  </List>
);

/** @typedef {{game: GameDetailsGame, isSwitch: boolean, historyOpen: boolean, launchActive: boolean, onCloseHistory: () => void, onClearStatus: () => void, onCreateBackup: () => Promise<void>, onDownloadSave: (saveId: number, retrySlot?: string|null) => Promise<void>, onEnableSaveSync: () => Promise<void>, onListSaves: () => Promise<void>, onSyncCurrentSave: () => Promise<void>, onUploadSave: (retryFilePath?: string|null) => Promise<void>, onResumeSwitchSaveNormalSync: () => Promise<void>, saveStatus: GameDetailsStatus|null, saveSyncEnabled: boolean, saves: GameDetailsSave[], savesLoaded: boolean, savesLoading: boolean, switchPathInfo: GameDetailsSwitchPathInfo|null, switchRestoreProtection: GameDetailsSwitchSaveRestoreProtection|null, switchSyncBusy: boolean}} GameDetailsSavesSectionProps */

/** @returns {GameDetailsSave|null} No pending restore selection. */
const getInitialRestoreSave = () => null;

/** @param {Omit<GameDetailsSavesSectionProps, "game" | "isSwitch">} props Switch save section properties. */
const SwitchSavesSection = ({
  historyOpen,
  launchActive,
  onClearStatus,
  onCloseHistory,
  onCreateBackup,
  onDownloadSave,
  onEnableSaveSync,
  onListSaves,
  onResumeSwitchSaveNormalSync,
  onSyncCurrentSave,
  saveStatus,
  saveSyncEnabled,
  saves,
  savesLoaded,
  savesLoading,
  switchPathInfo,
  switchRestoreProtection,
  switchSyncBusy,
}) => {
  const [restoreSave, setRestoreSave] = useState(getInitialRestoreSave);
  const closeRestore = () => {
    setRestoreSave(null);
  };
  const confirmRestore = async () => {
    if (!restoreSave) {
      return;
    }
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
};

/** @param {GameDetailsSavesSectionProps} props Component properties. */
export const GameDetailsSavesSection = (props) => {
  const {
    game,
    isSwitch,
    onClearStatus,
    onDownloadSave,
    onListSaves,
    onUploadSave,
    saveStatus,
    saves,
    savesLoaded,
    savesLoading,
    switchSyncBusy,
  } = props;
  if (game.romm_id === null || game.romm_id === undefined) {
    return null;
  }
  if (isSwitch) {
    return <SwitchSavesSection {...props} />;
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
          onClick={() => {
            void onListSaves();
          }}
          size="small"
          variant="outlined"
        >
          {savesLoaded ? "Refresh saves" : "Show saves"}
        </Button>
        <Button
          onClick={() => {
            void onUploadSave();
          }}
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
