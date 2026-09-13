import * as Mui from "@mui/material";
/** @typedef {Pick<import("./settings-types").SettingsPanelProps, "handleInstallSignedUpdateFromSettings"|"runtime"|"signedUpdateInstalling"|"updateChannel">} AvailableUpdateProps */
/** @typedef {NonNullable<import("./settings-types").SettingsPanelProps["updateCheckResult"]>} UpdateResult */

/** @param {string|null|undefined} value Candidate text. @returns {value is string} Whether text is present. */
const hasText = (value) =>
  value !== null && value !== undefined && value !== "";

/** @param {AvailableUpdateProps & {result: UpdateResult}} settings Available update state and actions. */
const AvailableUpdate = (settings) => {
  const { result } = settings;
  const openRelease = () => {
    if (hasText(result.release_url)) {
      void settings.runtime.shellOpen(result.release_url);
    }
  };
  const installSignedUpdate = () => {
    settings.handleInstallSignedUpdateFromSettings();
  };
  const hasSignedManifest = hasText(result.signed_update_manifest_url);
  return (
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
          {hasSignedManifest && (
            <Mui.Button
              color="inherit"
              size="small"
              disabled={settings.signedUpdateInstalling}
              onClick={installSignedUpdate}
            >
              {settings.signedUpdateInstalling
                ? "Installing…"
                : "Download & install"}
            </Mui.Button>
          )}
          {hasText(result.release_url) && (
            <Mui.Button color="inherit" size="small" onClick={openRelease}>
              Open release
            </Mui.Button>
          )}
        </Mui.Box>
      }
    >
      Update available on {result.channel ?? settings.updateChannel}
      {hasText(result.latest_version) ? ` (${result.latest_version})` : ""}.
      {!hasSignedManifest && (
        <Mui.Typography variant="caption" sx={{ display: "block", mt: 1 }}>
          In-app install is unavailable for this release (missing or invalid
          signed updater manifest). Use <strong>Open release</strong> to
          download the installer manually.
        </Mui.Typography>
      )}
    </Mui.Alert>
  );
};

export default AvailableUpdate;
