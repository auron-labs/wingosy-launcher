import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import * as Mui from "@mui/material";

import * as Components from "./settings-components";
import * as Shared from "./settings-view-shared";

const SUPPORTED_EMULATOR_PATHS_URL =
  "https://github.com/auron-labs/wingosy-launcher/blob/main/.scratch/transparent-romm-launching/emulator-certification.md";

/** @param {import("./settings-runtime").SettingsRuntime["shellOpen"]} shellOpen Open a URL in the system browser. */
const openSupportedEmulatorPaths = (shellOpen) => {
  void shellOpen(SUPPORTED_EMULATOR_PATHS_URL);
};

const immersiveModeInputProps = { "data-testid": "immersive-mode-switch" };
const immersiveFullscreenInputProps = {
  "data-testid": "immersive-fullscreen-switch",
};

/** @param {import("./settings-types").SettingsPanelProps} settings Settings panel state. */
const BetaScopeCard = (settings) => (
  <Mui.Paper sx={Shared.SETTINGS_CARD_SX}>
    <Mui.Box sx={{ alignItems: "center", display: "flex", gap: 1, mb: 1 }}>
      <DesktopWindowsIcon color="primary" />
      <Mui.Typography variant="h6">Private Beta</Mui.Typography>
    </Mui.Box>
    <Mui.Typography variant="subtitle2" sx={{ mb: 1 }}>
      Private beta scope
    </Mui.Typography>
    <Mui.List dense disablePadding sx={{ mb: 2 }}>
      <Mui.ListItem disableGutters alignItems="flex-start">
        <Mui.ListItemIcon sx={{ minWidth: 32, mt: 0.25 }}>
          <CheckCircleIcon color="primary" fontSize="small" />
        </Mui.ListItemIcon>
        <Mui.ListItemText primary="Windows 11 with RetroArch for NES, SNES, GB, GBC, GBA, and Genesis." />
      </Mui.ListItem>
      <Mui.ListItem disableGutters alignItems="flex-start">
        <Mui.ListItemIcon sx={{ minWidth: 32, mt: 0.25 }}>
          <CheckCircleIcon color="primary" fontSize="small" />
        </Mui.ListItemIcon>
        <Mui.ListItemText primary="RomM connection, library sync, ROM downloads, and one-step Play are included." />
      </Mui.ListItem>
      <Mui.ListItem disableGutters alignItems="flex-start">
        <Mui.ListItemIcon sx={{ minWidth: 32, mt: 0.25 }}>
          <CheckCircleIcon color="primary" fontSize="small" />
        </Mui.ListItemIcon>
        <Mui.ListItemText primary="Save transfers are manual; automatic save sync and other emulator/platform combinations remain experimental." />
      </Mui.ListItem>
    </Mui.List>
    <Components.AppVersionField value={settings.appVersion} />
    <Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      For a report, include the app version above, your Windows version,
      reproduction steps, expected and actual behavior, and relevant redacted
      logs. Never share credentials, user data, configuration, database files,
      ROM names, or ROM paths.
    </Mui.Typography>
    <Mui.Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      <Mui.Button
        variant="outlined"
        startIcon={<FolderOpenIcon />}
        onClick={settings.handleOpenLogsFolder}
      >
        Open Logs Folder
      </Mui.Button>
      <Mui.Button
        variant="contained"
        startIcon={<OpenInNewIcon />}
        onClick={settings.handleReportProblem}
      >
        Report a Problem
      </Mui.Button>
    </Mui.Box>
    {settings.supportMessage && (
      <Mui.Alert severity={settings.supportMessage.type} sx={{ mt: 2 }}>
        {settings.supportMessage.message}
      </Mui.Alert>
    )}
    <Mui.Button
      variant="outlined"
      startIcon={<OpenInNewIcon />}
      onClick={() => {
        openSupportedEmulatorPaths(settings.runtime.shellOpen);
      }}
    >
      View supported emulator paths
    </Mui.Button>
    <Mui.Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", mt: 1 }}
    >
      See the emulator and platform combinations included in this preview.
    </Mui.Typography>
  </Mui.Paper>
);

