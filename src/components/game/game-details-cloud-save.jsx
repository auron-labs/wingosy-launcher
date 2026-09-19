import CloudIcon from "@mui/icons-material/Cloud";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import Button from "@mui/material/Button";

/** @param {{onOpenHistory: () => void, saveSyncEnabled: boolean}} props Save history action and global automatic-sync state. */
export const GameDetailsCloudSave = ({ onOpenHistory, saveSyncEnabled }) => (
  <Button
    color="secondary"
    onClick={onOpenHistory}
    size="small"
    startIcon={saveSyncEnabled ? <CloudIcon /> : <CloudOffIcon />}
    sx={{ borderRadius: 3 }}
    title={
      saveSyncEnabled
        ? "Automatic save sync is on"
        : "Automatic save sync is off"
    }
    variant="outlined"
  >
    History
  </Button>
);
