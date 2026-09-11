import * as Mui from "@mui/material";

import * as Components from "./settings-components";
import * as Shared from "./settings-view-shared";

/** @param {import("./settings-types").SettingsPanelProps} settings - Settings panel state and actions. */
export default function BiosSettingsPanel(settings) {
  return (
  <Components.BiosSettings libraryPlatforms={settings.platforms} />
  );
}
