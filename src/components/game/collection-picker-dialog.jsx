import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import KeyboardHint from "../keyboard-hint";

/** @type {Array<{id: number, name: string, is_smart?: boolean}>} */
const EMPTY_COLLECTIONS = [];

/** @param {{open: boolean, onClose: () => void, collections?: Array<{id: number, name: string, is_smart?: boolean}>, onPick: (id: number) => void, gameName: string}} props Collection picker properties. */
const CollectionPickerDialog = ({
  open,
  onClose,
  collections = EMPTY_COLLECTIONS,
  onPick,
  gameName,
}) => {
  const manual = collections.filter((c) => c.is_smart !== true);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <span>Add to collection</span>
          <KeyboardHint>Esc to close</KeyboardHint>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose a collection for <strong>{gameName}</strong>. Smart collections
          are managed automatically.
        </Typography>
        {manual.length === 0 ? (
          <Typography color="text.secondary">
            Create a manual collection in the library first.
          </Typography>
        ) : (
          <List dense>
            {manual.map((c) => (
              <ListItemButton
                key={c.id}
                onClick={() => {
                  onPick(c.id);
                  onClose();
                }}
              >
                <ListItemText primary={c.name} />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CollectionPickerDialog;
