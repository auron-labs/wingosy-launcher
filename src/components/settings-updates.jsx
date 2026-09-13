import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import * as Mui from "@mui/material";

import * as Components from "./settings-components";
import UpdateResult from "./settings-update-result";
import * as Shared from "./settings-view-shared";

/** @typedef {import("./settings-types").SettingsPanelProps} SettingsPanelProps */

/** @param {string} preference Update preference. @returns {string} Preference description. */
const getPreferenceDescription = (preference) => {
  if (preference === Shared.UPDATE_PREFERENCE.AUTOMATIC) {
    return "Check for updates at startup and install signed updates automatically.";
  }
  if (preference === Shared.UPDATE_PREFERENCE.CHECK_ONLY) {
    return "Check for updates at startup and notify you before installing anything.";
  }
  return "Do not check for updates at startup. You can still check manually below.";
};

/** @param {import("./settings-runtime").SettingsRuntime["shellOpen"]} shellOpen Open releases in the system browser. */
const openAllReleases = (shellOpen) => {
  void shellOpen("https://github.com/auron-labs/wingosy-launcher/releases");
};

/** @param {SettingsPanelProps} settings Update preference state and actions. */
const UpdatePreferenceControl = (settings) => (
  <Mui.FormControl component="fieldset" sx={{ mb: 2 }}>
    <Mui.FormLabel component="legend">Update behavior</Mui.FormLabel>
    <Mui.ToggleButtonGroup
      value={settings.updatePreference}
      exclusive
      aria-label="Update mode choices"
      onChange={(_, nextPreference) => {
        if (nextPreference !== null && nextPreference !== "") {
          settings.persistUpdatePreference(nextPreference);
        }
      }}
      size="small"
      sx={{ mt: 1 }}
    >
      <Mui.ToggleButton value={Shared.UPDATE_PREFERENCE.OFF}>
        Off
      </Mui.ToggleButton>
      <Mui.ToggleButton value={Shared.UPDATE_PREFERENCE.CHECK_ONLY}>
        Check and notify
      </Mui.ToggleButton>
      <Mui.ToggleButton value={Shared.UPDATE_PREFERENCE.AUTOMATIC}>
        Automatic
      </Mui.ToggleButton>
    </Mui.ToggleButtonGroup>
    <Mui.Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", maxWidth: 560, mt: 1 }}
    >
      {getPreferenceDescription(settings.updatePreference)}
    </Mui.Typography>
  </Mui.FormControl>
);

/** @param {SettingsPanelProps} settings Update channel state and actions. */
const UpdateChannelControl = (settings) => (
  <Mui.FormControl component="fieldset" sx={{ mb: 2 }} variant="standard">
    <Mui.FormLabel component="legend">Update channel</Mui.FormLabel>
    <Mui.RadioGroup
      value={settings.updateChannel}
      onChange={(event) => {
        settings.requestChannelChange(event.target.value);
      }}
    >
      <Mui.FormControlLabel
        value="stable"
        control={<Mui.Radio size="small" />}
        label="Stable — latest official release"
      />
      <Mui.FormControlLabel
        value="beta"
        control={<Mui.Radio size="small" />}
        label="Beta — early preview releases with new features and less testing"
      />
      <Mui.FormControlLabel
        value="nightly"
        control={<Mui.Radio size="small" />}
        label="Nightly — frequent development releases for trying changes early"
      />
    </Mui.RadioGroup>
    <Mui.Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", maxWidth: 560, mt: 0.5 }}
    >
      Beta and Nightly apply to manual and startup checks. Signed in-app
      installs are available when a release includes{" "}
      <Mui.Typography
        component="span"
        variant="inherit"
        sx={{ color: "text.secondary", fontFamily: "monospace" }}
      >
        latest.json
      </Mui.Typography>
      ; otherwise use Open release to download the installer manually.
    </Mui.Typography>
  </Mui.FormControl>
);

/** @param {SettingsPanelProps} settings Settings panel state and actions. */
const UpdatesSettings = (settings) => (
  <Mui.Paper sx={Shared.SETTINGS_CARD_SX}>
    <Mui.Box sx={{ alignItems: "center", display: "flex", gap: 1, mb: 2 }}>
      <SystemUpdateIcon color="primary" />
      <Mui.Typography variant="h6">Updates</Mui.Typography>
    </Mui.Box>
    <Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      Wingosy checks GitHub for your selected channel. When a newer signed build
      is published, use <strong>Download &amp; install</strong> for an in-place
      update (Windows restarts the app when the installer finishes). You can
      still open the release page for installers or release notes.
    </Mui.Typography>
    <Components.AppVersionField value={settings.appVersion} />
    <UpdatePreferenceControl {...settings} />
    <UpdateChannelControl {...settings} />
    <Mui.Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 }}>
      <Mui.Button
        variant="contained"
        startIcon={<SystemUpdateIcon />}
        disabled={settings.updateCheckLoading}
        onClick={() => {
          settings.handleCheckForUpdates();
        }}
        data-testid="check-for-updates-button"
      >
        {settings.updateCheckLoading ? "Checking…" : "Check for updates"}
      </Mui.Button>
      <Mui.Button
        variant="outlined"
        startIcon={<OpenInNewIcon />}
        onClick={() => {
          openAllReleases(settings.runtime.shellOpen);
        }}
      >
        All releases
      </Mui.Button>
    </Mui.Box>
    {settings.updateMessage !== null && (
      <Mui.Alert
        severity={settings.updateMessage.type}
        onClose={() => {
          settings.setUpdateMessage(null);
        }}
        sx={{ mt: 2 }}
      >
        {settings.updateMessage.message}
      </Mui.Alert>
    )}
    {settings.updateCheckLoading && (
      <Mui.LinearProgress sx={{ borderRadius: 1, mt: 2 }} />
    )}
    <UpdateResult {...settings} />
  </Mui.Paper>
);

export default UpdatesSettings;
