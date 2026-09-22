import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloudIcon from "@mui/icons-material/Cloud";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import MemoryIcon from "@mui/icons-material/Memory";
import PaletteIcon from "@mui/icons-material/Palette";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import StorageIcon from "@mui/icons-material/Storage";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useEffect, useRef } from "react";

import {
  tauriDragRegionProps,
  tauriDragRegionSx,
  tauriNoDragProps,
  tauriNoDragSx,
} from "../utils/is-tauri";
import AppearanceSettings from "./settings-appearance";
import BiosSettingsPanel from "./settings-bios";
import SettingsDialogs from "./settings-dialogs";
import EmulatorsSettings from "./settings-emulators";
import GeneralSettings from "./settings-general";
import IntegrationsSettings from "./settings-integrations";
import LibrarySettings from "./settings-library";
import RommSettings from "./settings-romm";
import SoundSettings from "./settings-sound";
import UpdatesSettings from "./settings-updates";
import SyncStatusChip from "./sync-status-chip";
import useSettingsController from "./use-settings-controller";

const SETTINGS_SECTIONS = [
  { Icon: DesktopWindowsIcon, id: "general", label: "General" },
  { Icon: PaletteIcon, id: "appearance", label: "Appearance" },
  { Icon: VolumeUpIcon, id: "sound", label: "Sound" },
  { Icon: CloudIcon, id: "romm", label: "RomM" },
  { Icon: StorageIcon, id: "library", label: "Storage" },
  { Icon: MemoryIcon, id: "bios", label: "BIOS" },
  { Icon: SportsEsportsIcon, id: "emulators", label: "Emulators" },
  { Icon: EmojiEventsIcon, id: "integrations", label: "Integrations" },
  { Icon: SystemUpdateIcon, id: "updates", label: "Updates" },
];

/** @param {{settingsSection: string, setSettingsSection: (section: string) => void}} props Settings navigation properties. */
const SettingsNavigation = ({ settingsSection, setSettingsSection }) => (
  <Paper
    component="nav"
    elevation={0}
    variant="outlined"
    sx={{
      alignSelf: { md: "flex-start", xs: "stretch" },
      borderRadius: 2,
      flexShrink: 0,
      overflow: "hidden",
      width: { md: 232, xs: "100%" },
    }}
  >
    <List disablePadding sx={{ py: 0.5 }}>
      {SETTINGS_SECTIONS.map(({ id, label, Icon }) => (
        <ListItemButton
          data-testid={`settings-nav-${id}`}
          key={id}
          onClick={() => {
            setSettingsSection(id);
          }}
          selected={settingsSection === id}
          sx={{ px: 2, py: 1.25 }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <Icon
              color={settingsSection === id ? "primary" : "action"}
              fontSize="small"
            />
          </ListItemIcon>
          <ListItemText
            primary={label}
            slotProps={{
              primary: {
                sx: { fontWeight: settingsSection === id ? 600 : 400 },
                variant: "body2",
              },
            }}
          />
        </ListItemButton>
      ))}
    </List>
  </Paper>
);

/** @param {{settings: import("./settings-types").SettingsPanelProps}} props Settings panel properties. */
const SettingsPanel = ({ settings }) => {
  const { settingsSection } = settings;
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        mr: { sm: -3, xs: -2 },
        overflowX: "hidden",
        overflowY: "auto",
        overscrollBehavior: "contain",
        // Negative right margin reclaims the shell padding so the scrollbar
        // hugs the panel column instead of floating 24px away from it.
      }}
    >
      {settingsSection === "general" && <GeneralSettings {...settings} />}
      {settingsSection === "appearance" && <AppearanceSettings {...settings} />}
      {settingsSection === "sound" && <SoundSettings {...settings} />}
      {settingsSection === "romm" && <RommSettings {...settings} />}
      {settingsSection === "library" && <LibrarySettings {...settings} />}
      {settingsSection === "bios" && <BiosSettingsPanel {...settings} />}
      {settingsSection === "emulators" && <EmulatorsSettings {...settings} />}
      {settingsSection === "integrations" && (
        <IntegrationsSettings {...settings} />
      )}
      {settingsSection === "updates" && <UpdatesSettings {...settings} />}
    </Box>
  );
};

