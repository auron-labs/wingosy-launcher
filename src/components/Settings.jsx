import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloudIcon from "@mui/icons-material/Cloud";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import DownloadIcon from "@mui/icons-material/Download";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import MemoryIcon from "@mui/icons-material/Memory";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PaletteIcon from "@mui/icons-material/Palette";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import StorageIcon from "@mui/icons-material/Storage";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import TuneIcon from "@mui/icons-material/Tune";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { useState, useEffect, useRef } from "react";

import { ARGOSY_SOUND_ENTRIES } from "../argosySounds";
import {
  DEFAULT_GAMEPAD_DEADZONE,
  GAMEPAD_DEADZONE_MAX,
  GAMEPAD_DEADZONE_MIN,
  normalizeGamepadDeadzone,
} from "../immersive/useGamepadKeyboardMapper";
import { formatDownloadLabel, useRomDownloads } from "../RomDownloadsContext";
import { useAppTheme } from "../ThemeContext";
import { useUiSounds } from "../UiSoundsContext";
import {
  tauriDragRegionProps,
  tauriDragRegionSx,
  tauriNoDragProps,
  tauriNoDragSx,
} from "../utils/isTauri";
import normalizeUrl from "../utils/normalizeUrl";
import AccentHueSlider from "./AccentHueSlider";
import AppVersionField from "./AppVersionField";
import BiosSettings from "./BiosSettings";
import ConfirmDestructiveDialog from "./ConfirmDestructiveDialog";
import KeyboardHint from "./KeyboardHint";
import SettingSlider from "./SettingSlider";
import {
  formatOptionalStorageBytes,
  formatStorageBytes,
} from "./settingsPresentation";
import SyncStatusChip from "./SyncStatusChip";
import {
  UPDATE_PREFERENCE,
  applyUpdatePreference,
  getUpdatePreference,
} from "./updatePreferences";
import GeneralSettings from "./settings-general";
import AppearanceSettings from "./settings-appearance";
import SoundSettings from "./settings-sound";
import RommSettings from "./settings-romm";
import LibrarySettings from "./settings-library";
import BiosSettingsPanel from "./settings-bios";
import EmulatorsSettings from "./settings-emulators";
import IntegrationsSettings from "./settings-integrations";
import UpdatesSettings from "./settings-updates";
import SettingsDialogs from "./settings-dialogs";

/** Full-width cards in the scroll column (avoids uneven widths after flex/scroll changes). */
const SETTINGS_CARD_SX = {
  borderRadius: 3,
  boxSizing: "border-box",
  maxWidth: "100%",
  mb: 3,
  p: 3,
  width: "100%",
};
const SETTINGS_CARD_GRADIENT_SX = {
  ...SETTINGS_CARD_SX,
  background: "linear-gradient(135deg, #1e1e26 0%, #252530 100%)",
};
const BETA_BUG_REPORT_URL =
  "https://github.com/auron-labs/wingosy-launcher/issues/new?template=bug_report.md";

/** @typedef {{type: "error"|"warning"|"info"|"success", message: string}} SettingsMessage */
/** @typedef {{romm?: {server_url?: string, auth_token?: string, auth_method?: string, auto_sync?: boolean}, display?: {big_picture?: boolean, fullscreen?: boolean, controller_deadzone?: number, ui_sounds_enabled?: boolean, accent_hue?: number|null, theme_mode?: string}, audio?: {ambient_enabled?: boolean, ambient_volume?: number, ambient_path?: string|null, ambient_is_folder?: boolean, ambient_shuffle?: boolean, ui_sounds_volume?: number}, updater?: {channel?: "stable"|"beta"|"nightly", auto_update_enabled?: boolean, check_on_startup?: boolean}, library?: {roms_directory?: string|null}, emulators?: {retroarch_use_beta_profile?: boolean}}} SettingsConfig */
/** @typedef {{id: string|number, name: string, display_name?: string, install_type?: string, installed_path?: string|null, is_installed?: boolean, has_download?: boolean, version?: string|null, supported_platforms: string[], download_size_bytes?: number|null}} SettingsEmulator */
/** @typedef {{platform_id: string, platform_name: string, core_filename: string, required?: boolean, status?: string, emulators?: SettingsEmulator[]}} MissingCore */
/** @typedef {{platform_id: string, platform_name?: string, core_filename?: string, is_installed?: boolean, has_download?: boolean, installed_path?: string|null, required?: boolean, status?: string}} CoreInventory */
/** @typedef {{device_id: string, name: string, configured?: boolean, platform_name?: string}} NativeController */
/** @typedef {{id: string, name: string}} SettingsPlatform */
/** @typedef {{id: string|number, name: string, platform_id?: string, local_file_path?: string|null, source?: string, romm_id?: number|null}} SettingsGame */
/** @typedef {{downloaded: number, total: number|null, percent: number|null, filename?: string, phase?: "pending"|"download"|"extract"}} EmulatorInstallProgress */
/** @typedef {{device_code: string, user_code: string, verification_path?: string, verification_path_complete?: string, expires_in?: number, interval?: number}} RommPairing */
/** @typedef {{tracked_rom_count?: number, tracked_rom_bytes?: number, active_rom_downloads?: number, free_disk_bytes?: number, using_default_roms_directory?: boolean, migratable_rom_count?: number, migratable_rom_bytes?: number, roms_directory?: string, locations: Array<{key: string, label: string, path: string, exists: boolean, bytes?: number}>}} StorageOverview */
/** @typedef {{current_version: string, latest_version: string|null, release_url: string|null, signed_update_manifest_url: string|null, is_update_available: boolean, channel: "stable"|"beta"|"nightly", error?: string}} UpdateCheckResult */
/** @typedef {"tap"|"click"|"success"|"error"|"back"|"open"|"close"} SettingsSoundId */

/** Human-friendly name for a libretro DLL (e.g. `mgba_libretro.dll` → "mgba"). */
function formatLibretroDllLabel(dll) {
  if (!dll || typeof dll !== "string") {
    return "";
  }
  return dll.replace(/_libretro\.dll$/i, "").replaceAll("_", " ");
}

const EMPTY_ROMM_SYNC_METADATA = {
  autoSync: false,
  lastSyncedAt: null,
  libraryCount: null,
};
/** @typedef {{autoSync: boolean, lastSyncedAt: string|null, libraryCount: number|null}} RommSyncMetadata */

