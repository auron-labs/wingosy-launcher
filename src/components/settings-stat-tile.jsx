import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

/**
 * @param {{children?: import("react").ReactNode, label: string, testId?: string, value?: string|number}} props Settings stat tile properties.
 * @returns {import("react").ReactNode} A compact labeled value tile.
 */
const SettingsStatTile = ({ children, label, testId, value }) => (
  <Paper sx={{ bgcolor: "action.hover", p: 1.5 }} variant="outlined">
    <Typography
      color="text.secondary"
      sx={{ display: "block" }}
      variant="caption"
    >
      {label}
    </Typography>
    <Typography data-testid={testId} variant="body2">
      {children ?? value}
    </Typography>
  </Paper>
);

export default SettingsStatTile;
