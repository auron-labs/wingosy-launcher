import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import * as Mui from "@mui/material";

import * as Shared from "./settings-view-shared";

/** @param {import("./settings-types").SettingsPanelProps} settings - Settings panel state and actions. */
const IntegrationsSettings = (settings) => (
  <Mui.Paper sx={Shared.SETTINGS_CARD_GRADIENT_SX}>
    <Mui.Box sx={{ alignItems: "center", display: "flex", gap: 1, mb: 2 }}>
      <EmojiEventsIcon color="primary" />
      <Mui.Typography variant="h6">Integrations</Mui.Typography>
    </Mui.Box>
    <Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      App-wide preferences for third-party services. These apply to your whole
      library, not individual games.
    </Mui.Typography>
    <Mui.FormControlLabel
      control={
        <Mui.Switch
          checked={settings.config?.display?.retroachievements_enabled === true}
          onChange={(event) => {
            void settings.persistRetroAchievements(event.target.checked);
          }}
        />
      }
      label="Enable RetroAchievements"
    />
  </Mui.Paper>
);

export default IntegrationsSettings;
