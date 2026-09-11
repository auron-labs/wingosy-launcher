import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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
import Collapse from "@mui/material/Collapse";
import FormControlLabel from "@mui/material/FormControlLabel";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { invoke } from "@tauri-apps/api/core";

import { formatOptionalStorageBytes } from "./settingsPresentation";
import * as Shared from "./settings-view-shared";

/** @param {import("./settings-types").SettingsPanelProps} settings - Settings panel state and actions. */
function EmulatorHeader(settings) {
  return (
    <Box sx={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 1.5, mb: 2 }}>
      <Box sx={{ alignItems: "center", display: "flex", flex: 1, gap: 1, minWidth: 0 }}>
        <SportsEsportsIcon color="primary" />
        <Typography variant="h6">Emulators</Typography>
        <Chip label={`${settings.installedEmus.length} installed`} size="small" color="success" variant="outlined" />
        {settings.missingCores.length > 0 && <Chip label={`${settings.missingCores.length} cores needed`} size="small" color="warning" variant="outlined" icon={<MemoryIcon sx={{ fontSize: 14 }} />} />}
      </Box>
      <Box sx={{ display: "flex", gap: 1 }}>
        <Tooltip title="Use newly detected emulator paths without changing existing configured paths"><Button size="small" variant="outlined" onClick={settings.handleApplyPaths}>Apply detected paths</Button></Tooltip>
        <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={() => { settings.loadEmulators(); settings.loadMissingCores(); }}>Refresh</Button>
      </Box>
    </Box>
  );
}

/** @param {import("./settings-types").SettingsPanelProps} settings - Settings panel state and actions. */
function RetroArchDetails(settings, emu) {
  const isExpanded = settings.expandedEmu === emu.id;
  return <>
    <Button size="small" variant="outlined" startIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />} aria-expanded={isExpanded} onClick={(event) => { event.stopPropagation(); settings.setExpandedEmu(isExpanded ? null : emu.id); }}>{isExpanded ? "Hide cores" : "Show cores"}</Button>
    <Collapse in={isExpanded}><Box sx={{ bgcolor: "rgba(255, 152, 0, 0.05)", border: "1px solid rgba(255, 152, 0, 0.2)", borderRadius: 1, mt: 1, p: 2 }}>
      <Typography variant="caption" color="text.secondary">{emu.install_type === "managed" ? `Wingosy-managed RetroArch setup ${emu.version ?? "recorded"}` : "RetroArch installed outside Wingosy"}</Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, my: 1 }}><Button size="small" variant="outlined" onClick={settings.handleOpenRetroarchInputSetup}>Open RetroArch input setup</Button>{emu.install_type === "managed" ? <Button size="small" variant="outlined" onClick={settings.handleRepairRetroarchProfile}>Repair Wingosy controller setup</Button> : <Button size="small" variant="outlined" color="warning" onClick={settings.handleResetRetroarchControllerAdditions}>Reset Wingosy controller additions</Button>}</Box>
      {emu.install_type === "external" && <FormControlLabel control={<Switch size="small" checked={Boolean(settings.config?.emulators?.retroarch_use_beta_profile)} onChange={settings.handleRetroarchBetaProfileChange} />} label="Use Wingosy controller settings for this installation" />}
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>Supported RetroArch systems:</Typography>
      {settings.retroarchCoreInventory.map((core) => <Box key={core.platform_id} data-testid="retroarch-core-inventory-row" sx={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 1 }}><Typography variant="body2" sx={{ minWidth: 180 }}>{core.platform_name}</Typography><Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>{core.core_filename}</Typography><Chip label={core.required ? "Required" : "Optional"} size="small" variant="outlined" /><Chip label={core.status ? `${core.status[0].toUpperCase()}${core.status.slice(1)}` : "Unknown"} size="small" data-testid={`retroarch-core-status-${core.platform_id}`} color={core.status === "installed" ? "success" : "warning"} /></Box>)}
      {settings.missingCores.length > 0 && <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>{settings.missingCores.map((core) => <Chip key={core.core_filename} data-testid="retroarch-core-chip" icon={<MemoryIcon sx={{ fontSize: 14 }} />} label={`${core.core_filename} (${core.platform_name})`} onClick={() => { settings.handleDownloadCore(core.core_filename); }} onDelete={() => { settings.handleDownloadCore(core.core_filename); }} deleteIcon={<DownloadIcon sx={{ fontSize: 16 }} />} disabled={settings.downloadingCore !== null} />)}</Box>}
    </Box></Collapse>
  </>;
}

