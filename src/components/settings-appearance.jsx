import PaletteIcon from "@mui/icons-material/Palette";
import * as Mui from "@mui/material";
import { invoke } from "@tauri-apps/api/core";

import * as Components from "./settings-components";
import * as Shared from "./settings-view-shared";

/** @param {import("./settings-types").SettingsPanelProps} settings - Settings panel state and actions. */
export default function AppearanceSettings(settings) {
  return (
  <Mui.Paper sx={Shared.SETTINGS_CARD_SX}>
    <Mui.Box
      sx={{ alignItems: "center", display: "flex", gap: 1, mb: 2 }}
    >
      <PaletteIcon color="primary" />
      <Mui.Typography variant="h6">Appearance</Mui.Typography>
    </Mui.Box>

    {/* Theme Mode */}
    <Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
      Theme
    </Mui.Typography>
    <Mui.ToggleButtonGroup
      value={settings.themeMode}
      exclusive
      onChange={async (e, newMode) => {
        if (!newMode) {
          return;
        }
        settings.setThemeMode(newMode);
        try {
          const cfg = /** @type {import("./settings-types").SettingsConfig} */ (await invoke("get_config"));
          cfg.display = cfg.display || {};
          cfg.display.theme_mode = newMode;
          await invoke("save_config", { config: cfg });
        } catch (error) {
          console.error("Failed to save theme mode:", error);
        }
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
    <Mui.Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        mb: 3,
      }}
    >
      {[
        {
          background: "#fffbfe",
          label: "Light",
          mode: "light",
          muted: "#5f5f5f",
          surface: "#f5f5f5",
          text: "#1c1b1f",
        },
        {
          background: "#202124",
          label: "System",
          mode: "system",
          muted: "#bdc1c6",
          surface: "#303134",
          text: "#f1f3f4",
        },
        {
          background: "#121212",
          label: "Dark",
          mode: "dark",
          muted: "#b3b3b3",
          surface: "#1e1e1e",
          text: "#e1e1e1",
        },
      ].map((preview) => (
        <Mui.Box
          key={preview.mode}
          data-testid={`theme-preview-${preview.mode}`}
          aria-label={`${preview.label} theme preview`}
          sx={{
            bgcolor: preview.background,
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            p: 1,
          }}
        >
          <Mui.Typography
            variant="caption"
            sx={{ color: preview.text, fontWeight: 600 }}
          >
            {preview.label}
          </Mui.Typography>
          <Mui.Box
            sx={{
              bgcolor: preview.surface,
              borderRadius: 1,
              mt: 0.75,
              p: 1,
            }}
          >
            <Mui.Typography
              variant="caption"
              sx={{ color: preview.text, display: "block" }}
            >
              Wingosy Library
            </Mui.Typography>
            <Mui.Box sx={{ display: "flex", gap: 0.5, mt: 0.75 }}>
              <Mui.Box
                sx={{
                  bgcolor: "primary.main",
                  borderRadius: 0.5,
                  height: 24,
                  width: 18,
                }}
              />
              <Mui.Box
                sx={{
                  bgcolor: preview.muted,
                  borderRadius: 0.5,
                  height: 24,
                  width: 18,
                }}
              />
              <Mui.Box
                sx={{
                  bgcolor: preview.background,
                  borderRadius: 0.5,
                  flex: 1,
                  height: 24,
                }}
              />
            </Mui.Box>
          </Mui.Box>
          {preview.mode === "system" && (
            <Mui.Typography
              variant="caption"
              sx={{ color: preview.muted, display: "block", mt: 0.5 }}
            >
              Follows your OS preference
            </Mui.Typography>
          )}
        </Mui.Box>
      ))}
    </Mui.Box>
    <Mui.Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", mb: 1 }}
    >
      These previews are examples only; choosing a theme above applies
      it to Wingosy.
    </Mui.Typography>

    {/* Accent Color */}
    <Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
      Accent Color
    </Mui.Typography>
    <Components.AccentHueSlider
      accentHue={settings.accentHue}
      setAccentHue={settings.setAccentHue}
    />
  </Mui.Paper>
  );
}
