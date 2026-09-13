import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import MemoryIcon from "@mui/icons-material/Memory";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import TuneIcon from "@mui/icons-material/Tune";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import NativeControllerCard from "./settings-native-controller-card";
import { formatOptionalStorageBytes } from "./settings-presentation";
import RetroArchDetails from "./settings-retroarch-details";
import * as Shared from "./settings-view-shared";

/** @typedef {Pick<import("./settings-types").SettingsPanelProps, "availableEmus"|"config"|"downloadingCore"|"emuInstallProgress"|"emuMenuAnchor"|"emuMessage"|"expandedEmu"|"getInstallTypeLabel"|"handleApplyPaths"|"handleCaptureNativeController"|"handleCopyEmulatorPath"|"handleDownloadCore"|"handleDownloadEmulator"|"handleEmuMenuClose"|"handleEmuMenuOpen"|"handleLaunchEmulator"|"handleOpenLocation"|"handleOpenRetroarchInputSetup"|"handleRepairRetroarchProfile"|"handleResetRetroarchControllerAdditions"|"handleRetroarchBetaProfileChange"|"handleSetDefaultEmulator"|"handleUninstallEmulator"|"installedEmus"|"loadEmulators"|"loadMissingCores"|"loadNativeControllers"|"missingCores"|"nativeControllerCapture"|"nativeControllerLoading"|"nativeControllerMessage"|"nativeControllers"|"platformDefaults"|"platforms"|"retroarchCoreInventory"|"runtime"|"selectedEmu"|"setEmuMessage"|"setExpandedEmu"|"unavailableEmus">} EmulatorsSettingsProps */
/** @typedef {import("./settings-types").SettingsEmulator} SettingsEmulator */
/** @typedef {import("./settings-types").MissingCore} SettingsMissingCore */
/** @param {EmulatorsSettingsProps} settings - Settings panel state and actions. */
const EmulatorHeader = (settings) => (
  <Box
    sx={{
      alignItems: "center",
      display: "flex",
      flexWrap: "wrap",
      gap: 1.5,
      mb: 2,
    }}
  >
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        flex: 1,
        gap: 1,
        minWidth: 0,
      }}
    >
      <SportsEsportsIcon color="primary" />
      <Typography variant="h6">Emulators</Typography>
      <Chip
        label={`${settings.installedEmus.length} installed`}
        size="small"
        color="success"
        variant="outlined"
      />
      {settings.missingCores.length > 0 && (
        <Chip
          label={`${settings.missingCores.length} cores needed`}
          size="small"
          color="warning"
          variant="outlined"
          icon={<MemoryIcon sx={{ fontSize: 14 }} />}
        />
      )}
    </Box>
    <Box sx={{ display: "flex", gap: 1 }}>
      <Tooltip title="Use newly detected emulator paths without changing existing configured paths">
        <Button
          size="small"
          variant="outlined"
          onClick={settings.handleApplyPaths}
        >
          Apply detected paths
        </Button>
      </Tooltip>
      <Button
        size="small"
        variant="outlined"
        startIcon={<RefreshIcon />}
        onClick={() => {
          settings.loadEmulators();
          settings.loadMissingCores();
        }}
      >
        Refresh
      </Button>
    </Box>
  </Box>
);

/** @param {{phase?: string}|undefined} progress Emulator download progress. @returns {string} Download button label. */
const getDownloadLabel = (progress) => {
  if (progress?.phase === "extract") {
    return "Extracting…";
  }
  if (progress === undefined) {
    return "Download";
  }
  return "Downloading…";
};

/** @param {{settings: EmulatorsSettingsProps, emu: SettingsEmulator, path: string}} props Installed emulator details. */
const InstalledEmulatorInfo = ({ settings, emu, path }) => (
  <ListItemText
    primary={emu.name}
    onClick={() => {
      if (emu.id === "retroarch") {
        settings.setExpandedEmu(
          settings.expandedEmu === emu.id ? null : emu.id
        );
      }
    }}
    secondary={
      <>
        {`Version: ${emu.version ?? "Not reported"}`}
        <br />
        {`Install type: ${settings.getInstallTypeLabel(emu.install_type)}`}
        <br />
        <Tooltip title={path}>
          <span>{path}</span>
        </Tooltip>
      </>
    }
    sx={{ flex: "1 1 220px" }}
  />
);

