import * as Mui from "@mui/material";

import * as Components from "./settings-components";

/** @param {import("./settings-types").SettingsPanelProps} settings - Settings panel state and actions. */
const IntegrationsSettings = (settings) => (
  <Components.SettingsCard>
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
  </Components.SettingsCard>
);

export default IntegrationsSettings;
