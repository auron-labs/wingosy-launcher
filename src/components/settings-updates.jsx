import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import * as Mui from "@mui/material";
import { open as shellOpen } from "@tauri-apps/plugin-shell";

import * as Components from "./settings-components";
import * as Shared from "./settings-view-shared";

/** @param {import("./settings-types").SettingsPanelProps} settings - Settings panel state and actions. */
export default function UpdatesSettings(settings) {
  return (
  <Mui.Paper sx={Shared.SETTINGS_CARD_SX}>
    <Mui.Box
      sx={{ alignItems: "center", display: "flex", gap: 1, mb: 2 }}
    >
      <SystemUpdateIcon color="primary" />
      <Mui.Typography variant="h6">Updates</Mui.Typography>
    </Mui.Box>
    <Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      Wingosy checks GitHub for your selected channel. When a newer
      signed build is published, use{" "}
      <strong>Download &amp; install</strong> for an in-place update
      (Windows restarts the app when the installer finishes). You can
      still open the release page for installers or release notes.
    </Mui.Typography>
    <Components.AppVersionField value={settings.appVersion} />

    <Mui.FormControl component="fieldset" sx={{ mb: 2 }}>
      <Mui.FormLabel component="legend">Update behavior</Mui.FormLabel>
      <Mui.ToggleButtonGroup
        value={settings.updatePreference}
        exclusive
        aria-label="Update mode choices"
        onChange={(_, nextPreference) => {
          if (nextPreference) {
            settings.persistUpdatePreference(nextPreference);
          }
        }}
        size="small"
        sx={{ mt: 1 }}
      >
        <Mui.ToggleButton value={Shared.UPDATE_PREFERENCE.OFF}>Off</Mui.ToggleButton>
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
        {settings.updatePreference === Shared.UPDATE_PREFERENCE.AUTOMATIC
          ? "Check for updates at startup and install signed updates automatically."
          : settings.updatePreference === Shared.UPDATE_PREFERENCE.CHECK_ONLY
            ? "Check for updates at startup and notify you before installing anything."
            : "Do not check for updates at startup. You can still check manually below."}
      </Mui.Typography>
    </Mui.FormControl>

    <Mui.FormControl
      component="fieldset"
      sx={{ mb: 2 }}
      variant="standard"
    >
      <Mui.FormLabel component="legend">Update channel</Mui.FormLabel>
      <Mui.RadioGroup
        value={settings.updateChannel}
        onChange={(e) => {
          settings.requestChannelChange(e.target.value);
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
        Beta and Nightly apply to manual and startup checks. Signed
        in-app installs are available when a release includes{" "}
        <Mui.Typography
          component="span"
          variant="inherit"
          sx={{ color: "text.secondary", fontFamily: "monospace" }}
        >
          latest.json
        </Mui.Typography>
        ; otherwise use Open release to download the installer
        manually.
      </Mui.Typography>
    </Mui.FormControl>

    <Mui.Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 }}>
      <Mui.Button
        variant="contained"
        startIcon={<SystemUpdateIcon />}
        disabled={settings.updateCheckLoading}
        onClick={settings.handleCheckForUpdates}
        data-testid="check-for-updates-button"
      >
        {settings.updateCheckLoading ? "Checking…" : "Check for updates"}
      </Mui.Button>
      <Mui.Button
        variant="outlined"
        startIcon={<OpenInNewIcon />}
        onClick={async () =>
          shellOpen(
            "https://github.com/auron-labs/wingosy-launcher/releases"
          )
        }
      >
        All releases
      </Mui.Button>
    </Mui.Box>
    {settings.updateMessage && (
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
    {settings.updateCheckResult?.error && (
      <Mui.Alert severity="warning" sx={{ mt: 2 }}>
        {settings.updateCheckResult.error}
        {settings.updateCheckResult.channel ? (
          <Mui.Typography
            variant="caption"
            sx={{ display: "block", mt: 1 }}
          >
            Channel: {settings.updateCheckResult.channel}
          </Mui.Typography>
        ) : null}
      </Mui.Alert>
    )}
    {settings.updateCheckResult &&
      !settings.updateCheckResult.error &&
      settings.updateCheckResult.is_update_available && (
        <Mui.Alert
          severity="success"
          sx={{ mt: 2 }}
          action={
            <Mui.Box
              sx={{
                alignItems: "center",
                display: "flex",
                flexWrap: "wrap",
                gap: 0.5,
              }}
            >
              {settings.updateCheckResult.signed_update_manifest_url ? (
                <Mui.Button
                  color="inherit"
                  size="small"
                  disabled={settings.signedUpdateInstalling}
                  onClick={async () =>
                    settings.handleInstallSignedUpdateFromSettings()
                  }
                >
                  {settings.signedUpdateInstalling
                    ? "Installing…"
                    : "Download & install"}
                </Mui.Button>
              ) : null}
              {settings.updateCheckResult.release_url ? (
                <Mui.Button
                  color="inherit"
                  size="small"
                  onClick={async () =>
                    shellOpen(settings.updateCheckResult.release_url)
                  }
                >
                  Open release
                </Mui.Button>
              ) : null}
            </Mui.Box>
          }
        >
          Update available on{" "}
          {settings.updateCheckResult.channel || settings.updateChannel}
          {settings.updateCheckResult.latest_version
            ? ` (${settings.updateCheckResult.latest_version})`
            : ""}
          .
          {settings.updateCheckResult.signed_update_manifest_url ? null : (
            <Mui.Typography
              variant="caption"
              sx={{ mt: 1, display: "block" }}
            >
              In-app install is unavailable for this release (missing
              or invalid signed updater manifest). Use{" "}
              <strong>Open release</strong> to download the installer
              manually.
            </Mui.Typography>
          )}
        </Mui.Alert>
      )}
    {settings.updateCheckResult &&
      !settings.updateCheckResult.error &&
      !settings.updateCheckResult.is_update_available && (
        <Mui.Alert severity="info" sx={{ mt: 2 }}>
          You’re up to date on{" "}
          {settings.updateCheckResult.channel || settings.updateChannel}
          {settings.updateCheckResult.latest_version
            ? ` (latest: ${settings.updateCheckResult.latest_version})`
            : ""}
          .
        </Mui.Alert>
      )}
  </Mui.Paper>
  );
}
