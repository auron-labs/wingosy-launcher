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
import { alpha } from "@mui/material/styles";
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
  {
    Icon: DesktopWindowsIcon,
    description: "Display mode, controller input, and support",
    group: "app",
    id: "general",
    label: "General",
  },
  {
    Icon: PaletteIcon,
    description: "Theme mode and accent color",
    group: "app",
    id: "appearance",
    label: "Appearance",
  },
  {
    Icon: VolumeUpIcon,
    description: "UI sounds and background music",
    group: "app",
    id: "sound",
    label: "Sound",
  },
  {
    Icon: SystemUpdateIcon,
    description: "Update channel and install behavior",
    group: "app",
    id: "updates",
    label: "Updates",
  },
  {
    Icon: CloudIcon,
    description: "Server connection and library sync",
    group: "library",
    id: "romm",
    label: "RomM",
  },
  {
    Icon: StorageIcon,
    description: "ROM storage, file locations, and scanning",
    group: "library",
    id: "library",
    label: "Storage",
  },
  {
    Icon: MemoryIcon,
    description: "Firmware downloads and distribution",
    group: "library",
    id: "bios",
    label: "BIOS",
  },
  {
    Icon: SportsEsportsIcon,
    description: "Emulator installs, controllers, and platform defaults",
    group: "library",
    id: "emulators",
    label: "Emulators",
  },
  {
    Icon: EmojiEventsIcon,
    description: "Third-party services such as RetroAchievements",
    group: "library",
    id: "integrations",
    label: "Integrations",
  },
];

const SETTINGS_GROUPS = [
  { id: "app", label: "Application" },
  { id: "library", label: "Library & Emulation" },
];

/** @param {{id: string, label: string, Icon: import("react").ComponentType<{fontSize?: string, color?: string}>, selected: boolean, onSelect: (section: string) => void}} props Settings navigation item properties. */
const SettingsNavigationItem = ({ Icon, id, label, onSelect, selected }) => (
  <ListItemButton
    data-testid={`settings-nav-${id}`}
    onClick={() => {
      onSelect(id);
    }}
    selected={selected}
    sx={{
      "&.Mui-selected::before": {
        backgroundColor: "primary.main",
        borderRadius: 2,
        content: '""',
        display: { md: "block", xs: "none" },
        height: "55%",
        left: 4,
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        width: 3,
      },
      flexShrink: 0,
      position: "relative",
      px: 2,
      py: 1.25,
      whiteSpace: "nowrap",
    }}
  >
    <ListItemIcon sx={{ minWidth: 36 }}>
      <Icon color={selected ? "primary" : "action"} fontSize="small" />
    </ListItemIcon>
    <ListItemText
      primary={label}
      slotProps={{
        primary: {
          sx: { fontWeight: selected ? 600 : 400 },
          variant: "body2",
        },
      }}
    />
  </ListItemButton>
);

/** @param {{settingsSection: string, setSettingsSection: (section: string) => void}} props Settings navigation properties. */
const SettingsNavigation = ({ settingsSection, setSettingsSection }) => (
  <Paper
    component="nav"
    elevation={0}
    variant="outlined"
    sx={{
      alignSelf: { md: "flex-start", xs: "stretch" },
      borderRadius: 2,
      display: "flex",
      flexDirection: { md: "column", xs: "row" },
      flexShrink: 0,
      overflowX: { md: "visible", xs: "auto" },
      overflowY: "hidden",
      width: { md: 232, xs: "100%" },
    }}
  >
    {SETTINGS_GROUPS.map((group) => (
      <Box key={group.id} sx={{ flexShrink: 0 }}>
        <Typography
          variant="overline"
          sx={{
            color: "text.secondary",
            display: { md: "block", xs: "none" },
            fontSize: "0.66rem",
            fontWeight: 700,
            letterSpacing: "0.09em",
            px: 2,
            py: 0.5,
          }}
        >
          {group.label}
        </Typography>
        <List
          disablePadding
          sx={{
            display: "flex",
            flexDirection: { md: "column", xs: "row" },
            px: 0.5,
            py: 0.25,
          }}
        >
          {SETTINGS_SECTIONS.filter(
            (section) => section.group === group.id
          ).map((section) => (
            <SettingsNavigationItem
              Icon={section.Icon}
              id={section.id}
              key={section.id}
              label={section.label}
              onSelect={setSettingsSection}
              selected={settingsSection === section.id}
            />
          ))}
        </List>
      </Box>
    ))}
  </Paper>
);

/** @param {{section: (typeof SETTINGS_SECTIONS)[number]}} props Section header properties. */
const SettingsSectionHeader = ({ section }) => {
  const { description, Icon, label } = section;
  return (
    <Box
      sx={{ alignItems: "center", display: "flex", gap: 1.5, mb: 2, mt: 0.5 }}
    >
      <Box
        sx={{
          alignItems: "center",
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
          borderRadius: 2,
          display: "flex",
          flexShrink: 0,
          p: 1,
        }}
      >
        <Icon color="primary" fontSize="small" />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6">{label}</Typography>
        <Typography color="text.secondary" variant="body2">
          {description}
        </Typography>
      </Box>
    </Box>
  );
};

/** @param {{settings: import("./settings-types").SettingsPanelProps}} props Settings panel properties. */
const SettingsPanel = ({ settings }) => {
  const { settingsSection } = settings;
  const section =
    SETTINGS_SECTIONS.find(({ id }) => id === settingsSection) ??
    SETTINGS_SECTIONS[0];
  return (
    <Box
      sx={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <SettingsSectionHeader section={section} />
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
        {settingsSection === "appearance" && (
          <AppearanceSettings {...settings} />
        )}
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
