import VisibilityIcon from "@mui/icons-material/Visibility";
import * as Mui from "@mui/material";

import * as Components from "./settings-components";
import StorageSettings from "./settings-library-storage";

/** @typedef {import("./settings-types").SettingsPanelProps} SettingsPanelProps */

/** @param {SettingsPanelProps} settings Settings panel state and actions. */
const HiddenGamesSettings = (settings) => (
  <Components.SettingsCard
    subtitle="View and restore games that you've hidden from your library."
    title="Hidden Games"
  >
    <Mui.Button
      onClick={() => {
        settings.handleOpenHiddenDialog();
      }}
      startIcon={<VisibilityIcon />}
      variant="outlined"
    >
      View Hidden Games
    </Mui.Button>
  </Components.SettingsCard>
);

/** @param {SettingsPanelProps} settings Settings panel state and actions. */
const LibrarySettings = (settings) => (
  <>
    <StorageSettings {...settings} />
    <HiddenGamesSettings {...settings} />
  </>
);

export default LibrarySettings;
