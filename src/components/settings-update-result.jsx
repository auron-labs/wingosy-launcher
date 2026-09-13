import * as Mui from "@mui/material";

import AvailableUpdate from "./settings-available-update";

/** @typedef {Pick<import("./settings-types").SettingsPanelProps, "handleInstallSignedUpdateFromSettings"|"runtime"|"setUpdateMessage"|"signedUpdateInstalling"|"updateChannel"|"updateCheckResult"|"updateMessage">} UpdateResultProps */

/** @param {string|null|undefined} value Candidate text. @returns {value is string} Whether text is present. */
const hasText = (value) =>
  value !== null && value !== undefined && value !== "";

/** @param {UpdateResultProps} settings Update result state and actions. */
const UpdateResult = (settings) => {
  const result = settings.updateCheckResult;
  if (result === null) {
    return null;
  }
  if (hasText(result.error)) {
    return (
      <Mui.Alert severity="warning" sx={{ mt: 2 }}>
        {result.error}
        {hasText(result.channel) && (
          <Mui.Typography variant="caption" sx={{ display: "block", mt: 1 }}>
            Channel: {result.channel}
          </Mui.Typography>
        )}
      </Mui.Alert>
    );
  }
  if (result.is_update_available) {
    return <AvailableUpdate {...settings} result={result} />;
  }
  return (
    <Mui.Alert severity="info" sx={{ mt: 2 }}>
      You’re up to date on {result.channel ?? settings.updateChannel}
      {hasText(result.latest_version)
        ? ` (latest: ${result.latest_version})`
        : ""}
      .
    </Mui.Alert>
  );
};

export default UpdateResult;