/** @param {import("./settings-types").SettingsPanelProps} settings - Settings panel state and actions. */
function InstalledEmulator(settings, emu) {
  const isRetroArch = emu.id === "retroarch";
  const path = emu.installed_path ?? "Install path unavailable";
  return <Box key={emu.id}><ListItem sx={{ alignItems: "flex-start", bgcolor: "rgba(76, 175, 80, 0.08)", borderRadius: 2, flexWrap: "wrap", mb: 0.5, rowGap: 1 }}><ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon><ListItemText primary={emu.name} secondary={<>{`Version: ${emu.version ?? "Not reported"}`}<br />{`Install type: ${settings.getInstallTypeLabel(emu.install_type)}`}<br /><Tooltip title={path}><span>{path}</span></Tooltip></>} sx={{ flex: "1 1 220px" }} /><Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}><Button size="small" startIcon={<PlayArrowIcon />} onClick={() => { void invoke("launch_emulator", { emulatorPath: emu.installed_path }); }}>Launch</Button><Button size="small" startIcon={<FolderOpenIcon />} onClick={() => { void invoke("open_emulator_location", { emulatorPath: emu.installed_path }); }}>Open folder</Button><Button size="small" startIcon={<ContentCopyIcon />} onClick={() => { settings.handleCopyEmulatorPath(emu.installed_path); }} disabled={!emu.installed_path}>Copy path</Button><Button size="small" aria-label="More" startIcon={<MoreVertIcon />} onClick={(event) => { settings.handleEmuMenuOpen(event, emu); }}>More</Button></Box></ListItem>{isRetroArch && <Box sx={{ px: 1 }}>{RetroArchDetails(settings, emu)}</Box>}</Box>;
}

/** @param {import("./settings-types").SettingsPanelProps} settings - Settings panel state and actions. */
function InstalledEmulators(settings) {
  if (settings.installedEmus.length === 0) return null;
  return <><Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Installed</Typography><List dense>{settings.installedEmus.map((emu) => InstalledEmulator(settings, emu))}</List><Menu anchorEl={settings.emuMenuAnchor} open={Boolean(settings.emuMenuAnchor)} onClose={settings.handleEmuMenuClose}><MenuItem onClick={settings.handleLaunchEmulator}><PlayArrowIcon fontSize="small" sx={{ mr: 1 }} />Launch Emulator</MenuItem><MenuItem onClick={settings.handleOpenLocation}><FolderOpenIcon fontSize="small" sx={{ mr: 1 }} />Open Install Location</MenuItem>{settings.selectedEmu?.install_type === "managed" && <MenuItem onClick={settings.handleUninstallEmulator} sx={{ color: "error.main" }}><DeleteIcon fontSize="small" sx={{ mr: 1 }} />Uninstall</MenuItem>}</Menu></>;
}

/** @param {import("./settings-types").SettingsPanelProps} settings - Settings panel state and actions. */
function DownloadableEmulators(settings) {
  if (settings.availableEmus.length === 0) return null;
  return <><Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, mt: 2 }}>Available for Download</Typography><Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>Version and size are shown when the download source reports them; some release details are resolved only when installation starts.</Typography><List dense>{settings.availableEmus.map((emu) => { const progress = settings.emuInstallProgress[emu.id]; const label = progress?.phase === "extract" ? "Extracting…" : progress ? "Downloading…" : "Download"; return <ListItem key={emu.id} sx={{ borderRadius: 2, flexWrap: "wrap" }}><ListItemIcon sx={{ minWidth: 36 }}><CloudDownloadIcon color="primary" /></ListItemIcon><ListItemText primary={emu.name} secondary={<>{`Version: ${emu.version ?? "Not reported"}`}<br />{`Size: ${formatOptionalStorageBytes(emu.download_size_bytes)}`}<br />{emu.is_installed ? "Installed" : "Not installed"}</>} /><Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={() => { settings.handleDownloadEmulator(emu.id); }} disabled={Boolean(progress)}>{label}</Button></ListItem>; })}</List></>;
}

/** @param {import("./settings-types").SettingsPanelProps} settings - Settings panel state and actions. */
function UnavailableEmulators(settings) {
  if (settings.unavailableEmus.length === 0) return null;
  return <><Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, mt: 2 }}>Manual Install Required</Typography><List dense>{settings.unavailableEmus.map((emu) => <ListItem key={emu.id} sx={{ borderRadius: 2, mb: 0.5, opacity: 0.6 }}><ListItemIcon sx={{ minWidth: 36 }}><OpenInNewIcon color="action" fontSize="small" /></ListItemIcon><ListItemText primary={emu.name} secondary="Download manually from the emulator's website" /></ListItem>)}</List></>;
}

