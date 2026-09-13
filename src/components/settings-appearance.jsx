import PaletteIcon from "@mui/icons-material/Palette";
import * as Mui from "@mui/material";

import * as Components from "./settings-components";
import * as Shared from "./settings-view-shared";
import ThemePreviewGrid from "./theme-preview-grid";

/** @typedef {import("./settings-types").SettingsPanelProps} SettingsPanelProps */
/** @typedef {import("./settings-types").SettingsConfig} SettingsConfig */
/** @typedef {import("./settings-types").ThemeMode} ThemeMode */

/** @param {unknown} value Candidate theme mode. @returns {value is ThemeMode} Whether the value is a theme mode. */
const isThemeMode = (value) =>
  value === "dark" || value === "light" || value === "system";

/** @param {import("./settings-types").SettingsPanelProps} settings Settings state and runtime. @param {ThemeMode} mode Theme mode to save. @returns {Promise<void>} Completed save. */
const saveThemeMode = async (settings, mode) => {
  try {
    /** @type {SettingsConfig} */
    const currentConfig = await settings.runtime.invoke("get_config");
    const nextConfig = {
      ...currentConfig,
      display: { ...currentConfig.display, theme_mode: mode },
    };
    await settings.runtime.invoke("save_config", { config: nextConfig });
  } catch (error) {
    console.error("Failed to save theme mode:", error);
  }
};

/** @param {SettingsPanelProps} settings Settings panel state and actions. */
const AppearanceSettings = (settings) => (
  <Mui.Paper sx={Shared.SETTINGS_CARD_SX}>
    <Mui.Box sx={{ alignItems: "center", display: "flex", gap: 1, mb: 2 }}>
      <PaletteIcon color="primary" />
      <Mui.Typography variant="h6">Appearance</Mui.Typography>
    </Mui.Box>
    <Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
      Theme
    </Mui.Typography>
    <Mui.ToggleButtonGroup
      value={settings.themeMode}
      exclusive
      onChange={(_, nextMode) => {
        if (!isThemeMode(nextMode)) {
          return;
        }
        settings.setThemeMode(nextMode);
        void saveThemeMode(settings, nextMode);
      }}
      size="small"
      sx={{ mb: 3 }}
    >
      <Mui.ToggleButton value="system" sx={{ px: 2 }}>
        System
      </Mui.ToggleButton>
      <Mui.ToggleButton value="light" sx={{ px: 2 }}>
        Light
      </Mui.ToggleButton>
      <Mui.ToggleButton value="dark" sx={{ px: 2 }}>
        Dark
      </Mui.ToggleButton>
    </Mui.ToggleButtonGroup>
    <Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
      Theme preview
    </Mui.Typography>
    <ThemePreviewGrid />
    <Mui.Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", mb: 1 }}
    >
      These previews are examples only; choosing a theme above applies it to
      Wingosy.
    </Mui.Typography>
    <Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
      Accent Color
    </Mui.Typography>
    <Components.AccentHueSlider
      accentHue={settings.accentHue}
      setAccentHue={settings.setAccentHue}
    />
  </Mui.Paper>
);

export default AppearanceSettings;