/** @param {import("./settings-types").SettingsPanelProps} settings Settings panel state. */
const ImmersiveModeSwitch = (settings) => (
  <Mui.Box data-testid="immersive-mode-row">
    <Mui.FormControlLabel
      control={
        <Mui.Switch
          slotProps={{
            input: immersiveModeInputProps,
          }}
          checked={settings.immersiveModeEnabled}
          onChange={(e) => {
            const next = e.target.checked;
            settings.setImmersiveModeEnabled(next);
            // When enabling Immersive mode, default fullscreen on.
            const nextFs = next ? true : settings.fullscreenEnabled;
            if (next) {
              settings.setFullscreenEnabled(nextFs);
            }
            void settings.persistDisplayFlags(next, nextFs);
            if (settings.onImmersiveModeChange) {
              settings.onImmersiveModeChange(next);
            } else if (next && settings.onLibraryChange) {
              // Fallback: trigger library refresh so App.jsx picks up the new display flags
              void settings.onLibraryChange();
            }
          }}
        />
      }
      label="Immersive mode"
    />
  </Mui.Box>
);

/** @param {import("./settings-types").SettingsPanelProps} settings Settings panel state. */
const FullscreenSwitch = (settings) => (
  <Mui.FormControlLabel
    control={
      <Mui.Switch
        slotProps={{
          input: immersiveFullscreenInputProps,
        }}
        checked={settings.fullscreenEnabled}
        disabled={!settings.immersiveModeEnabled}
        onChange={(e) => {
          const nextFs = e.target.checked;
          settings.setFullscreenEnabled(nextFs);
          void settings.persistDisplayFlags(
            settings.immersiveModeEnabled,
            nextFs
          );
          if (settings.onFullscreenChange) {
            settings.onFullscreenChange(nextFs);
          }
        }}
      />
    }
    label="Fullscreen (Immersive)"
  />
);

/** @param {import("./settings-types").SettingsPanelProps} settings Settings panel state. */
const ControllerDeadzoneControl = (settings) => (
  <Mui.Box sx={{ maxWidth: 420, mt: 2 }}>
    <Mui.Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", mb: 1 }}
    >
      Raise this only when the stick drifts. It applies to Immersive directional
      navigation.
    </Mui.Typography>
    <Components.SettingSlider
      label="Controller deadzone"
      value={settings.controllerDeadzone}
      formatValue={(value) => `${Math.round(value * 100)}%`}
      valueTestId="controller-deadzone-value"
      min={settings.gamepadDeadzoneMin}
      max={settings.gamepadDeadzoneMax}
      step={0.05}
      valueLabelDisplay="auto"
      onChange={(_, value) => {
        if (Array.isArray(value)) {
          return;
        }
        settings.setControllerDeadzone(
          settings.normalizeGamepadDeadzone(value)
        );
      }}
      onChangeCommitted={(_, value) => {
        if (Array.isArray(value)) {
          return;
        }
        void settings.persistControllerDeadzone(value);
      }}
    />
    <Mui.Button
      size="small"
      variant="outlined"
      color="inherit"
      onClick={() => {
        void settings.persistControllerDeadzone(
          settings.defaultGamepadDeadzone
        );
      }}
    >
      Reset deadzone
    </Mui.Button>
  </Mui.Box>
);

/** @param {import("./settings-types").SettingsPanelProps} settings Settings panel state. */
const DisplaySettingsCard = (settings) => (
  <Mui.Paper sx={Shared.SETTINGS_CARD_SX}>
    <Mui.Typography variant="h6" gutterBottom>
      UI
    </Mui.Typography>
    <Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      Switch between desktop (default) and Immersive mode — a large-type,
      controller-friendly layout aligned with the Wingosy look. Optional OS
      fullscreen is ideal for couch play.
    </Mui.Typography>
    <Mui.Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <ImmersiveModeSwitch {...settings} />
      <FullscreenSwitch {...settings} />
      {!settings.immersiveModeEnabled && (
        <Mui.Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: 4.5 }}
        >
          Enable Immersive mode to use fullscreen.
        </Mui.Typography>
      )}
      <Mui.Typography variant="caption" color="text.secondary">
        Tip: <Components.KeyboardHint>F11</Components.KeyboardHint> toggles
        fullscreen. From the Immersive library,{" "}
        <Components.KeyboardHint>Esc</Components.KeyboardHint> exits to desktop.
      </Mui.Typography>
      <ControllerDeadzoneControl {...settings} />
    </Mui.Box>
  </Mui.Paper>
);

/** @param {import("./settings-types").SettingsPanelProps} settings - Settings panel state and actions. */
const GeneralSettings = (settings) => (
  <>
    <BetaScopeCard {...settings} />
    <DisplaySettingsCard {...settings} />
  </>
);

export default GeneralSettings;
