import TextField from "@mui/material/TextField";

export default function AppVersionField({ value }) {
  return (
    <TextField
      label="App version"
      value={value || "—"}
      slotProps={{ input: { readOnly: true } }}
      helperText="Select this value when reporting a problem."
      size="small"
      sx={{ width: 220, mb: 2 }}
    />
  );
}