/** @param {import("./settings-types").SettingsPanelProps} settings - Settings panel state and actions. */
function EmulatorCatalog(settings) {
  return <Paper sx={{ ...Shared.SETTINGS_CARD_SX, flex: 1, minWidth: 0, overflow: "hidden" }}><EmulatorHeader {...settings} /><>{settings.emuMessage && <Box sx={{ mb: 2 }}><Chip color={settings.emuMessage.type === "error" ? "error" : "success"} label={settings.emuMessage.message} onDelete={() => { settings.setEmuMessage(null); }} /></Box>}{settings.downloadingCore && <Box sx={{ mb: 2 }}>Downloading core…</Box>}<InstalledEmulators {...settings} /><DownloadableEmulators {...settings} /><UnavailableEmulators {...settings} /></></Paper>;
}

/** @param {import("./settings-types").SettingsPanelProps} settings - Settings panel state and actions. */
function NativeControllerCard(settings) {
  return <Paper variant="outlined" data-testid="native-controller-card" sx={{ bgcolor: "rgba(33, 150, 243, 0.04)", borderRadius: 2, mt: 3, p: 2 }}><Box sx={{ alignItems: "center", display: "flex", justifyContent: "space-between", mb: 1 }}><Typography variant="subtitle1"><SportsEsportsIcon color="primary" fontSize="small" /> Eden controller</Typography><Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={settings.loadNativeControllers} disabled={settings.nativeControllerLoading}>Refresh controllers</Button></Box><Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Wingosy uses the native SDL controller identity and applies the saved standard mapping to Eden when you play. Browser gamepad names are not used for this setup.</Typography>{settings.nativeControllerMessage && <Chip color={settings.nativeControllerMessage.type === "error" ? "error" : "success"} label={settings.nativeControllerMessage.message} />}{settings.nativeControllerLoading && <Box sx={{ mt: 1 }}>Loading controllers…</Box>}{!settings.nativeControllerLoading && settings.nativeControllers.length === 0 && !settings.nativeControllerMessage && <Chip color="info" label="No standard SDL controller is connected. Eden will use its defaults until one is connected." />}{settings.nativeControllers.length > 0 && <List dense disablePadding>{settings.nativeControllers.map((controller) => <ListItem key={controller.device_id} disableGutters secondaryAction={<Button size="small" variant={controller.configured ? "outlined" : "contained"} onClick={() => { settings.handleCaptureNativeController(controller.device_id); }}>{controller.configured ? "Update" : "Capture"}</Button>}><ListItemText primary={controller.name} secondary={controller.configured ? "Saved mapping for this SDL hardware model" : "No saved mapping"} /></ListItem>)}</List>}</Paper>;
}

/** @param {import("./settings-types").SettingsPanelProps} settings - Settings panel state and actions. */
function PlatformDefaults(settings) {
  if (settings.platforms.length === 0 || settings.installedEmus.length === 0) return <Paper sx={{ ...Shared.SETTINGS_CARD_GRADIENT_SX, flex: 1, minWidth: 0 }}><Typography variant="h6"><TuneIcon color="primary" /> Platform defaults</Typography><Typography variant="body2" color="text.secondary">Add games to your library and install at least one emulator to choose a default per platform.</Typography></Paper>;
  return <Paper sx={{ ...Shared.SETTINGS_CARD_GRADIENT_SX, flex: 1, minWidth: 0, overflow: "hidden" }}><Typography variant="h6"><TuneIcon color="primary" /> Platform defaults</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Choose the default emulator for each platform.</Typography>{settings.platforms.map(([platform]) => { const compatible = settings.installedEmus.filter((emu) => emu.supported_platforms.includes("*") || emu.supported_platforms.includes(platform.id)); return <Box key={platform.id} sx={{ alignItems: "center", display: "flex", gap: 1, mb: 1 }}><Typography sx={{ flex: 1 }}>{platform.name}</Typography><Select size="small" value={settings.platformDefaults[platform.id] ?? ""} data-testid={`platform-default-${platform.id}`} onChange={(event) => { settings.handleSetDefaultEmulator(platform.id, event.target.value); }} disabled={compatible.length === 0}>{compatible.map((emu) => <MenuItem key={emu.id} value={emu.id}>{emu.name}</MenuItem>)}</Select></Box>; })}</Paper>;
}

/** @param {import("./settings-types").SettingsPanelProps} settings - Settings panel state and actions. */
export default function EmulatorsSettings(settings) {
  return <Box sx={{ alignItems: "flex-start", display: "flex", flexDirection: { lg: "row", xs: "column" }, gap: 3, maxWidth: "100%", minWidth: 0, width: "100%" }}><Box sx={{ flex: 1, minWidth: 0 }}><EmulatorCatalog {...settings} /><NativeControllerCard {...settings} />{settings.missingCores.length > 0 && !settings.installedEmus.some((emu) => emu.id === "retroarch") && <Typography color="warning.main" sx={{ mt: 2 }}>RetroArch support needed for {settings.missingCores.length} game systems</Typography>}</Box><PlatformDefaults {...settings} /></Box>;
}
