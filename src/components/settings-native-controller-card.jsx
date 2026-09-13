import RefreshIcon from "@mui/icons-material/Refresh";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

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
  <Paper
    variant="outlined"
    data-testid="native-controller-card"
    sx={{ bgcolor: "rgba(33, 150, 243, 0.04)", borderRadius: 2, mt: 3, p: 2 }}
  >
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        justifyContent: "space-between",
        mb: 1,
      }}
    >
      <Typography variant="subtitle1">
        <SportsEsportsIcon color="primary" fontSize="small" /> Eden controller
      </Typography>
      <Button
        size="small"
        variant="outlined"
        startIcon={<RefreshIcon />}
        onClick={() => {
          settings.loadNativeControllers();
        }}
        disabled={settings.nativeControllerLoading}
      >
        Refresh controllers
      </Button>
    </Box>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
      Wingosy uses the native SDL controller identity and applies the saved
      standard mapping to Eden when you play. Browser gamepad names are not used
      for this setup.
    </Typography>
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
  </Paper>
);

export default NativeControllerCard;