/** @param {EmulatorsSettingsProps} settings - Settings panel state and actions. @param {SettingsEmulator} emu Emulator. */
const InstalledEmulator = (settings, emu) => {
  const isRetroArch = emu.id === "retroarch";
  const path = emu.installed_path ?? "Install path unavailable";
  return (
    <Box key={emu.id}>
      <ListItem
        sx={{
          alignItems: "flex-start",
          bgcolor: "rgba(76, 175, 80, 0.08)",
          borderRadius: 2,
          flexWrap: "wrap",
          mb: 0.5,
          rowGap: 1,
        }}
      >
        <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
          <CheckCircleIcon color="success" fontSize="small" />
        </ListItemIcon>
        <InstalledEmulatorInfo emu={emu} path={path} settings={settings} />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          <Button
            size="small"
            startIcon={<PlayArrowIcon />}
            onClick={() => {
              void settings.runtime.invoke("launch_emulator", {
                emulatorPath: emu.installed_path,
              });
            }}
          >
            Launch
          </Button>
          <Button
            size="small"
            startIcon={<FolderOpenIcon />}
            onClick={() => {
              void settings.runtime.invoke("open_emulator_location", {
                emulatorPath: emu.installed_path,
              });
            }}
          >
            Open folder
          </Button>
          <Button
            size="small"
            startIcon={<ContentCopyIcon />}
            onClick={() => {
              settings.handleCopyEmulatorPath(emu.installed_path);
            }}
            disabled={
              emu.installed_path === null || emu.installed_path === undefined
            }
          >
            Copy path
          </Button>
          <Button
            size="small"
            aria-label="More"
            startIcon={<MoreVertIcon />}
            onClick={(event) => {
              settings.handleEmuMenuOpen(event, emu);
            }}
          >
            More
          </Button>
        </Box>
      </ListItem>
      {isRetroArch && (
        <Box sx={{ px: 1 }}>{RetroArchDetails(settings, emu)}</Box>
      )}
    </Box>
  );
};

