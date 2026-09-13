import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import * as Mui from "@mui/material";

import * as Shared from "./settings-view-shared";

/** @param {import("./settings-types").SettingsPanelProps} _settings - Settings panel state and actions. */
const IntegrationsSettings = (_settings) => (
  <Mui.Paper sx={Shared.SETTINGS_CARD_GRADIENT_SX}>
    <Mui.Box sx={{ alignItems: "center", display: "flex", gap: 1, mb: 2 }}>
      <EmojiEventsIcon color="primary" />
      <Mui.Typography variant="h6">Integrations</Mui.Typography>
      <Mui.Chip label="Preview" size="small" color="info" variant="outlined" />
    </Mui.Box>
    <Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      App-wide preferences for third-party services. These apply to your whole
      library, not individual games.
    </Mui.Typography>
    <Mui.Alert severity="info" sx={{ mb: 2 }}>
      RetroAchievements tracking and achievement data are not shipped yet. This
      preview page is informational; enabling it currently has no effect and
      does not add achievement placeholders elsewhere in Wingosy.
    </Mui.Alert>
    <Mui.FormControlLabel
      control={<Mui.Switch checked={false} disabled />}
      label="Enable RetroAchievements"
    />
    <Mui.Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", maxWidth: 520, mt: 1 }}
    >
      The setting stays disabled until the integration is available. Existing
      game details keep the same explanatory off state instead of rendering fake
      locked achievements.
    </Mui.Typography>
  </Mui.Paper>
);

export default IntegrationsSettings;
