import RefreshIcon from "@mui/icons-material/Refresh";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";

import SettingsCard from "./settings-card";

/** @typedef {Pick<import("./settings-types").SettingsPanelProps, "handleCaptureNativeController"|"loadNativeControllers"|"nativeControllerLoading"|"nativeControllerMessage"|"nativeControllers">} NativeControllerCardProps */

/** @param {NativeControllerCardProps} settings Controller state and actions. */
const NativeControllerList = (settings) => {
  if (settings.nativeControllers.length === 0) {
    return null;
  }
  return (
    <List dense disablePadding>
      {settings.nativeControllers.map((controller) => (
        <ListItem
          key={controller.device_id}
          disableGutters
          secondaryAction={
            <Button
              size="small"
              variant={
                controller.configured === true ? "outlined" : "contained"
              }
              onClick={() => {
                settings.handleCaptureNativeController(controller.device_id);
              }}
            >
              {controller.configured === true ? "Update" : "Capture"}
            </Button>
          }
        >
          <ListItemText
            primary={controller.name}
            secondary={
              controller.configured === true
                ? "Saved mapping for this SDL hardware model"
                : "No saved mapping"
            }
          />
        </ListItem>
      ))}
    </List>
  );
};

/** @param {NativeControllerCardProps} settings Settings state and actions. */
const NativeControllerCard = (settings) => (
  <SettingsCard
    actions={
      <Button
        disabled={settings.nativeControllerLoading}
        onClick={() => {
          settings.loadNativeControllers();
        }}
        size="small"
        startIcon={<RefreshIcon />}
        variant="outlined"
      >
        Refresh controllers
      </Button>
    }
    data-testid="native-controller-card"
    sx={{ mt: 3 }}
    subtitle="Wingosy uses the native SDL controller identity and applies the saved standard mapping to Eden when you play. Browser gamepad names are not used for this setup."
    title="Eden controller"
  >
    {settings.nativeControllerMessage && (
      <Chip
        color={
          settings.nativeControllerMessage.type === "error"
            ? "error"
            : "success"
        }
        label={settings.nativeControllerMessage.message}
      />
    )}
    {settings.nativeControllerLoading && (
      <Box sx={{ mt: 1 }}>Loading controllers…</Box>
    )}
    {!settings.nativeControllerLoading &&
      settings.nativeControllers.length === 0 &&
      !settings.nativeControllerMessage && (
        <Chip
          color="info"
          label="No standard SDL controller is connected. Eden will use its defaults until one is connected."
        />
      )}
    <NativeControllerList {...settings} />
  </SettingsCard>
);

export default NativeControllerCard;
