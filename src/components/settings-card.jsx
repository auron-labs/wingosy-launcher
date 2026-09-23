import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { SETTINGS_CARD_SX } from "./settings-view-shared";

/**
 * @param {{actions?: import("react").ReactNode, children?: import("react").ReactNode, subtitle?: string, sx?: object, title?: string}} props Settings card properties.
 * @returns {import("react").ReactNode} A settings surface with an optional header row.
 */
const SettingsCard = ({ actions, children, subtitle, sx, title, ...props }) => (
  <Paper sx={{ ...SETTINGS_CARD_SX, ...sx }} {...props}>
    {title === undefined && actions === undefined ? null : (
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          mb: 2,
        }}
      >
        {title === undefined ? (
          <Box sx={{ flex: 1 }} />
        ) : (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6">{title}</Typography>
            {subtitle === undefined ? null : (
              <Typography color="text.secondary" variant="body2">
                {subtitle}
              </Typography>
            )}
          </Box>
        )}
        {actions}
      </Box>
    )}
    {title !== undefined || subtitle === undefined ? null : (
      <Typography
        color="text.secondary"
        sx={{ display: "block", mb: 2 }}
        variant="body2"
      >
        {subtitle}
      </Typography>
    )}
    {children}
  </Paper>
);

export default SettingsCard;
