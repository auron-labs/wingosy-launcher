import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";

/** @typedef {{canInstall: boolean, channel: "stable"|"beta"|"nightly", installing: boolean, open: boolean, progressLabel: string, url: string, version: string}} UpdateSnack */

/** @param {{messages: string[], onClose: () => void}} props Save notification properties. */
const SaveSyncSnackbar = ({ messages, onClose }) => (
  <Snackbar
    open={messages.length > 0}
    autoHideDuration={7000}
    onClose={onClose}
    message={messages.join("\n")}
    anchorOrigin={{ horizontal: "left", vertical: "bottom" }}
  />
);

/** @param {{snack: UpdateSnack, onClose: () => void, onInstall: () => void, onOpenRelease: () => void}} props Update notification properties. */
const UpdateSnackbar = ({ snack, onClose, onInstall, onOpenRelease }) => (
  <Snackbar
    open={snack.open}
    onClose={onClose}
    message={
      <span>
        {snack.version
          ? `Update available: ${snack.version}`
          : "Update available"}
        {snack.installing && snack.progressLabel
          ? ` — ${snack.progressLabel}`
          : ""}
      </span>
    }
    action={
      <Box sx={{ display: "flex", gap: 1 }}>
        {snack.canInstall ? (
          <Button
            color="inherit"
            size="small"
            disabled={snack.installing}
            onClick={onInstall}
          >
            {snack.installing ? "Installing…" : "Download & install"}
          </Button>
        ) : null}
        <Button
          color="inherit"
          size="small"
          disabled={snack.installing}
          onClick={onOpenRelease}
        >
          View release
        </Button>
        <Button
          color="inherit"
          size="small"
          disabled={snack.installing}
          onClick={onClose}
        >
          Dismiss
        </Button>
      </Box>
    }
    anchorOrigin={{ horizontal: "center", vertical: "bottom" }}
  />
);

/** @param {{messages: string[], onCloseMessages: () => void, snack: UpdateSnack, onCloseUpdate: () => void, onInstallUpdate: () => void, onOpenRelease: () => void}} props Notification properties. */
const AppNotifications = ({
  messages,
  onCloseMessages,
  snack,
  onCloseUpdate,
  onInstallUpdate,
  onOpenRelease,
}) => (
  <>
    <SaveSyncSnackbar messages={messages} onClose={onCloseMessages} />
    <UpdateSnackbar
      snack={snack}
      onClose={onCloseUpdate}
      onInstall={onInstallUpdate}
      onOpenRelease={onOpenRelease}
    />
  </>
);

export default AppNotifications;