function formatSyncTimestamp(value) {
  if (!value) {
    return "Not reported";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not reported";
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatSyncLibraryCount(value) {
  return Number.isFinite(value)
    ? `${value.toLocaleString()} games`
    : "Not reported";
}

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

function normalizeSettingsSection(section) {
  if (!section || typeof section !== "string") {
    return "general";
  }
  return SETTINGS_SECTIONS.some((s) => s.id === section) ? section : "general";
}

async function readSettingsConfig() {
  const cfg = /** @type {SettingsConfig|null} */ (await invoke("get_config"));
  if (!cfg) {
    throw new Error("Configuration is unavailable");
  }
  return cfg;
}

/** @param {{rommToken: string|null, rommUrl?: string, onRommConnect: (url: string, token: string) => void, onRommDisconnect?: (() => void)|null, onLibraryChange?: (() => void)|null, onImmersiveModeChange?: ((enabled: boolean) => void)|null, onFullscreenChange?: ((enabled: boolean) => void)|null, onControllerDeadzoneChange?: ((value: number) => void)|null, initialSection?: string}} props */
export default function Settings({
  rommToken,
  rommUrl: rommUrlProp,
  onRommConnect,
  onRommDisconnect = null,
  onLibraryChange,
  onImmersiveModeChange = null,
  onFullscreenChange = null,
  onControllerDeadzoneChange = null,
  initialSection = "general",
}) {
  const { activeCount: activeRomDownloadCount } = useRomDownloads();
  const [config, setConfig] = useState(
    /** @type {SettingsConfig|null} */ (null)
  );
  const [rommUrl, setRommUrl] = useState(rommUrlProp || "");
  const [rommDirectToken, setRommDirectToken] = useState("");
  const [rommDeviceName, setRommDeviceName] = useState("");
  const [rommAuthMode, setRommAuthMode] = useState("pairing");
  const [rommPairing, setRommPairing] = useState(
    /** @type {RommPairing|null} */ (null)
  );
  const pairingAttemptRef = useRef(0);
  const [rommSessionSaved, setRommSessionSaved] = useState(false);
  const [rommConnectionStatus, setRommConnectionStatus] = useState(
    rommUrlProp && rommToken ? "checking" : "not-configured"
  );
  const [rommSyncMetadata, setRommSyncMetadata] = useState(
    /** @type {RommSyncMetadata} */ (EMPTY_ROMM_SYNC_METADATA)
  );
  const [rommStatus, setRommStatus] = useState(
    /** @type {SettingsMessage|null} */ (null)
  );
  const [rommDisconnectDialogOpen, setRommDisconnectDialogOpen] =
    useState(false);
  const [scanMessage, setScanMessage] = useState(
    /** @type {SettingsMessage|null} */ (null)
  );
  const [emulators, setEmulators] = useState(
    /** @type {SettingsEmulator[]} */ ([])
  );
  /** platform_id → default libretro DLL from backend (for RetroArch menu labels). */
  const [retroarchCoreDllByPlatform, setRetroarchCoreDllByPlatform] = useState(
    /** @type {Record<string, string>} */ ({})
  );
  /** Platforms where the mapped RetroArch core exists on disk (see `retroarch_cores`). */
  const [retroarchCoreReadyPlatformIds, setRetroarchCoreReadyPlatformIds] =
    useState(
      /** @type {string[]} */ ([])
    );
  const [retroarchCoreInventory, setRetroarchCoreInventory] = useState(
    /** @type {CoreInventory[]} */ ([])
  );
  /** Per-emulator install progress (`emulator_id` → phase + optional bytes); allows parallel installs. */
  const [emuInstallProgress, setEmuInstallProgress] = useState(
    /** @type {Record<string|number, EmulatorInstallProgress>} */ ({})
  );
  const emuDownloadInflightRef = useRef(new Set());
  const [missingCores, setMissingCores] = useState(
    /** @type {MissingCore[]} */ ([])
  );
  const [downloadingCore, setDownloadingCore] = useState(
    /** @type {string|null} */ (null)
  );
  const [emuMessage, setEmuMessage] = useState(
    /** @type {SettingsMessage|null} */ (null)
  );
  const [emuMenuAnchor, setEmuMenuAnchor] = useState(
    /** @type {HTMLElement|null} */ (null)
  );
  const [selectedEmu, setSelectedEmu] = useState(
    /** @type {SettingsEmulator|null} */ (null)
  );
  const [expandedEmu, setExpandedEmu] = useState(
    /** @type {string|number|null} */ (null)
  );
  const [nativeControllers, setNativeControllers] = useState(
    /** @type {NativeController[]} */ ([])
  );
  const [nativeControllerLoading, setNativeControllerLoading] = useState(false);
  const [nativeControllerCapture, setNativeControllerCapture] = useState(
    /** @type {string|null} */ (null)
  );
  const [nativeControllerMessage, setNativeControllerMessage] = useState(
    /** @type {SettingsMessage|null} */ (null)
  );

  // Hidden games state
  const [hiddenGames, setHiddenGames] = useState(
    /** @type {SettingsGame[]} */ ([])
  );
  const [hiddenDialogOpen, setHiddenDialogOpen] = useState(false);
  const [hiddenLoading, setHiddenLoading] = useState(false);

  // Library directory state
  const [romsDirectory, setRomsDirectory] = useState("");
  const [storageOverview, setStorageOverview] = useState(
    /** @type {StorageOverview|null} */ (null)
  );
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageChangeBusy, setStorageChangeBusy] = useState(false);
  const [pendingRomsDirectory, setPendingRomsDirectory] = useState("");
  const [storageMigrationDialogOpen, setStorageMigrationDialogOpen] =
    useState(false);

  // Platform default emulators
  const [platformDefaults, setPlatformDefaults] = useState(
    /** @type {Record<string, string>} */ ({})
  );
  const [platforms, setPlatforms] = useState(
    /** @type {[SettingsPlatform, number][]} */ ([])
  );

  // UI Mode flags: Desktop (default) vs Immersive mode (`display.big_picture` in config)
  const [immersiveModeEnabled, setImmersiveModeEnabled] = useState(false);
  const [fullscreenEnabled, setFullscreenEnabled] = useState(false);
  const [controllerDeadzone, setControllerDeadzone] = useState(
    DEFAULT_GAMEPAD_DEADZONE
  );

  // Theme/Appearance settings from context
  const { themeMode, setThemeMode, accentHue, setAccentHue } = useAppTheme();
  const {
    uiSoundsEnabled,
    uiSoundsVolume,
    setUiSoundsEnabled,
    setUiSoundsVolume,
    refreshUiSoundsFromConfig,
    previewArgosySound,
  } = useUiSounds();
  const [ambientEnabled, setAmbientEnabled] = useState(false);
  const [ambientVolume, setAmbientVolume] = useState(35);
  const [ambientPath, setAmbientPath] = useState(
    /** @type {string|null} */ (null)
  );
  const [ambientIsFolder, setAmbientIsFolder] = useState(false);
  const [ambientShuffle, setAmbientShuffle] = useState(false);
  const [settingsSection, setSettingsSection] = useState(() =>
    normalizeSettingsSection(initialSection)
  );
  const [appVersion, setAppVersion] = useState("");
  const [supportMessage, setSupportMessage] = useState(
    /** @type {SettingsMessage|null} */ (null)
  );
  const [updatePreference, setUpdatePreference] = useState(
    /** @type {string} */ (UPDATE_PREFERENCE.OFF)
  );
  const [updateChannel, setUpdateChannel] = useState(
    /** @type {"stable"|"beta"|"nightly"} */ ("stable")
  );
  const [updateCheckLoading, setUpdateCheckLoading] = useState(false);
  const [updateCheckResult, setUpdateCheckResult] = useState(
    /** @type {UpdateCheckResult|null} */ (null)
  );
  const [updateMessage, setUpdateMessage] = useState(
    /** @type {SettingsMessage|null} */ (null)
  );
  const [signedUpdateInstalling, setSignedUpdateInstalling] = useState(false);
  const [prereleaseLeaveDialogOpen, setPrereleaseLeaveDialogOpen] =
    useState(false);
  /** Which pre-release channel the user is leaving (`nightly` | `beta`) — drives dialog copy. */
  const [leavingPrereleaseChannel, setLeavingPrereleaseChannel] = useState(
    /** @type {"nightly"|"beta"|null} */ (null)
  );
  const [pendingChannel, setPendingChannel] = useState(
    /** @type {"stable"|"beta"|"nightly"} */ ("stable")
  );

  useEffect(() => {
    loadConfig();
    loadEmulators();
    loadMissingCores();
    loadPlatformDefaults();
    loadPlatforms();
  }, []);

  useEffect(() => {
    if (settingsSection === "emulators") {
      loadNativeControllers();
    }
  }, [settingsSection]);

  useEffect(() => {
    let cancelled = false;
    const unlisteners = [];

    (async () => {
      const safeListen = async (event, handler) => {
        const unlisten = await listen(event, handler);
        if (cancelled) {
          unlisten();
          return;
        }
        unlisteners.push(unlisten);
      };

      await safeListen("emulator-download-started", (event) => {
        const { emulator_id, filename } = event.payload;
        setEmuInstallProgress((prev) => ({
          ...prev,
          [emulator_id]: {
            downloaded: 0,
            filename: filename || "",
            percent: null,
            phase: "download",
            total: null,
          },
        }));
      });

      await safeListen("emulator-download-progress", (event) => {
        const { emulator_id, phase, downloaded, total, percent } =
          event.payload;
        setEmuInstallProgress((prev) => {
          const cur = prev[emulator_id] || {};
          return {
            ...prev,
            [emulator_id]: {
              ...cur,
              downloaded:
                typeof downloaded === "number"
                  ? downloaded
                  : (cur.downloaded ?? 0),
              percent,
              phase: phase === "extract" ? "extract" : "download",
              total,
            },
          };
        });
      });

      await safeListen("emulator-download-complete", (event) => {
        const { emulator_id } = event.payload;
        setEmuInstallProgress((prev) => {
          const next = { ...prev };
          delete next[emulator_id];
          return next;
        });
      });

      await safeListen("emulator-download-error", (event) => {
        const { emulator_id } = event.payload;
        setEmuInstallProgress((prev) => {
          const next = { ...prev };
          delete next[emulator_id];
          return next;
        });
      });
    })();

    return () => {
      cancelled = true;
      unlisteners.forEach((u) => u());
    };
  }, []);

  /** Drop platform default RetroArch when the mapped core DLL is missing (avoids orphan config). */
  useEffect(() => {
    const toClear = Object.entries(platformDefaults).filter(
      ([pid, eid]) =>
        eid === "retroarch" && !retroarchCoreReadyPlatformIds.includes(pid)
    );
    if (toClear.length === 0) {
      return;
    }
    let cancelled = false;
    (async () => {
      for (const [platformId] of toClear) {
        try {
          await invoke("set_platform_default_emulator", {
            emulatorId: null,
            platformId,
          });
          if (!cancelled) {
            setPlatformDefaults((prev) => {
              const next = { ...prev };
              delete next[platformId];
              return next;
            });
          }
        } catch {
          /* ignore */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platformDefaults, retroarchCoreReadyPlatformIds]);

  useEffect(() => {
    invoke("get_app_version")
      .then((v) => {
        setAppVersion(String(v));
      })
      .catch(() => {
        setAppVersion("");
      });
  }, []);

  useEffect(() => {
    invoke("get_default_romm_device_name")
      .then((name) => {
        setRommDeviceName(String(name || "Windows PC"));
      })
      .catch(() => {
        setRommDeviceName("Windows PC");
      });
  }, []);

  useEffect(
    () => () => {
      pairingAttemptRef.current += 1;
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    const checkConnection = async () => {
      if (!rommUrl || !rommToken) {
        if (!cancelled) {
          setRommConnectionStatus("not-configured");
        }
        return;
      }
      if (!cancelled) {
        setRommConnectionStatus("checking");
      }
      try {
        const status = await invoke("check_romm_connection", {
          serverUrl: rommUrl,
          token: rommToken,
        });
        if (cancelled) {
          return;
        }
        if (status === "unauthorized") {
          await invoke("disconnect_romm");
          if (cancelled) {
            return;
          }
          setRommSessionSaved(false);
          setRommConnectionStatus("not-configured");
          setRommSyncMetadata(EMPTY_ROMM_SYNC_METADATA);
          setRommDirectToken("");
          onRommDisconnect?.();
          setRommStatus({
            message:
              "RomM no longer accepts this session, so Wingosy disconnected automatically.",
            type: "info",
          });
          return;
        }
        setRommConnectionStatus(
          status === "online"
            ? "online"
            : status === "not-configured"
              ? "not-configured"
              : "offline"
        );
      } catch {
        if (!cancelled) {
          setRommConnectionStatus("offline");
        }
      }
    };

    checkConnection();
    const timer = window.setInterval(checkConnection, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [rommUrl, rommToken]);

  async function loadConfig() {
    try {
      const cfg = /** @type {SettingsConfig} */ (await invoke("get_config"));
      setConfig(cfg);
      setRommSyncMetadata((previous) => ({
        ...previous,
        autoSync: Boolean(cfg.romm?.auto_sync),
      }));
      setRommUrl(cfg.romm?.server_url || rommUrlProp || "");
      if (
        cfg.romm?.auth_method === "token" ||
        cfg.romm?.auth_method === "pairing"
      ) {
        setRommAuthMode(cfg.romm.auth_method);
      }
      invoke("has_saved_romm_session")
        .then((saved) => {
          setRommSessionSaved(Boolean(saved));
        })
        .catch(() => {
          setRommSessionSaved(false);
        });
      setRomsDirectory(cfg.library?.roms_directory || "");
      setImmersiveModeEnabled(Boolean(cfg.display?.big_picture));
      setFullscreenEnabled(Boolean(cfg.display?.fullscreen));
      setControllerDeadzone(
        normalizeGamepadDeadzone(
          cfg.display?.controller_deadzone ?? DEFAULT_GAMEPAD_DEADZONE
        )
      );
      setUpdatePreference(getUpdatePreference(cfg.updater));
      let ch = cfg.updater?.channel;
      if (ch !== "nightly" && ch !== "beta") {
        ch = "stable";
      }
      setUpdateChannel(ch);
      const a = cfg.audio || {};
      setAmbientEnabled(Boolean(a.ambient_enabled));
      setAmbientVolume(
        typeof a.ambient_volume === "number" ? a.ambient_volume : 35
      );
      setAmbientPath(a.ambient_path || null);
      setAmbientIsFolder(Boolean(a.ambient_is_folder));
      setAmbientShuffle(Boolean(a.ambient_shuffle));
      refreshUiSoundsFromConfig(cfg);
      loadStorageOverview();
    } catch {}
  }

  async function handleOpenLogsFolder() {
    try {
      setSupportMessage(null);
      await invoke("open_logs_folder");
    } catch (error) {
      setSupportMessage({
        type: "error",
        message: error?.message || String(error),
      });
    }
  }

  async function handleReportProblem() {
    try {
      setSupportMessage(null);
      await shellOpen(BETA_BUG_REPORT_URL);
    } catch (error) {
      setSupportMessage({
        type: "error",
        message: error?.message || String(error),
      });
    }
  }

  async function loadStorageOverview() {
    setStorageLoading(true);
    try {
      const overview = await invoke("get_storage_overview");
      setStorageOverview(overview);
      setRomsDirectory(overview.roms_directory || "");
    } catch (error) {
      console.error("Failed to load storage overview:", error);
    } finally {
      setStorageLoading(false);
    }
  }

  async function handleOpenStorageLocation(location) {
    if (!location.exists) {
      return;
    }
    try {
      await shellOpen(location.path);
    } catch (error) {
      setScanMessage({
        type: "error",
        message: `Could not open ${location.label}: ${error.message || String(error)}`,
      });
    }
  }

  /** @param {"stable"|"beta"|"nightly"} nextChannel */
  async function applyUpdateChannel(nextChannel) {
    try {
      const cfg = config ?? (await readSettingsConfig());
      cfg.updater = cfg.updater || {};
      cfg.updater.channel = nextChannel;
      await invoke("save_config", { config: cfg });
      setConfig(cfg);
      setUpdateChannel(nextChannel);
    } catch {}
  }

  /** @param {"stable"|"beta"|"nightly"} nextChannel */
  function requestChannelChange(nextChannel) {
    const leavingPre = updateChannel === "nightly" || updateChannel === "beta";
    if (leavingPre && nextChannel !== updateChannel) {
      setLeavingPrereleaseChannel(updateChannel);
      setPendingChannel(nextChannel);
      setPrereleaseLeaveDialogOpen(true);
      return;
    }
    applyUpdateChannel(nextChannel);
  }

  async function confirmPrereleaseLeave() {
    try {
      const cfg = config ?? (await readSettingsConfig());
      cfg.updater = cfg.updater || {};
      cfg.updater.channel = pendingChannel || "stable";
      await invoke("save_config", { config: cfg });
      setConfig(cfg);
      setUpdateChannel(pendingChannel || "stable");
    } catch {}
    setPrereleaseLeaveDialogOpen(false);
    setLeavingPrereleaseChannel(null);
    setPendingChannel("stable");
  }

  function cancelPrereleaseLeave() {
    setPrereleaseLeaveDialogOpen(false);
    setLeavingPrereleaseChannel(null);
    setPendingChannel("stable");
  }

  async function persistUpdatePreference(nextPreference) {
    try {
      const cfg = config ?? (await readSettingsConfig());
      const nextConfig = applyUpdatePreference(cfg, nextPreference);
      await invoke("save_config", { config: nextConfig });
      setConfig(nextConfig);
      setUpdatePreference(nextPreference);
    } catch {}
  }

  async function handleCheckForUpdates() {
    setUpdateCheckLoading(true);
    setUpdateCheckResult(null);
    setUpdateMessage(null);
    try {
      const r = await invoke("check_for_app_update", {
        channel: updateChannel,
      });
      setUpdateCheckResult(r);
    } catch (error) {
      setUpdateCheckResult({
        current_version: appVersion,
        error: error?.message || String(error),
        is_update_available: false,
        latest_version: null,
        release_url: null,
        signed_update_manifest_url: null,
        channel: updateChannel,
      });
    } finally {
      setUpdateCheckLoading(false);
    }
  }

  async function handleInstallSignedUpdateFromSettings() {
    if (
      !updateCheckResult?.signed_update_manifest_url ||
      signedUpdateInstalling
    ) {
      return;
    }
    setSignedUpdateInstalling(true);
    setUpdateMessage({
      message: "Downloading and installing update…",
      type: "info",
    });
    let unlistenProgress = () => {};
    try {
      unlistenProgress = await listen("signed-updater-progress", (ev) => {
        const d = ev.payload?.downloaded;
        const t = ev.payload?.total;
        const label =
          d != null && t != null && t > 0
            ? `Downloading update… ${Math.min(100, Math.round((d / t) * 100))}%`
            : "Downloading update…";
        setUpdateMessage({ message: label, type: "info" });
      });
    } catch {
      unlistenProgress = () => {};
    }
    try {
      await invoke("install_signed_app_update", { channel: updateChannel });
    } catch (error) {
      setUpdateMessage({
        type: "error",
        message: error?.message || String(error),
      });
      setSignedUpdateInstalling(false);
    } finally {
      unlistenProgress();
    }
  }

  async function persistDisplayFlags(nextImmersive, nextFullscreen) {
    const cfg = config ?? (await readSettingsConfig());
    cfg.display = cfg.display || {};
    cfg.display.big_picture = Boolean(nextImmersive);
    cfg.display.fullscreen = Boolean(nextFullscreen);
    await invoke("save_config", { config: cfg });
    setConfig(cfg);
  }

  async function persistControllerDeadzone(nextDeadzone) {
    const bounded = normalizeGamepadDeadzone(nextDeadzone);
    const cfg = config ?? (await readSettingsConfig());
    cfg.display = cfg.display || {};
    cfg.display.controller_deadzone = bounded;
    await invoke("save_config", { config: cfg });
    setConfig(cfg);
    setControllerDeadzone(bounded);
    onControllerDeadzoneChange?.(bounded);
  }

  async function persistUiSounds(next) {
    try {
      const cfg = config ?? (await readSettingsConfig());
      cfg.display = cfg.display || {};
      cfg.display.ui_sounds_enabled = Boolean(next);
      await invoke("save_config", { config: cfg });
      setConfig(cfg);
      setUiSoundsEnabled(Boolean(next));
      refreshUiSoundsFromConfig(cfg);
      onLibraryChange?.();
    } catch {}
  }

  async function persistUiSoundsVolume(vol) {
    try {
      const cfg = config ?? (await readSettingsConfig());
      cfg.audio = cfg.audio || {};
      cfg.audio.ui_sounds_volume = Math.min(100, Math.max(0, Math.round(vol)));
      await invoke("save_config", { config: cfg });
      setConfig(cfg);
      setUiSoundsVolume(cfg.audio.ui_sounds_volume);
      refreshUiSoundsFromConfig(cfg);
      onLibraryChange?.();
    } catch {}
  }

  async function persistAmbient(partial) {
    try {
      const cfg = config ?? (await readSettingsConfig());
      cfg.audio = { ...cfg.audio, ...partial };
      await invoke("save_config", { config: cfg });
      setConfig(cfg);
      const a = cfg.audio || {};
      if (typeof a.ambient_enabled === "boolean") {
        setAmbientEnabled(a.ambient_enabled);
      }
      if (typeof a.ambient_volume === "number") {
        setAmbientVolume(a.ambient_volume);
      }
      if (a.ambient_path === undefined) {
        setAmbientPath(null);
      } else if (a.ambient_path === null) {
        setAmbientPath(null);
      } else {
        setAmbientPath(a.ambient_path);
      }
      if (typeof a.ambient_is_folder === "boolean") {
        setAmbientIsFolder(a.ambient_is_folder);
      }
      if (typeof a.ambient_shuffle === "boolean") {
        setAmbientShuffle(a.ambient_shuffle);
      }
      refreshUiSoundsFromConfig(cfg);
      onLibraryChange?.();
    } catch {}
  }

  async function pickAmbientFile() {
    try {
      const sel = await open({
        filters: [
          {
            name: "Audio",
            extensions: ["mp3", "ogg", "wav", "flac", "m4a", "opus"],
          },
        ],
        multiple: false,
      });
      if (typeof sel !== "string" || !sel) {
        return;
      }
      await persistAmbient({
        ambient_is_folder: false,
        ambient_path: sel,
      });
    } catch {}
  }

  async function pickAmbientFolder() {
    try {
      const sel = await open({ directory: true, multiple: false });
      if (typeof sel !== "string" || !sel) {
        return;
      }
      await persistAmbient({
        ambient_is_folder: true,
        ambient_path: sel,
      });
    } catch {}
  }

  async function clearAmbientSource() {
    await persistAmbient({
      ambient_enabled: false,
      ambient_is_folder: false,
      ambient_path: null,
      ambient_shuffle: false,
    });
  }

  async function loadEmulators() {
    try {
      const [emus, raCores] = await Promise.all([
        invoke("get_all_emulators"),
        invoke("get_retroarch_default_core_dlls"),
      ]);
      setEmulators(emus);
      setRetroarchCoreDllByPlatform(
        raCores && typeof raCores === "object" ? raCores : {}
      );
    } catch (error) {
      console.error("Failed to load emulators:", error);
    }
  }

  async function loadNativeControllers() {
    setNativeControllerLoading(true);
    try {
      const controllers = await invoke("get_native_controllers");
      setNativeControllers(Array.isArray(controllers) ? controllers : []);
      setNativeControllerMessage(null);
    } catch (error) {
      setNativeControllers([]);
      setNativeControllerMessage({
        type: "warning",
        message: error?.message || String(error),
      });
    } finally {
      setNativeControllerLoading(false);
    }
  }

  async function handleCaptureNativeController(deviceId) {
    setNativeControllerCapture(deviceId);
    setNativeControllerMessage(null);
    try {
      await invoke("capture_native_controller", { deviceId });
      await loadConfig();
      await loadNativeControllers();
      setNativeControllerMessage({
        message: "Controller mapping saved for this SDL hardware model.",
        type: "success",
      });
    } catch (error) {
      setNativeControllerMessage({
        type: "warning",
        message: error?.message || String(error),
      });
    } finally {
      setNativeControllerCapture(null);
    }
  }

  async function loadMissingCores() {
    try {
      const [cores, coreReady, inventory] = await Promise.all([
        invoke("get_missing_cores"),
        invoke("get_platform_ids_with_installed_retroarch_core"),
        invoke("get_retroarch_core_inventory"),
      ]);
      setMissingCores(Array.isArray(cores) ? cores : []);
      setRetroarchCoreReadyPlatformIds(
        Array.isArray(coreReady) ? coreReady : []
      );
      setRetroarchCoreInventory(Array.isArray(inventory) ? inventory : []);
    } catch {}
  }

  async function loadPlatformDefaults() {
    try {
      const defaults = await invoke("get_platform_default_emulators");
      setPlatformDefaults(defaults || {});
    } catch {}
  }

  async function loadPlatforms() {
    try {
      const plats = await invoke("get_platforms_with_games");
      setPlatforms(plats);
    } catch {}
  }

  async function handleSetDefaultEmulator(platformId, emulatorId) {
    try {
      await invoke("set_platform_default_emulator", {
        emulatorId: emulatorId || null,
        platformId,
      });
      setPlatformDefaults((prev) => {
        const next = { ...prev };
        if (emulatorId) {
          next[platformId] = emulatorId;
        } else {
          delete next[platformId];
        }
        return next;
      });
      setEmuMessage({
        message: `Default emulator updated for ${platformId.toUpperCase()}`,
        type: "success",
      });
    } catch (error) {
      setEmuMessage({ type: "error", message: error.message || String(error) });
    }
  }

  async function handleConnectRomM() {
    if (rommSessionSaved || rommConnectionStatus === "online") {
      setRommStatus({
        message:
          "Disconnect the current RomM session before changing authentication methods.",
        type: "info",
      });
      return;
    }
    if (rommAuthMode === "pairing") {
      await handleDevicePairing();
      return;
    }
    try {
      setRommStatus(null);
      const normalizedUrl = normalizeUrl(rommUrl);
      setRommUrl(normalizedUrl);

      if (rommAuthMode !== "token") {
        throw new Error(
          "Use secure device pairing or a RomM client access token."
        );
      }
      const token = await invoke("connect_romm_with_token", {
        deviceName: rommDeviceName.trim() || null,
        serverUrl: normalizedUrl,
        token: rommDirectToken.trim(),
      });
      onRommConnect(normalizedUrl, token);
      setRommSessionSaved(true);
      setRommConnectionStatus("online");
      setRommDirectToken("");
      setRommStatus({
        message: "Connected! Click 'Sync Library' to pull your games.",
        type: "success",
      });
    } catch (error) {
      setRommStatus({ type: "error", message: error.message || String(error) });
    }
  }

  async function handleDisconnectRomM() {
    try {
      cancelDevicePairing();
      setRommStatus(null);
      await invoke("disconnect_romm");
      setRommSessionSaved(false);
      setRommConnectionStatus("not-configured");
      setRommSyncMetadata(EMPTY_ROMM_SYNC_METADATA);
      setRommDirectToken("");
      onRommDisconnect?.();
      setRommStatus({
        message: "Disconnected from RomM and removed the saved credential.",
        type: "success",
      });
    } catch (error) {
      setRommStatus({
        type: "error",
        message: error?.message || String(error),
      });
    }
  }

  async function handleDevicePairing() {
    const attempt = pairingAttemptRef.current + 1;
    pairingAttemptRef.current = attempt;
    try {
      setRommPairing(null);
      setRommStatus({
        message: "Starting secure RomM pairing...",
        type: "info",
      });
      const normalizedUrl = normalizeUrl(rommUrl);
      setRommUrl(normalizedUrl);
      const pairing = await invoke("begin_romm_device_auth", {
        serverUrl: normalizedUrl,
      });
      if (pairingAttemptRef.current !== attempt) {
        return;
      }
      setRommPairing(pairing);
      setRommStatus({
        message: `Approve Wingosy in RomM. Pairing code: ${pairing.user_code}`,
        type: "info",
      });

      await shellOpen(
        pairing.verification_path_complete || pairing.verification_path
      );
      const deadline = Date.now() + Number(pairing.expires_in || 600) * 1000;
      let intervalMs = Math.max(2, Number(pairing.interval || 5)) * 1000;

      while (pairingAttemptRef.current === attempt && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        if (pairingAttemptRef.current !== attempt) {
          return;
        }
        const result = await invoke("poll_romm_device_auth", {
          deviceCode: pairing.device_code,
          serverUrl: normalizedUrl,
        });
        if (result.status === "authorization_pending") {
          continue;
        }
        if (result.status === "slow_down") {
          intervalMs += 5000;
          continue;
        }
        if (result.status === "approved" && result.access_token) {
          onRommConnect(normalizedUrl, result.access_token);
          setRommSessionSaved(true);
          setRommConnectionStatus("online");
          setRommPairing(null);
          setRommStatus({
            message:
              "Wingosy is paired with RomM. Click 'Sync Library' to pull your games.",
            type: "success",
          });
          return;
        }
        if (result.status === "access_denied") {
          throw new Error("RomM pairing was denied.");
        }
        if (result.status === "expired_token") {
          throw new Error("RomM pairing expired. Try again.");
        }
        throw new Error(`RomM pairing failed: ${result.status}`);
      }
      if (pairingAttemptRef.current === attempt) {
        throw new Error("RomM pairing expired. Try again.");
      }
    } catch (error) {
      if (pairingAttemptRef.current !== attempt) return;
      setRommPairing(null);
      setRommStatus({ type: "error", message: error.message || String(error) });
    }
  }

  function cancelDevicePairing() {
    pairingAttemptRef.current += 1;
    setRommPairing(null);
    setRommStatus(null);
  }

  async function handleSyncRomM() {
    if (!rommUrl) {
      setRommStatus({ message: "Enter a server URL first.", type: "error" });
      return;
    }
    try {
      setRommStatus({ message: "Syncing library...", type: "info" });
      const normalizedUrl = normalizeUrl(rommUrl);
      if (!rommToken) {
        setRommStatus({
          message:
            "Pair Wingosy with RomM or connect with a client access token first.",
          type: "error",
        });
        return;
      }
      const games = await invoke("sync_romm_library", {
        serverUrl: normalizedUrl,
        token: rommToken,
      });
      setRommSyncMetadata((previous) => ({
        ...previous,
        lastSyncedAt: new Date().toISOString(),
        libraryCount: Array.isArray(games) ? games.length : null,
      }));
      setRommStatus({
        message: `Synced ${games.length} games from RomM!`,
        type: "success",
      });
      // Refresh sidebar platform counts
      if (onLibraryChange) {
        onLibraryChange();
      }
    } catch (error) {
      setRommStatus({ type: "error", message: error.message || String(error) });
    }
  }

  async function handleScanDirectory() {
    try {
      // If ROM directory is set, scan that. Otherwise, ask user to pick a folder.
      let pathToScan = romsDirectory;
      if (!pathToScan) {
        const selected = await open({ directory: true, multiple: false });
        if (!selected) {
          return;
        }
        pathToScan = selected;
      }

      setScanMessage({ message: `Scanning ${pathToScan}...`, type: "info" });
      const games = await invoke("scan_directory", {
        path: pathToScan,
        recursive: true,
      });
      setScanMessage({
        message: `Found ${games.length} games!`,
        type: "success",
      });
      if (onLibraryChange) {
        onLibraryChange();
      }
    } catch (error) {
      setScanMessage({
        type: "error",
        message: error.message || String(error),
      });
    }
  }

  async function handleScanCustomDirectory() {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected) {
        setScanMessage({ message: `Scanning ${selected}...`, type: "info" });
        const games = await invoke("scan_directory", {
          path: selected,
          recursive: true,
        });
        setScanMessage({
          message: `Found ${games.length} games!`,
          type: "success",
        });
        if (onLibraryChange) {
          onLibraryChange();
        }
      }
    } catch (error) {
      setScanMessage({
        type: "error",
        message: error.message || String(error),
      });
    }
  }

  async function handleChangeRomsDirectory() {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (!selected || selected === romsDirectory) {
        return;
      }

      const overview = await invoke("get_storage_overview");
      setStorageOverview(overview);
      setPendingRomsDirectory(selected);
      if ((overview.migratable_rom_count || 0) > 0) {
        setStorageMigrationDialogOpen(true);
        return;
      }
      await applyRomsDirectoryChange(selected, false);
    } catch (error) {
      setScanMessage({
        type: "error",
        message: error.message || String(error),
      });
    }
  }

  async function handleResetRomsDirectory() {
    if (storageOverview?.using_default_roms_directory) {
      return;
    }
    if (activeRomDownloadCount > 0) {
      setScanMessage({
        message:
          "Wait for active ROM downloads to finish before changing storage.",
        type: "warning",
      });
      return;
    }
    if ((storageOverview?.migratable_rom_count || 0) > 0) {
      setScanMessage({
        message:
          "Use Change to choose whether tracked ROMs should move before returning to the default folder.",
        type: "info",
      });
      return;
    }

    setStorageChangeBusy(true);
    try {
      const currentConfig = config ?? (await readSettingsConfig());
      const nextConfig = {
        ...currentConfig,
        library: { ...currentConfig.library, roms_directory: null },
      };
      await invoke("save_config", { config: nextConfig });
      setConfig(nextConfig);
      await loadStorageOverview();
      onLibraryChange?.();
      setScanMessage({
        message: "Using the default ROM folder.",
        type: "success",
      });
    } catch (error) {
      setScanMessage({
        type: "error",
        message: error.message || String(error),
      });
    } finally {
      setStorageChangeBusy(false);
    }
  }

  async function applyRomsDirectoryChange(directory, migrateExisting) {
    setStorageChangeBusy(true);
    try {
      const result = await invoke("change_roms_directory", {
        migrateExisting,
        newDirectory: directory,
      });
      const cfg = /** @type {SettingsConfig} */ (await invoke("get_config"));
      setConfig(cfg);
      setRomsDirectory(result.new_directory);
      setStorageMigrationDialogOpen(false);
      setPendingRomsDirectory("");
      await loadStorageOverview();
      onLibraryChange?.();

      if (!migrateExisting) {
        setScanMessage({
          message:
            "New downloads will use the new folder. Existing games remain at their current paths.",
          type: "success",
        });
        return;
      }

      const warnings =
        result.missing +
        result.conflicts +
        result.failed +
        result.source_cleanup_failed;
      setScanMessage({
        message: `Moved ${result.moved} game${result.moved === 1 ? "" : "s"}. ${
          warnings > 0
            ? `${result.missing} missing, ${result.conflicts} conflicts, ${result.failed} failed, and ${result.source_cleanup_failed} old copies could not be removed. Existing destination files were not overwritten.`
            : "The new folder is now used for downloads."
        }`,
        type: warnings > 0 ? "warning" : "success",
      });
    } catch (error) {
      setScanMessage({
        type: "error",
        message: error.message || String(error),
      });
    } finally {
      setStorageChangeBusy(false);
    }
  }

  async function handleDownloadEmulator(emuId) {
    if (emuDownloadInflightRef.current.has(emuId)) {
      return;
    }
    emuDownloadInflightRef.current.add(emuId);
    setEmuInstallProgress((prev) => ({
      ...prev,
      [emuId]: {
        downloaded: 0,
        percent: null,
        phase: "pending",
        total: null,
      },
    }));
    setEmuMessage(null);
    try {
      const path = await invoke("download_emulator", { emulatorId: emuId });
      setEmuMessage({
        message: `Installed ${emuId} at ${path}`,
        type: "success",
      });
      await loadEmulators();
      await loadMissingCores();
    } catch (error) {
      setEmuInstallProgress((prev) => {
        const next = { ...prev };
        delete next[emuId];
        return next;
      });
      setEmuMessage({ type: "error", message: error.message || String(error) });
    } finally {
      emuDownloadInflightRef.current.delete(emuId);
    }
  }

  async function handleDownloadCore(coreFilename) {
    try {
      setDownloadingCore(coreFilename);
      setEmuMessage({
        message: `Downloading RetroArch support file ${coreFilename}...`,
        type: "info",
      });
      await invoke("download_retroarch_core", { coreName: coreFilename });
      setEmuMessage({
        message: `Installed RetroArch support file ${coreFilename}`,
        type: "success",
      });
      await loadMissingCores();
    } catch (error) {
      setEmuMessage({ type: "error", message: error.message || String(error) });
    } finally {
      setDownloadingCore(null);
    }
  }

  function handleEmuMenuOpen(event, emu) {
    setEmuMenuAnchor(event.currentTarget);
    setSelectedEmu(emu);
  }

  function handleEmuMenuClose() {
    setEmuMenuAnchor(null);
    setSelectedEmu(null);
  }

  async function handleLaunchEmulator() {
    if (!selectedEmu?.installed_path) {
      return;
    }
    try {
      await invoke("launch_emulator", {
        emulatorPath: selectedEmu.installed_path,
      });
      setEmuMessage({
        message: `Launched ${selectedEmu.name}`,
        type: "success",
      });
    } catch (error) {
      setEmuMessage({ type: "error", message: `Failed to launch: ${error}` });
    }
    handleEmuMenuClose();
  }

  async function handleOpenLocation() {
    if (!selectedEmu?.installed_path) {
      return;
    }
    try {
      await invoke("open_emulator_location", {
        emulatorPath: selectedEmu.installed_path,
      });
    } catch (error) {
      setEmuMessage({
        type: "error",
        message: `Failed to open location: ${error}`,
      });
    }
    handleEmuMenuClose();
  }

  async function handleCopyEmulatorPath(path) {
    if (!path) {
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access is unavailable");
      }
      await navigator.clipboard.writeText(path);
      setEmuMessage({ message: "Emulator path copied.", type: "success" });
    } catch (error) {
      setEmuMessage({
        type: "error",
        message: `Could not copy path: ${error.message || String(error)}`,
      });
    }
  }

  async function handleOpenRetroarchInputSetup() {
    try {
      await invoke("open_retroarch_input_setup");
      setEmuMessage({
        message: "Opened RetroArch input setup.",
        type: "success",
      });
    } catch (error) {
      setEmuMessage({ type: "error", message: error.message || String(error) });
    }
  }

  async function handleResetRetroarchControllerAdditions() {
    try {
      const backup = await invoke("reset_retroarch_controller_additions");
      setEmuMessage({
        message: backup
          ? "Reset Wingosy controller additions. Your RetroArch profiles and remaps were preserved."
          : "No Wingosy controller additions were present.",
        type: "success",
      });
    } catch (error) {
      setEmuMessage({ type: "error", message: error.message || String(error) });
    }
  }

  async function handleRepairRetroarchProfile() {
    try {
      const message = await invoke("repair_retroarch_profile");
      setEmuMessage({
        message: message || "Wingosy RetroArch controller setup repaired.",
        type: "success",
      });
      await loadEmulators();
      await loadMissingCores();
    } catch (error) {
      setEmuMessage({ type: "error", message: error.message || String(error) });
    }
  }

  async function handleRetroarchBetaProfileChange(event) {
    const enabled = event.target.checked;
    try {
      await invoke("set_retroarch_beta_profile", { enabled });
      setConfig((previous) => ({
        ...(previous || {}),
        emulators: {
          ...previous?.emulators,
          retroarch_use_beta_profile: enabled,
        },
      }));
      setEmuMessage({
        message: enabled
          ? "Wingosy controller settings enabled for RetroArch."
          : "Wingosy controller settings disabled.",
        type: "success",
      });
    } catch (error) {
      setEmuMessage({ type: "error", message: error.message || String(error) });
    }
  }

  async function handleUninstallEmulator() {
    if (!selectedEmu?.id) {
      return;
    }

    // Only allow uninstalling managed emulators
    if (selectedEmu.install_type !== "managed") {
      setEmuMessage({
        message: "Can only uninstall emulators installed via Wingosy",
        type: "error",
      });
      handleEmuMenuClose();
      return;
    }

    try {
      setEmuMessage({
        message: `Uninstalling ${selectedEmu.name}...`,
        type: "info",
      });
      await invoke("uninstall_emulator", { emulatorId: selectedEmu.id });
      setEmuMessage({
        message: `Successfully uninstalled ${selectedEmu.name}`,
        type: "success",
      });
      await loadEmulators();
      await loadMissingCores();
    } catch (error) {
      setEmuMessage({
        type: "error",
        message: `Failed to uninstall: ${error}`,
      });
    } finally {
      handleEmuMenuClose();
    }
  }

  // Hidden Games functions
  async function loadHiddenGames() {
    try {
      setHiddenLoading(true);
      const games = await invoke("get_hidden_games");
      setHiddenGames(games);
    } catch (error) {
      console.error("Failed to load hidden games:", error);
    } finally {
      setHiddenLoading(false);
    }
  }

  async function handleUnhideGame(gameId) {
    try {
      await invoke("unhide_game", { gameId });
      setHiddenGames(hiddenGames.filter((g) => g.id !== gameId));
    } catch (error) {
      console.error("Failed to unhide game:", error);
    }
  }

  function handleOpenHiddenDialog() {
    loadHiddenGames();
    setHiddenDialogOpen(true);
  }

  function getInstallTypeLabel(installType) {
    switch (installType) {
      case "steam": {
        return "Steam";
      }
      case "system": {
        return "System";
      }
      case "portable": {
        return "Portable";
      }
      case "managed": {
        return "Wingosy";
      }
      case "external": {
        return "Unverified";
      }
      case "custom": {
        return "Custom";
      }
      default: {
        return "Installed";
      }
    }
  }

  async function handleApplyPaths() {
    try {
      const count = await invoke("apply_detected_paths");
      setEmuMessage({
        message: `Applied ${count} emulator paths to config.`,
        type: "success",
      });
      await loadEmulators();
    } catch (error) {
      setEmuMessage({ type: "error", message: error.message || String(error) });
    }
  }

  const installedEmus = emulators.filter((e) => e.is_installed);
  const availableEmus = emulators.filter(
    (e) => !e.is_installed && e.has_download
  );
  const unavailableEmus = emulators.filter(
    (e) => !e.is_installed && !e.has_download
  );
  const rommSessionActive =
    rommSessionSaved || rommConnectionStatus === "online";
  const rommUrlLocked = rommSessionActive;
  const settings = {
    accentHue, activeRomDownloadCount, ambientEnabled, ambientIsFolder, ambientPath,
    ambientShuffle, ambientVolume, appVersion, applyRomsDirectoryChange,
    availableEmus, cancelDevicePairing, cancelPrereleaseLeave, config,
    confirmPrereleaseLeave, clearAmbientSource,
    controllerDeadzone, downloadingCore, emuInstallProgress, emuMenuAnchor,
    emuMessage, expandedEmu, fullscreenEnabled, handleApplyPaths,
    handleCaptureNativeController, handleChangeRomsDirectory, handleCheckForUpdates,
    handleConnectRomM,
    handleCopyEmulatorPath, handleDownloadCore, handleDownloadEmulator,
    handleEmuMenuClose, handleEmuMenuOpen, handleInstallSignedUpdateFromSettings,
    handleLaunchEmulator, handleOpenLocation, handleOpenLogsFolder,
    handleOpenHiddenDialog, handleOpenRetroarchInputSetup,
    handleOpenStorageLocation, handleRepairRetroarchProfile,
    handleUninstallEmulator,
    handleReportProblem, handleResetRetroarchControllerAdditions,
    handleResetRomsDirectory, handleRetroarchBetaProfileChange,
    handleScanCustomDirectory, handleScanDirectory, handleSetDefaultEmulator,
    handleSyncRomM, handleUnhideGame, handleDisconnectRomM, hiddenDialogOpen,
    hiddenGames, hiddenLoading,
    immersiveModeEnabled, installedEmus, unavailableEmus, leavingPrereleaseChannel,
    missingCores,
    nativeControllerCapture, nativeControllerLoading, nativeControllerMessage,
    nativeControllers, onFullscreenChange, onImmersiveModeChange, onLibraryChange,
    pendingChannel, pendingRomsDirectory, persistAmbient,
    persistControllerDeadzone, persistDisplayFlags, persistUiSounds,
    persistUiSoundsVolume, persistUpdatePreference, pickAmbientFile, pickAmbientFolder,
    requestChannelChange, loadEmulators, loadMissingCores, normalizeGamepadDeadzone,
    defaultGamepadDeadzone: DEFAULT_GAMEPAD_DEADZONE,
    gamepadDeadzoneMin: GAMEPAD_DEADZONE_MIN,
    gamepadDeadzoneMax: GAMEPAD_DEADZONE_MAX,
    argosySoundEntries: ARGOSY_SOUND_ENTRIES, previewArgosySound,
    uiSoundsEnabled, uiSoundsVolume,
    platformDefaults, platforms, prereleaseLeaveDialogOpen,
    retroarchCoreDllByPlatform, retroarchCoreInventory,
    retroarchCoreReadyPlatformIds, rommAuthMode, rommDeviceName, rommDirectToken,
    rommDisconnectDialogOpen, rommPairing, rommSessionActive, rommStatus,
    rommSyncMetadata, rommUrl, rommUrlLocked, romsDirectory, scanMessage, selectedEmu,
    setAccentHue, setAmbientVolume, setControllerDeadzone, setEmuMessage,
    setUiSoundsVolume,
    setExpandedEmu, setFullscreenEnabled, setHiddenDialogOpen,
    setImmersiveModeEnabled, setPendingRomsDirectory, setRommAuthMode,
    setRommDeviceName, setRommDirectToken, setRommDisconnectDialogOpen, setRommUrl,
    setStorageMigrationDialogOpen, setThemeMode, setUpdateMessage,
    getInstallTypeLabel,
    signedUpdateInstalling, storageChangeBusy, storageLoading,
    storageMigrationDialogOpen, storageOverview, supportMessage, themeMode,
    updateChannel, updateCheckLoading, updateCheckResult, updateMessage,
    updatePreference,
  };

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
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          mb: 2,
        }}
      >
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
            status={rommConnectionStatus}
            serverUrl={rommUrl}
            data-testid="settings-sync-status"
          />
        </Box>
      </Box>

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
        <Paper
          component="nav"
          variant="outlined"
          elevation={0}
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
                key={id}
                selected={settingsSection === id}
                onClick={() => {
                  setSettingsSection(id);
                }}
                data-testid={`settings-nav-${id}`}
                sx={{ px: 2, py: 1.25 }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Icon
                    fontSize="small"
                    color={settingsSection === id ? "primary" : "action"}
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

        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            overscrollBehavior: "contain",
            // Negative right margin reclaims the shell padding so the scrollbar
            // hugs the panel column instead of floating 24px away from it.
            mr: { sm: -3, xs: -2 },
          }}
        >
          {settingsSection === "general" && (
            <GeneralSettings settings={settings} />
          )}

          {settingsSection === "appearance" && (
            <AppearanceSettings settings={settings} />
          )}

          {settingsSection === "sound" && (
            <SoundSettings settings={settings} />
          )}

          {settingsSection === "romm" && (
            <RommSettings settings={settings} />
          )}

          {settingsSection === "library" && (
            <LibrarySettings settings={settings} />
          )}

          {settingsSection === "bios" && (
            <BiosSettingsPanel settings={settings} />
          )}

          {settingsSection === "emulators" && (
            <EmulatorsSettings settings={settings} />
          )}

          {settingsSection === "integrations" && (
            <IntegrationsSettings settings={settings} />
          )}

          {settingsSection === "updates" && (
            <UpdatesSettings settings={settings} />
          )}
        </Box>
      </Box>

      <SettingsDialogs settings={settings} />
    </Box>
  );
}