/** @param {{onNavigate?: (view: string) => void, settings: Pick<import("./settings-types").SettingsPanelProps, "rommConnectionStatus"|"rommUrl">}} props Settings header properties. */
const SettingsHeader = ({ onNavigate, settings }) => (
  <Box
    sx={{
      alignItems: "center",
      display: "flex",
      flexWrap: "wrap",
      gap: 2,
      mb: 2,
    }}
  >
    {onNavigate ? (
      <Button
        {...tauriNoDragProps()}
        color="inherit"
        data-argosy-sound="back"
        onClick={() => {
          onNavigate("library");
        }}
        startIcon={<ArrowBackIcon />}
        sx={{ ...tauriNoDragSx, flexShrink: 0 }}
      >
        Back to Library
      </Button>
    ) : null}
    <Box
      {...tauriDragRegionProps()}
      sx={{
        alignItems: "center",
        display: "flex",
        flex: 1,
        minHeight: 40,
        minWidth: 120,
        ...tauriDragRegionSx,
      }}
    >
      <Typography variant="h4" sx={{ mb: 0 }}>
        Settings
      </Typography>
    </Box>
    <Box {...tauriNoDragProps()} sx={{ ...tauriNoDragSx, flexShrink: 0 }}>
      <SyncStatusChip
        status={settings.rommConnectionStatus}
        serverUrl={settings.rommUrl}
        data-testid="settings-sync-status"
      />
    </Box>
  </Box>
);

/** @param {{settingsSection: string, loadNativeControllers: () => void|Promise<void>}} props Emulator section loading properties. */
const useEmulatorSectionLoading = ({
  loadNativeControllers,
  settingsSection,
}) => {
  const loadNativeControllersRef = useRef(loadNativeControllers);
  useEffect(() => {
    loadNativeControllersRef.current = loadNativeControllers;
  }, [loadNativeControllers]);
  useEffect(() => {
    if (settingsSection !== "emulators") {
      return;
    }
    queueMicrotask(() => {
      void loadNativeControllersRef.current();
    });
  }, [settingsSection]);
};

/** @param {{rommToken: string|null, rommUrl?: string, onRommConnect?: (url: string, token: string) => void, onRommDisconnect?: (() => void)|null, onLibraryChange?: (() => void|Promise<void>)|null, onImmersiveModeChange?: ((enabled: boolean) => void)|null, onFullscreenChange?: ((enabled: boolean) => void)|null, onRetroAchievementsChange?: ((enabled: boolean) => void)|null, onControllerDeadzoneChange?: ((value: number) => void)|null, onNavigate?: (view: string) => void, onBack?: () => void, initialSection?: string, dependencies?: Partial<import("./settings-runtime").SettingsRuntime>}} props Settings properties. */
const Settings = ({ onNavigate, ...props }) => {
  const settings = useSettingsController(props);
  const { settingsSection, setSettingsSection } = settings;
  useEmulatorSectionLoading({
    loadNativeControllers: settings.loadNativeControllers,
    settingsSection,
  });

  return (
    <Box
      sx={{
        boxSizing: "border-box",
        display: "flex",
        flex: 1,
        flexDirection: "column",
        maxWidth: 1760,
        minHeight: 0,
        mx: "auto",
        p: { sm: 3, xs: 2 },
        width: "100%",
      }}
    >
      <SettingsHeader onNavigate={onNavigate} settings={settings} />

      <Box
        sx={{
          display: "flex",
          flex: 1,
          flexDirection: { md: "row", xs: "column" },
          gap: 2,
          minHeight: 0,
          mt: 1,
        }}
      >
        <SettingsNavigation
          setSettingsSection={setSettingsSection}
          settingsSection={settingsSection}
        />
        <SettingsPanel settings={settings} />
      </Box>

      <SettingsDialogs {...settings} />
    </Box>
  );
};

export default Settings;
