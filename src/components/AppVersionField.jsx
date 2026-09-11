import TextField from "@mui/material/TextField";

/** @param {{value?: string|null}} props Installed app version. */
const AppVersionField = ({ value }) => (
  <TextField
    label="App version"
    value={(value ?? "") || "—"}
    slotProps={{ input: { readOnly: true } }}
    helperText="Select this value when reporting a problem."
    size="small"
    sx={{ mb: 2, width: 220 }}
  />
);

export default AppVersionField;
