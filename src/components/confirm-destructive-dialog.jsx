import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";

import KeyboardHint from "./keyboard-hint";

/**
 * The single destructive-action confirmation pattern for the app.
 *
 * Use for irreversible or hard-to-undo actions (delete, disconnect, reset).
 * The confirm action is the dialog's only primary button, styled with the
 * error palette; Cancel remains a secondary text action.
 * @param {{open: boolean, title: string, message: string, confirmLabel: string, onCancel: () => void, onConfirm: () => void}} props Confirmation copy and actions.
 */
const ConfirmDestructiveDialog = ({
  open,
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}) => (
  <Dialog open={open} onClose={onCancel}>
    <DialogTitle>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <span>{title}</span>
        <KeyboardHint>Esc to close</KeyboardHint>
      </Stack>
    </DialogTitle>
    <DialogContent>
      <DialogContentText>{message}</DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button onClick={onCancel}>Cancel</Button>
      <Button onClick={onConfirm} color="error" variant="contained">
        {confirmLabel}
      </Button>
    </DialogActions>
  </Dialog>
);

export default ConfirmDestructiveDialog;
