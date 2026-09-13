import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import * as Mui from "@mui/material";

import StorageSettings from "./settings-library-storage";
import * as Shared from "./settings-view-shared";

/** @typedef {import("./settings-types").SettingsPanelProps} SettingsPanelProps */

/** @param {SettingsPanelProps} settings Settings panel state and actions. */
const HiddenGamesSettings = (settings) => (
  <Mui.Paper sx={Shared.SETTINGS_CARD_GRADIENT_SX}>
    <Mui.Box sx={{ alignItems: "center", display: "flex", gap: 1, mb: 2 }}>
      <VisibilityOffIcon color="primary" />
      <Mui.Typography variant="h6">Hidden Games</Mui.Typography>
    </Mui.Box>
    <Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      View and restore games that you&apos;ve hidden from your library.
    </Mui.Typography>
    <Mui.Button
      variant="outlined"
      startIcon={<VisibilityIcon />}
      onClick={() => {
        settings.handleOpenHiddenDialog();
      }}
    >
      View Hidden Games
    </Mui.Button>
  </Mui.Paper>
);

/** @param {SettingsPanelProps} settings Settings panel state and actions. */
const LibrarySettings = (settings) => (
  <>
    <StorageSettings {...settings} />
    <HiddenGamesSettings {...settings} />
  </>
);

export default LibrarySettings;