/** @param {EmulatorsSettingsProps} settings - Settings panel state and actions. */
const InstalledEmulators = (settings) => {
  if (settings.installedEmus.length === 0) {
    return null;
  }
  return (
    <>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Installed
      </Typography>
      <List dense>
        {settings.installedEmus.map((emu) => InstalledEmulator(settings, emu))}
      </List>
      <Menu
        anchorEl={settings.emuMenuAnchor}
        open={Boolean(settings.emuMenuAnchor)}
        onClose={settings.handleEmuMenuClose}
      >
        <MenuItem onClick={settings.handleLaunchEmulator}>
          <PlayArrowIcon fontSize="small" sx={{ mr: 1 }} />
          Launch Emulator
        </MenuItem>
        <MenuItem onClick={settings.handleOpenLocation}>
          <FolderOpenIcon fontSize="small" sx={{ mr: 1 }} />
          Open Install Location
        </MenuItem>
        {settings.selectedEmu?.install_type === "managed" && (
          <MenuItem
            onClick={settings.handleUninstallEmulator}
            sx={{ color: "error.main" }}
          >
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Uninstall
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

/** @param {EmulatorsSettingsProps} settings - Settings panel state and actions. */
const DownloadableEmulators = (settings) => {
  if (settings.availableEmus.length === 0) {
    return null;
  }
  return (
    <>
      <Typography
        variant="subtitle2"
        color="text.secondary"
        sx={{ mb: 1, mt: 2 }}
      >
        Available for Download
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mb: 1 }}
      >
        Version and size are shown when the download source reports them; some
        release details are resolved only when installation starts.
      </Typography>
      <List dense>
        {settings.availableEmus.map((emu) => {
          const progress = settings.emuInstallProgress[emu.id];
          const label = getDownloadLabel(progress);
          return (
            <ListItem key={emu.id} sx={{ borderRadius: 2, flexWrap: "wrap" }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <CloudDownloadIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary={emu.name}
                secondary={
                  <Box component="div">
                    <Box component="div">
                      {`Version: ${emu.version ?? "Not reported"}`}
                    </Box>
                    <Box component="div">
                      {`Size: ${formatOptionalStorageBytes(emu.download_size_bytes)}`}
                    </Box>
                    <Box component="div">
                      {emu.is_installed === true
                        ? "Installed"
                        : "Not installed"}
                    </Box>
                  </Box>
                }
                slotProps={{ secondary: { component: "div" } }}
              />
              <Button
                size="small"
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => {
                  settings.handleDownloadEmulator(emu.id);
                }}
                disabled={Boolean(progress)}
              >
                {label}
              </Button>
            </ListItem>
          );
        })}
      </List>
    </>
  );
};

/** @param {EmulatorsSettingsProps} settings - Settings panel state and actions. */
const UnavailableEmulators = (settings) => {
  if (settings.unavailableEmus.length === 0) {
    return null;
  }
  return (
    <>
      <Typography
        variant="subtitle2"
        color="text.secondary"
        sx={{ mb: 1, mt: 2 }}
      >
        Manual Install Required
      </Typography>
      <List dense>
        {settings.unavailableEmus.map((emu) => (
          <ListItem
            key={emu.id}
            sx={{ borderRadius: 2, mb: 0.5, opacity: 0.6 }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <OpenInNewIcon color="action" fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={emu.name}
              secondary="Download manually from the emulator's website"
            />
          </ListItem>
        ))}
      </List>
    </>
  );
};

/** @param {EmulatorsSettingsProps} settings - Settings panel state and actions. */
const EmulatorCatalog = (settings) => (
  <Paper
    sx={{
      ...Shared.SETTINGS_CARD_SX,
      flex: 1,
      minWidth: 0,
      overflow: "hidden",
    }}
  >
    <EmulatorHeader {...settings} />
    <>
      {settings.emuMessage && (
        <Box sx={{ mb: 2 }}>
          <Chip
            color={settings.emuMessage.type === "error" ? "error" : "success"}
            label={settings.emuMessage.message}
            onDelete={() => {
              settings.setEmuMessage(null);
            }}
          />
        </Box>
      )}
      {settings.downloadingCore !== null && settings.downloadingCore !== "" && (
        <Box sx={{ mb: 2 }}>Downloading core…</Box>
      )}
      <InstalledEmulators {...settings} />
      <DownloadableEmulators {...settings} />
      <UnavailableEmulators {...settings} />
    </>
  </Paper>
);

/** @param {EmulatorsSettingsProps} settings - Settings panel state and actions. */
const PlatformDefaults = (settings) => {
  if (settings.platforms.length === 0 || settings.installedEmus.length === 0) {
    return (
      <Paper sx={{ ...Shared.SETTINGS_CARD_GRADIENT_SX, flex: 1, minWidth: 0 }}>
        <Typography variant="h6">
          <TuneIcon color="primary" /> Platform defaults
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Add games to your library and install at least one emulator to choose
          a default per platform.
        </Typography>
      </Paper>
    );
  }
  return (
    <Paper
      sx={{
        ...Shared.SETTINGS_CARD_GRADIENT_SX,
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <Typography variant="h6">
        <TuneIcon color="primary" /> Platform defaults
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose the default emulator for each platform. Platforms not listed here
        stay on Auto.
      </Typography>
      {settings.platforms.map(([platform]) => {
        const compatible = settings.installedEmus.filter(
          (emu) =>
            emu.supported_platforms.includes("*") ||
            emu.supported_platforms.includes(platform.id)
        );
        return (
          <Box
            key={platform.id}
            sx={{ alignItems: "center", display: "flex", gap: 1, mb: 1 }}
          >
            <Typography sx={{ flex: 1 }}>{platform.name}</Typography>
            <Select
              size="small"
              value={settings.platformDefaults[platform.id] ?? ""}
              displayEmpty
              data-testid={`platform-default-${platform.id}`}
              onChange={(event) => {
                settings.handleSetDefaultEmulator(
                  platform.id,
                  event.target.value
                );
              }}
              renderValue={(value) => {
                if (value === "") {
                  return "Auto";
                }
                return (
                  compatible.find((emu) => emu.id === value)?.name ?? "Auto"
                );
              }}
              disabled={compatible.length === 0}
            >
              <MenuItem value="">Auto</MenuItem>
              {compatible.map((emu) => (
                <MenuItem key={emu.id} value={emu.id}>
                  {emu.name}
                </MenuItem>
              ))}
            </Select>
          </Box>
        );
      })}
    </Paper>
  );
};

/** @param {EmulatorsSettingsProps} settings - Settings panel state and actions. */
const EmulatorsSettings = (settings) => (
  <Box
    sx={{
      alignItems: "flex-start",
      display: "flex",
      flexDirection: { lg: "row", xs: "column" },
      gap: 3,
      maxWidth: "100%",
      minWidth: 0,
      width: "100%",
    }}
  >
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <EmulatorCatalog {...settings} />
      <NativeControllerCard {...settings} />
      {settings.missingCores.length > 0 &&
        !settings.installedEmus.some((emu) => emu.id === "retroarch") && (
          <Typography color="warning.main" sx={{ mt: 2 }}>
            RetroArch support needed for {settings.missingCores.length} game
            systems
          </Typography>
        )}
    </Box>
    <PlatformDefaults {...settings} />
  </Box>
);

export default EmulatorsSettings;
