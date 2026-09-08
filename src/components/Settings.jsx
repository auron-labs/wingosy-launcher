import { useState, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Paper from "@mui/material/Paper";
import Alert from "@mui/material/Alert";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemButton from "@mui/material/ListItemButton";
import LinearProgress from "@mui/material/LinearProgress";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Collapse from "@mui/material/Collapse";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import CloudIcon from "@mui/icons-material/Cloud";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DownloadIcon from "@mui/icons-material/Download";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import MemoryIcon from "@mui/icons-material/Memory";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import DeleteIcon from "@mui/icons-material/Delete";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import RadioGroup from "@mui/material/RadioGroup";
import Radio from "@mui/material/Radio";
import TuneIcon from "@mui/icons-material/Tune";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import PaletteIcon from "@mui/icons-material/Palette";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import StorageIcon from "@mui/icons-material/Storage";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { useAppTheme } from "../ThemeContext";
import { useUiSounds } from "../UiSoundsContext";
import AccentHueSlider from "./AccentHueSlider";
import SettingSlider from "./SettingSlider";
import AppVersionField from "./AppVersionField";
import {
  UPDATE_PREFERENCE,
  applyUpdatePreference,
  getUpdatePreference,
} from "./updatePreferences";
import BiosSettings from "./BiosSettings";
import ConfirmDestructiveDialog from "./ConfirmDestructiveDialog";
import SyncStatusChip from "./SyncStatusChip";
import KeyboardHint from "./KeyboardHint";
import { open } from "@tauri-apps/plugin-dialog";
import normalizeUrl from "../utils/normalizeUrl";
import { tauriDragRegionProps, tauriDragRegionSx, tauriNoDragProps, tauriNoDragSx } from "../utils/isTauri";
import { formatDownloadLabel, useRomDownloads } from "../RomDownloadsContext";
import { formatOptionalStorageBytes, formatStorageBytes } from "./settingsPresentation";
import { ARGOSY_SOUND_ENTRIES } from "../argosySounds";
import {
  DEFAULT_GAMEPAD_DEADZONE,
  GAMEPAD_DEADZONE_MAX,
  GAMEPAD_DEADZONE_MIN,
  normalizeGamepadDeadzone,
} from "../immersive/useGamepadKeyboardMapper";

/** Full-width cards in the scroll column (avoids uneven widths after flex/scroll changes). */
const SETTINGS_CARD_SX = {
  p: 3,
  mb: 3,
  borderRadius: 3,
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
};
const SETTINGS_CARD_GRADIENT_SX = {
  ...SETTINGS_CARD_SX,
  background: "linear-gradient(135deg, #1e1e26 0%, #252530 100%)",
};
const BETA_BUG_REPORT_URL =
  "https://github.com/auron-labs/wingosy-launcher/issues/new?template=bug_report.md";

/** Human-friendly name for a libretro DLL (e.g. `mgba_libretro.dll` → "mgba"). */
function formatLibretroDllLabel(dll) {
  if (!dll || typeof dll !== "string") return "";
  return dll.replace(/_libretro\.dll$/i, "").replace(/_/g, " ");
}

const EMPTY_ROMM_SYNC_METADATA = {
  lastSyncedAt: null,
  libraryCount: null,
  autoSync: false,
};

function formatSyncTimestamp(value) {
  if (!value) return "Not reported";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not reported";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatSyncLibraryCount(value) {
  return Number.isFinite(value) ? `${value.toLocaleString()} games` : "Not reported";
}

const SETTINGS_SECTIONS = [
  { id: "general", label: "General", Icon: DesktopWindowsIcon },
  { id: "appearance", label: "Appearance", Icon: PaletteIcon },
  { id: "sound", label: "Sound", Icon: VolumeUpIcon },
  { id: "romm", label: "RomM", Icon: CloudIcon },
  { id: "library", label: "Storage", Icon: StorageIcon },
  { id: "bios", label: "BIOS", Icon: MemoryIcon },
  { id: "emulators", label: "Emulators", Icon: SportsEsportsIcon },
  { id: "integrations", label: "Integrations", Icon: EmojiEventsIcon },
  { id: "updates", label: "Updates", Icon: SystemUpdateIcon },
];

function normalizeSettingsSection(section) {
  if (!section || typeof section !== "string") return "general";
  return SETTINGS_SECTIONS.some((s) => s.id === section) ? section : "general";
}

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
  const [config, setConfig] = useState(null);
  const [rommUrl, setRommUrl] = useState(rommUrlProp || "");
  const [rommDirectToken, setRommDirectToken] = useState("");
  const [rommDeviceName, setRommDeviceName] = useState("");
  const [rommAuthMode, setRommAuthMode] = useState("pairing");
  const [rommPairing, setRommPairing] = useState(null);
  const pairingAttemptRef = useRef(0);
  const [rommSessionSaved, setRommSessionSaved] = useState(false);
  const [rommConnectionStatus, setRommConnectionStatus] = useState(
    rommUrlProp && rommToken ? "checking" : "not-configured"
  );
  const [rommSyncMetadata, setRommSyncMetadata] = useState(EMPTY_ROMM_SYNC_METADATA);
  const [rommStatus, setRommStatus] = useState(null);
  const [rommDisconnectDialogOpen, setRommDisconnectDialogOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState(null);
  const [emulators, setEmulators] = useState([]);
  /** platform_id → default libretro DLL from backend (for RetroArch menu labels). */
  const [retroarchCoreDllByPlatform, setRetroarchCoreDllByPlatform] = useState({});
  /** Platforms where the mapped RetroArch core exists on disk (see `retroarch_cores`). */
  const [retroarchCoreReadyPlatformIds, setRetroarchCoreReadyPlatformIds] = useState([]);
  const [retroarchCoreInventory, setRetroarchCoreInventory] = useState([]);
  /** Per-emulator install progress (`emulator_id` → phase + optional bytes); allows parallel installs. */
  const [emuInstallProgress, setEmuInstallProgress] = useState({});
  const emuDownloadInflightRef = useRef(new Set());
  const [missingCores, setMissingCores] = useState([]);
  const [downloadingCore, setDownloadingCore] = useState(null);
  const [emuMessage, setEmuMessage] = useState(null);
  const [emuMenuAnchor, setEmuMenuAnchor] = useState(null);
  const [selectedEmu, setSelectedEmu] = useState(null);
  const [expandedEmu, setExpandedEmu] = useState(null);
  const [nativeControllers, setNativeControllers] = useState([]);
  const [nativeControllerLoading, setNativeControllerLoading] = useState(false);
  const [nativeControllerCapture, setNativeControllerCapture] = useState(null);
  const [nativeControllerMessage, setNativeControllerMessage] = useState(null);
  
  // Hidden games state
  const [hiddenGames, setHiddenGames] = useState([]);
  const [hiddenDialogOpen, setHiddenDialogOpen] = useState(false);
  const [hiddenLoading, setHiddenLoading] = useState(false);
  
  // Library directory state
  const [romsDirectory, setRomsDirectory] = useState("");
  const [storageOverview, setStorageOverview] = useState(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageChangeBusy, setStorageChangeBusy] = useState(false);
  const [pendingRomsDirectory, setPendingRomsDirectory] = useState("");
  const [storageMigrationDialogOpen, setStorageMigrationDialogOpen] = useState(false);
  
  // Platform default emulators
  const [platformDefaults, setPlatformDefaults] = useState({});
  const [platforms, setPlatforms] = useState([]);
  
  // UI Mode flags: Desktop (default) vs Immersive mode (`display.big_picture` in config)
  const [immersiveModeEnabled, setImmersiveModeEnabled] = useState(false);
  const [fullscreenEnabled, setFullscreenEnabled] = useState(false);
  const [controllerDeadzone, setControllerDeadzone] = useState(DEFAULT_GAMEPAD_DEADZONE);
  
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
  const [ambientPath, setAmbientPath] = useState(null);
  const [ambientIsFolder, setAmbientIsFolder] = useState(false);
  const [ambientShuffle, setAmbientShuffle] = useState(false);
  const [settingsSection, setSettingsSection] = useState(() =>
    normalizeSettingsSection(initialSection)
  );
  const [appVersion, setAppVersion] = useState("");
  const [supportMessage, setSupportMessage] = useState(null);
  const [updatePreference, setUpdatePreference] = useState(
    /** @type {string} */ (UPDATE_PREFERENCE.OFF)
  );
  const [updateChannel, setUpdateChannel] = useState("stable");
  const [updateCheckLoading, setUpdateCheckLoading] = useState(false);
  const [updateCheckResult, setUpdateCheckResult] = useState(null);
  const [updateMessage, setUpdateMessage] = useState(null);
  const [signedUpdateInstalling, setSignedUpdateInstalling] = useState(false);
  const [prereleaseLeaveDialogOpen, setPrereleaseLeaveDialogOpen] = useState(false);
  /** Which pre-release channel the user is leaving (`nightly` | `beta`) — drives dialog copy. */
  const [leavingPrereleaseChannel, setLeavingPrereleaseChannel] = useState(null);
  const [pendingChannel, setPendingChannel] = useState("stable");

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
            phase: "download",
            downloaded: 0,
            total: null,
            percent: null,
            filename: filename || "",
          },
        }));
      });

      await safeListen("emulator-download-progress", (event) => {
        const { emulator_id, phase, downloaded, total, percent } = event.payload;
        setEmuInstallProgress((prev) => {
          const cur = prev[emulator_id] || {};
          return {
            ...prev,
            [emulator_id]: {
              ...cur,
              phase: phase === "extract" ? "extract" : "download",
              downloaded: typeof downloaded === "number" ? downloaded : cur.downloaded ?? 0,
              total,
              percent,
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
      ([pid, eid]) => eid === "retroarch" && !retroarchCoreReadyPlatformIds.includes(pid),
    );
    if (toClear.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const [platformId] of toClear) {
        try {
          await invoke("set_platform_default_emulator", { platformId, emulatorId: null });
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
      .then((v) => setAppVersion(String(v)))
      .catch(() => setAppVersion(""));
  }, []);

  useEffect(() => {
    invoke("get_default_romm_device_name")
      .then((name) => setRommDeviceName(String(name || "Windows PC")))
      .catch(() => setRommDeviceName("Windows PC"));
  }, []);

  useEffect(() => () => {
    pairingAttemptRef.current += 1;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const checkConnection = async () => {
      if (!rommUrl || !rommToken) {
        if (!cancelled) setRommConnectionStatus("not-configured");
        return;
      }
      if (!cancelled) setRommConnectionStatus("checking");
      try {
        const status = await invoke("check_romm_connection", { serverUrl: rommUrl, token: rommToken });
        if (cancelled) return;
        if (status === "unauthorized") {
          await invoke("disconnect_romm");
          if (cancelled) return;
          setRommSessionSaved(false);
          setRommConnectionStatus("not-configured");
          setRommSyncMetadata(EMPTY_ROMM_SYNC_METADATA);
          setRommDirectToken("");
          onRommDisconnect?.();
          setRommStatus({
            type: "info",
            message: "RomM no longer accepts this session, so Wingosy disconnected automatically.",
          });
          return;
        }
        setRommConnectionStatus(status === "online" ? "online" : status === "not-configured" ? "not-configured" : "offline");
      } catch {
        if (!cancelled) setRommConnectionStatus("offline");
      }
    };

    checkConnection();
    const timer = window.setInterval(checkConnection, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [rommUrl, rommToken]);

  async function loadConfig() {
    try {
      const cfg = await invoke("get_config");
      setConfig(cfg);
      setRommSyncMetadata((previous) => ({ ...previous, autoSync: Boolean(cfg.romm?.auto_sync) }));
      setRommUrl(cfg.romm?.server_url || rommUrlProp || "");
      if (cfg.romm?.auth_method === "token" || cfg.romm?.auth_method === "pairing") {
        setRommAuthMode(cfg.romm.auth_method);
      }
      invoke("has_saved_romm_session")
        .then((saved) => setRommSessionSaved(Boolean(saved)))
        .catch(() => setRommSessionSaved(false));
      setRomsDirectory(cfg.library?.roms_directory || "");
      setImmersiveModeEnabled(Boolean(cfg.display?.big_picture));
      setFullscreenEnabled(Boolean(cfg.display?.fullscreen));
      setControllerDeadzone(
        normalizeGamepadDeadzone(cfg.display?.controller_deadzone ?? DEFAULT_GAMEPAD_DEADZONE),
      );
      setUpdatePreference(getUpdatePreference(cfg.updater));
      let ch = cfg.updater?.channel;
      if (ch !== "nightly" && ch !== "beta") ch = "stable";
      setUpdateChannel(ch);
      const a = cfg.audio || {};
      setAmbientEnabled(Boolean(a.ambient_enabled));
      setAmbientVolume(typeof a.ambient_volume === "number" ? a.ambient_volume : 35);
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
    } catch (err) {
      setSupportMessage({ type: "error", message: err?.message || String(err) });
    }
  }

  async function handleReportProblem() {
    try {
      setSupportMessage(null);
      await shellOpen(BETA_BUG_REPORT_URL);
    } catch (err) {
      setSupportMessage({ type: "error", message: err?.message || String(err) });
    }
  }

  async function loadStorageOverview() {
    setStorageLoading(true);
    try {
      const overview = await invoke("get_storage_overview");
      setStorageOverview(overview);
      setRomsDirectory(overview.roms_directory || "");
    } catch (err) {
      console.error("Failed to load storage overview:", err);
    } finally {
      setStorageLoading(false);
    }
  }

  async function handleOpenStorageLocation(location) {
    if (!location.exists) return;
    try {
      await shellOpen(location.path);
    } catch (err) {
      setScanMessage({ type: "error", message: `Could not open ${location.label}: ${err.message || String(err)}` });
    }
  }

  async function applyUpdateChannel(nextChannel) {
    try {
      const cfg = config || (await invoke("get_config"));
      cfg.updater = cfg.updater || {};
      cfg.updater.channel = nextChannel;
      await invoke("save_config", { config: cfg });
      setConfig(cfg);
      setUpdateChannel(nextChannel);
    } catch {}
  }

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
      const cfg = config || (await invoke("get_config"));
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
      const cfg = config || (await invoke("get_config"));
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
      const r = await invoke("check_for_app_update", { channel: updateChannel });
      setUpdateCheckResult(r);
    } catch (err) {
      setUpdateCheckResult({
        current_version: appVersion,
        error: err?.message || String(err),
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
    if (!updateCheckResult?.signed_update_manifest_url || signedUpdateInstalling) return;
    setSignedUpdateInstalling(true);
    setUpdateMessage({ type: "info", message: "Downloading and installing update…" });
    let unlistenProgress = () => {};
    try {
      unlistenProgress = await listen("signed-updater-progress", (ev) => {
        const d = ev.payload?.downloaded;
        const t = ev.payload?.total;
        const label =
          d != null && t != null && t > 0
            ? `Downloading update… ${Math.min(100, Math.round((d / t) * 100))}%`
            : "Downloading update…";
        setUpdateMessage({ type: "info", message: label });
      });
    } catch {
      unlistenProgress = () => {};
    }
    try {
      await invoke("install_signed_app_update", { channel: updateChannel });
    } catch (err) {
      setUpdateMessage({ type: "error", message: err?.message || String(err) });
      setSignedUpdateInstalling(false);
    } finally {
      unlistenProgress();
    }
  }

  async function persistDisplayFlags(nextImmersive, nextFullscreen) {
    const cfg = config || (await invoke("get_config"));
    cfg.display = cfg.display || {};
    cfg.display.big_picture = Boolean(nextImmersive);
    cfg.display.fullscreen = Boolean(nextFullscreen);
    await invoke("save_config", { config: cfg });
    setConfig(cfg);
  }

  async function persistControllerDeadzone(nextDeadzone) {
    const bounded = normalizeGamepadDeadzone(nextDeadzone);
    const cfg = config || (await invoke("get_config"));
    cfg.display = cfg.display || {};
    cfg.display.controller_deadzone = bounded;
    await invoke("save_config", { config: cfg });
    setConfig(cfg);
    setControllerDeadzone(bounded);
    onControllerDeadzoneChange?.(bounded);
  }


  async function persistUiSounds(next) {
    try {
      const cfg = config || (await invoke("get_config"));
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
      const cfg = config || (await invoke("get_config"));
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
      const cfg = config || (await invoke("get_config"));
      cfg.audio = { ...(cfg.audio || {}), ...partial };
      await invoke("save_config", { config: cfg });
      setConfig(cfg);
      const a = cfg.audio || {};
      if (typeof a.ambient_enabled === "boolean") setAmbientEnabled(a.ambient_enabled);
      if (typeof a.ambient_volume === "number") setAmbientVolume(a.ambient_volume);
      if (a.ambient_path === undefined) setAmbientPath(null);
      else if (a.ambient_path === null) setAmbientPath(null);
      else setAmbientPath(a.ambient_path);
      if (typeof a.ambient_is_folder === "boolean") setAmbientIsFolder(a.ambient_is_folder);
      if (typeof a.ambient_shuffle === "boolean") setAmbientShuffle(a.ambient_shuffle);
      refreshUiSoundsFromConfig(cfg);
      onLibraryChange?.();
    } catch {}
  }

  async function pickAmbientFile() {
    try {
      const sel = await open({
        multiple: false,
        filters: [{ name: "Audio", extensions: ["mp3", "ogg", "wav", "flac", "m4a", "opus"] }],
      });
      if (typeof sel !== "string" || !sel) return;
      await persistAmbient({
        ambient_path: sel,
        ambient_is_folder: false,
      });
    } catch {}
  }

  async function pickAmbientFolder() {
    try {
      const sel = await open({ directory: true, multiple: false });
      if (typeof sel !== "string" || !sel) return;
      await persistAmbient({
        ambient_path: sel,
        ambient_is_folder: true,
      });
    } catch {}
  }

  async function clearAmbientSource() {
    await persistAmbient({
      ambient_path: null,
      ambient_is_folder: false,
      ambient_shuffle: false,
      ambient_enabled: false,
    });
  }

  async function loadEmulators() {
    try {
      const [emus, raCores] = await Promise.all([
        invoke("get_all_emulators"),
        invoke("get_retroarch_default_core_dlls"),
      ]);
      setEmulators(emus);
      setRetroarchCoreDllByPlatform(raCores && typeof raCores === "object" ? raCores : {});
    } catch (err) {
      console.error("Failed to load emulators:", err);
    }
  }

  async function loadNativeControllers() {
    setNativeControllerLoading(true);
    try {
      const controllers = await invoke("get_native_controllers");
      setNativeControllers(Array.isArray(controllers) ? controllers : []);
      setNativeControllerMessage(null);
    } catch (err) {
      setNativeControllers([]);
      setNativeControllerMessage({
        type: "warning",
        message: err?.message || String(err),
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
        type: "success",
        message: "Controller mapping saved for this SDL hardware model.",
      });
    } catch (err) {
      setNativeControllerMessage({
        type: "warning",
        message: err?.message || String(err),
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
      setRetroarchCoreReadyPlatformIds(Array.isArray(coreReady) ? coreReady : []);
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
        platformId, 
        emulatorId: emulatorId || null 
      });
      setPlatformDefaults(prev => {
        const next = { ...prev };
        if (emulatorId) {
          next[platformId] = emulatorId;
        } else {
          delete next[platformId];
        }
        return next;
      });
      setEmuMessage({ type: "success", message: `Default emulator updated for ${platformId.toUpperCase()}` });
    } catch (err) {
      setEmuMessage({ type: "error", message: err.message || String(err) });
    }
  }

  async function handleConnectRomM() {
    if (rommSessionSaved || rommConnectionStatus === "online") {
      setRommStatus({ type: "info", message: "Disconnect the current RomM session before changing authentication methods." });
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
        throw new Error("Use secure device pairing or a RomM client access token.");
      }
      const token = await invoke("connect_romm_with_token", {
        serverUrl: normalizedUrl,
        token: rommDirectToken.trim(),
        deviceName: rommDeviceName.trim() || null,
      });
      onRommConnect(normalizedUrl, token);
      setRommSessionSaved(true);
      setRommConnectionStatus("online");
      setRommDirectToken("");
      setRommStatus({ type: "success", message: "Connected! Click 'Sync Library' to pull your games." });
    } catch (err) {
      setRommStatus({ type: "error", message: err.message || String(err) });
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
      setRommStatus({ type: "success", message: "Disconnected from RomM and removed the saved credential." });
    } catch (err) {
      setRommStatus({ type: "error", message: err?.message || String(err) });
    }
  }

  async function handleDevicePairing() {
    const attempt = pairingAttemptRef.current + 1;
    pairingAttemptRef.current = attempt;
    try {
      setRommPairing(null);
      setRommStatus({ type: "info", message: "Starting secure RomM pairing..." });
      const normalizedUrl = normalizeUrl(rommUrl);
      setRommUrl(normalizedUrl);
      const pairing = await invoke("begin_romm_device_auth", { serverUrl: normalizedUrl });
      if (pairingAttemptRef.current !== attempt) return;
      setRommPairing(pairing);
      setRommStatus({
        type: "info",
        message: `Approve Wingosy in RomM. Pairing code: ${pairing.user_code}`,
      });

      await shellOpen(pairing.verification_path_complete || pairing.verification_path);
      const deadline = Date.now() + Number(pairing.expires_in || 600) * 1000;
      let intervalMs = Math.max(2, Number(pairing.interval || 5)) * 1000;

      while (pairingAttemptRef.current === attempt && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        if (pairingAttemptRef.current !== attempt) return;
        const result = await invoke("poll_romm_device_auth", {
          serverUrl: normalizedUrl,
          deviceCode: pairing.device_code,
        });
        if (result.status === "authorization_pending") continue;
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
            type: "success",
            message: "Wingosy is paired with RomM. Click 'Sync Library' to pull your games.",
          });
          return;
        }
        if (result.status === "access_denied") throw new Error("RomM pairing was denied.");
        if (result.status === "expired_token") throw new Error("RomM pairing expired. Try again.");
        throw new Error(`RomM pairing failed: ${result.status}`);
      }
      if (pairingAttemptRef.current === attempt) {
        throw new Error("RomM pairing expired. Try again.");
      }
    } catch (err) {
      if (pairingAttemptRef.current !== attempt) return;
      setRommPairing(null);
      setRommStatus({ type: "error", message: err.message || String(err) });
    }
  }

  function cancelDevicePairing() {
    pairingAttemptRef.current += 1;
    setRommPairing(null);
    setRommStatus(null);
  }

  async function handleSyncRomM() {
    if (!rommUrl) {
      setRommStatus({ type: "error", message: "Enter a server URL first." });
      return;
    }
    try {
      setRommStatus({ type: "info", message: "Syncing library..." });
      const normalizedUrl = normalizeUrl(rommUrl);
      if (!rommToken) {
        setRommStatus({
          type: "error",
          message: "Pair Wingosy with RomM or connect with a client access token first.",
        });
        return;
      }
      const games = await invoke("sync_romm_library", {
        serverUrl: normalizedUrl, token: rommToken,
      });
      setRommSyncMetadata((previous) => ({
        ...previous,
        lastSyncedAt: new Date().toISOString(),
        libraryCount: Array.isArray(games) ? games.length : null,
      }));
      setRommStatus({ type: "success", message: `Synced ${games.length} games from RomM!` });
      // Refresh sidebar platform counts
      if (onLibraryChange) {
        onLibraryChange();
      }
    } catch (err) {
      setRommStatus({ type: "error", message: err.message || String(err) });
    }
  }

  async function handleScanDirectory() {
    try {
      // If ROM directory is set, scan that. Otherwise, ask user to pick a folder.
      let pathToScan = romsDirectory;
      if (!pathToScan) {
        const selected = await open({ directory: true, multiple: false });
        if (!selected) return;
        pathToScan = selected;
      }
      
      setScanMessage({ type: "info", message: `Scanning ${pathToScan}...` });
      const games = await invoke("scan_directory", { path: pathToScan, recursive: true });
      setScanMessage({ type: "success", message: `Found ${games.length} games!` });
      if (onLibraryChange) onLibraryChange();
    } catch (err) {
      setScanMessage({ type: "error", message: err.message || String(err) });
    }
  }

  async function handleScanCustomDirectory() {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected) {
        setScanMessage({ type: "info", message: `Scanning ${selected}...` });
        const games = await invoke("scan_directory", { path: selected, recursive: true });
        setScanMessage({ type: "success", message: `Found ${games.length} games!` });
        if (onLibraryChange) onLibraryChange();
      }
    } catch (err) {
      setScanMessage({ type: "error", message: err.message || String(err) });
    }
  }

  async function handleChangeRomsDirectory() {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (!selected || selected === romsDirectory) return;

      const overview = await invoke("get_storage_overview");
      setStorageOverview(overview);
      setPendingRomsDirectory(selected);
      if ((overview.migratable_rom_count || 0) > 0) {
        setStorageMigrationDialogOpen(true);
        return;
      }
      await applyRomsDirectoryChange(selected, false);
    } catch (err) {
      setScanMessage({ type: "error", message: err.message || String(err) });
    }
  }

  async function handleResetRomsDirectory() {
    if (storageOverview?.using_default_roms_directory) return;
    if (activeRomDownloadCount > 0) {
      setScanMessage({
        type: "warning",
        message: "Wait for active ROM downloads to finish before changing storage.",
      });
      return;
    }
    if ((storageOverview?.migratable_rom_count || 0) > 0) {
      setScanMessage({
        type: "info",
        message: "Use Change to choose whether tracked ROMs should move before returning to the default folder.",
      });
      return;
    }

    setStorageChangeBusy(true);
    try {
      const currentConfig = config || (await invoke("get_config"));
      const nextConfig = {
        ...currentConfig,
        library: { ...(currentConfig.library || {}), roms_directory: null },
      };
      await invoke("save_config", { config: nextConfig });
      setConfig(nextConfig);
      await loadStorageOverview();
      onLibraryChange?.();
      setScanMessage({ type: "success", message: "Using the default ROM folder." });
    } catch (err) {
      setScanMessage({ type: "error", message: err.message || String(err) });
    } finally {
      setStorageChangeBusy(false);
    }
  }

  async function applyRomsDirectoryChange(directory, migrateExisting) {
    setStorageChangeBusy(true);
    try {
      const result = await invoke("change_roms_directory", {
        newDirectory: directory,
        migrateExisting,
      });
      const cfg = await invoke("get_config");
      setConfig(cfg);
      setRomsDirectory(result.new_directory);
      setStorageMigrationDialogOpen(false);
      setPendingRomsDirectory("");
      await loadStorageOverview();
      onLibraryChange?.();

      if (!migrateExisting) {
        setScanMessage({
          type: "success",
          message: "New downloads will use the new folder. Existing games remain at their current paths.",
        });
        return;
      }

      const warnings = result.missing + result.conflicts + result.failed + result.source_cleanup_failed;
      setScanMessage({
        type: warnings > 0 ? "warning" : "success",
        message: `Moved ${result.moved} game${result.moved === 1 ? "" : "s"}. ${
          warnings > 0
            ? `${result.missing} missing, ${result.conflicts} conflicts, ${result.failed} failed, and ${result.source_cleanup_failed} old copies could not be removed. Existing destination files were not overwritten.`
            : "The new folder is now used for downloads."
        }`,
      });
    } catch (err) {
      setScanMessage({ type: "error", message: err.message || String(err) });
    } finally {
      setStorageChangeBusy(false);
    }
  }

  async function handleDownloadEmulator(emuId) {
    if (emuDownloadInflightRef.current.has(emuId)) return;
    emuDownloadInflightRef.current.add(emuId);
    setEmuInstallProgress((prev) => ({
      ...prev,
      [emuId]: {
        phase: "pending",
        downloaded: 0,
        total: null,
        percent: null,
      },
    }));
    setEmuMessage(null);
    try {
      const path = await invoke("download_emulator", { emulatorId: emuId });
      setEmuMessage({ type: "success", message: `Installed ${emuId} at ${path}` });
      await loadEmulators();
      await loadMissingCores();
    } catch (err) {
      setEmuInstallProgress((prev) => {
        const next = { ...prev };
        delete next[emuId];
        return next;
      });
      setEmuMessage({ type: "error", message: err.message || String(err) });
    } finally {
      emuDownloadInflightRef.current.delete(emuId);
    }
  }

  async function handleDownloadCore(coreFilename) {
    try {
      setDownloadingCore(coreFilename);
      setEmuMessage({ type: "info", message: `Downloading RetroArch support file ${coreFilename}...` });
      await invoke("download_retroarch_core", { coreName: coreFilename });
      setEmuMessage({ type: "success", message: `Installed RetroArch support file ${coreFilename}` });
      await loadMissingCores();
    } catch (err) {
      setEmuMessage({ type: "error", message: err.message || String(err) });
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
    if (!selectedEmu?.installed_path) return;
    try {
      await invoke("launch_emulator", { emulatorPath: selectedEmu.installed_path });
      setEmuMessage({ type: "success", message: `Launched ${selectedEmu.name}` });
    } catch (err) {
      setEmuMessage({ type: "error", message: `Failed to launch: ${err}` });
    }
    handleEmuMenuClose();
  }

  async function handleOpenLocation() {
    if (!selectedEmu?.installed_path) return;
    try {
      await invoke("open_emulator_location", { emulatorPath: selectedEmu.installed_path });
    } catch (err) {
      setEmuMessage({ type: "error", message: `Failed to open location: ${err}` });
    }
    handleEmuMenuClose();
  }

  async function handleCopyEmulatorPath(path) {
    if (!path) return;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access is unavailable");
      }
      await navigator.clipboard.writeText(path);
      setEmuMessage({ type: "success", message: "Emulator path copied." });
    } catch (err) {
      setEmuMessage({ type: "error", message: `Could not copy path: ${err.message || String(err)}` });
    }
  }

  async function handleOpenRetroarchInputSetup() {
    try {
      await invoke("open_retroarch_input_setup");
      setEmuMessage({ type: "success", message: "Opened RetroArch input setup." });
    } catch (err) {
      setEmuMessage({ type: "error", message: err.message || String(err) });
    }
  }

  async function handleResetRetroarchControllerAdditions() {
    try {
      const backup = await invoke("reset_retroarch_controller_additions");
      setEmuMessage({
        type: "success",
        message: backup
          ? "Reset Wingosy controller additions. Your RetroArch profiles and remaps were preserved."
          : "No Wingosy controller additions were present.",
      });
    } catch (err) {
      setEmuMessage({ type: "error", message: err.message || String(err) });
    }
  }

  async function handleRepairRetroarchProfile() {
    try {
      const message = await invoke("repair_retroarch_profile");
      setEmuMessage({ type: "success", message: message || "Wingosy RetroArch controller setup repaired." });
      await loadEmulators();
      await loadMissingCores();
    } catch (err) {
      setEmuMessage({ type: "error", message: err.message || String(err) });
    }
  }

  async function handleRetroarchBetaProfileChange(event) {
    const enabled = event.target.checked;
    try {
      await invoke("set_retroarch_beta_profile", { enabled });
      setConfig((previous) => ({
        ...previous,
        emulators: { ...previous.emulators, retroarch_use_beta_profile: enabled },
      }));
      setEmuMessage({
        type: "success",
        message: enabled ? "Wingosy controller settings enabled for RetroArch." : "Wingosy controller settings disabled.",
      });
    } catch (err) {
      setEmuMessage({ type: "error", message: err.message || String(err) });
    }
  }

  async function handleUninstallEmulator() {
    if (!selectedEmu?.id) return;
    
    // Only allow uninstalling managed emulators
    if (selectedEmu.install_type !== "managed") {
      setEmuMessage({ type: "error", message: "Can only uninstall emulators installed via Wingosy" });
      handleEmuMenuClose();
      return;
    }
    
    try {
      setEmuMessage({ type: "info", message: `Uninstalling ${selectedEmu.name}...` });
      await invoke("uninstall_emulator", { emulatorId: selectedEmu.id });
      setEmuMessage({ type: "success", message: `Successfully uninstalled ${selectedEmu.name}` });
      await loadEmulators();
      await loadMissingCores();
    } catch (err) {
      setEmuMessage({ type: "error", message: `Failed to uninstall: ${err}` });
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
    } catch (err) {
      console.error("Failed to load hidden games:", err);
    } finally {
      setHiddenLoading(false);
    }
  }

  async function handleUnhideGame(gameId) {
    try {
      await invoke("unhide_game", { gameId });
      setHiddenGames(hiddenGames.filter(g => g.id !== gameId));
    } catch (err) {
      console.error("Failed to unhide game:", err);
    }
  }

  function handleOpenHiddenDialog() {
    loadHiddenGames();
    setHiddenDialogOpen(true);
  }

  function getInstallTypeLabel(installType) {
    switch (installType) {
      case "steam": return "Steam";
      case "system": return "System";
      case "portable": return "Portable";
      case "managed": return "Wingosy";
      case "external": return "Unverified";
      case "custom": return "Custom";
      default: return "Installed";
    }
  }

  async function handleApplyPaths() {
    try {
      const count = await invoke("apply_detected_paths");
      setEmuMessage({ type: "success", message: `Applied ${count} emulator paths to config.` });
      await loadEmulators();
    } catch (err) {
      setEmuMessage({ type: "error", message: err.message || String(err) });
    }
  }

  const installedEmus = emulators.filter((e) => e.is_installed);
  const availableEmus = emulators.filter((e) => !e.is_installed && e.has_download);
  const unavailableEmus = emulators.filter((e) => !e.is_installed && !e.has_download);
  const rommSessionActive = rommSessionSaved || rommConnectionStatus === "online";
  const rommUrlLocked = rommSessionActive;

  return (
    <Box
      sx={{
        p: { xs: 2, sm: 3 },
        maxWidth: 1760,
        width: "100%",
        mx: "auto",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        flex: 1,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
          mb: 2,
        }}
      >
        <Box
          {...tauriDragRegionProps()}
          sx={{
            flex: 1,
            minWidth: 120,
            minHeight: 40,
            display: "flex",
            alignItems: "center",
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
          flexDirection: { xs: "column", md: "row" },
          gap: 2,
          flex: 1,
          minHeight: 0,
          mt: 1,
        }}
      >
        <Paper
          component="nav"
          variant="outlined"
          elevation={0}
          sx={{
            width: { xs: "100%", md: 232 },
            flexShrink: 0,
            borderRadius: 2,
            overflow: "hidden",
            alignSelf: { xs: "stretch", md: "flex-start" },
          }}
        >
          <List disablePadding sx={{ py: 0.5 }}>
            {SETTINGS_SECTIONS.map(({ id, label, Icon }) => (
              <ListItemButton
                key={id}
                selected={settingsSection === id}
                onClick={() => setSettingsSection(id)}
                data-testid={`settings-nav-${id}`}
                sx={{ py: 1.25, px: 2 }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Icon fontSize="small" color={settingsSection === id ? "primary" : "action"} />
                </ListItemIcon>
                <ListItemText
                  primary={label}
                  slotProps={{
                    primary: {
                      variant: "body2",
                      sx: { fontWeight: settingsSection === id ? 600 : 400 },
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
            mr: { xs: -2, sm: -3 },
          }}
        >
      {settingsSection === "general" && (
      <>
       <Paper sx={SETTINGS_CARD_SX}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <DesktopWindowsIcon color="primary" />
            <Typography variant="h6">Private Beta</Typography>
          </Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Private beta scope</Typography>
          <List dense disablePadding sx={{ mb: 2 }}>
            <ListItem disableGutters alignItems="flex-start">
              <ListItemIcon sx={{ minWidth: 32, mt: 0.25 }}>
                <CheckCircleIcon color="primary" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Windows 11 with RetroArch for NES, SNES, GB, GBC, GBA, and Genesis." />
            </ListItem>
            <ListItem disableGutters alignItems="flex-start">
              <ListItemIcon sx={{ minWidth: 32, mt: 0.25 }}>
                <CheckCircleIcon color="primary" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="RomM connection, library sync, ROM downloads, and one-step Play are included." />
            </ListItem>
            <ListItem disableGutters alignItems="flex-start">
              <ListItemIcon sx={{ minWidth: 32, mt: 0.25 }}>
                <CheckCircleIcon color="primary" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Save transfers are manual; automatic save sync and other emulator/platform combinations remain experimental." />
            </ListItem>
          </List>
          <AppVersionField value={appVersion} />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            For a report, include the app version above, your Windows version, reproduction steps, expected and actual behavior, and relevant redacted logs. Never share credentials, user data, configuration, database files, ROM names, or ROM paths.
          </Typography>
         <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
           <Button
             variant="outlined"
             startIcon={<FolderOpenIcon />}
             onClick={handleOpenLogsFolder}
           >
             Open Logs Folder
           </Button>
            <Button
              variant="contained"
              startIcon={<OpenInNewIcon />}
              onClick={handleReportProblem}
           >
             Report a Problem
           </Button>
         </Box>
         {supportMessage && (
           <Alert severity={supportMessage.type} sx={{ mt: 2 }}>
             {supportMessage.message}
           </Alert>
         )}
          <Button
            variant="outlined"
            startIcon={<OpenInNewIcon />}
            onClick={() => shellOpen("https://github.com/auron-labs/wingosy-launcher/blob/main/.scratch/transparent-romm-launching/emulator-certification.md")}
          >
            View supported emulator paths
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            See the emulator and platform combinations included in this preview.
          </Typography>
       </Paper>
      <Paper sx={SETTINGS_CARD_SX}>
        <Typography variant="h6" gutterBottom>UI</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Switch between desktop (default) and Immersive mode — a large-type, controller-friendly layout aligned with the Wingosy look. Optional OS fullscreen is ideal for couch play.
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Box data-testid="immersive-mode-row">
            <FormControlLabel
              control={
                <Switch
                  slotProps={{ input: /** @type {any} */ ({ "data-testid": "immersive-mode-switch" }) }}
                  checked={immersiveModeEnabled}
                  onChange={async (e) => {
                    const next = e.target.checked;
                    setImmersiveModeEnabled(next);
                    // When enabling Immersive mode, default fullscreen on.
                    const nextFs = next ? true : fullscreenEnabled;
                    if (next) setFullscreenEnabled(nextFs);
                    await persistDisplayFlags(next, nextFs);
                    if (onImmersiveModeChange) {
                      onImmersiveModeChange(next);
                    } else if (next && onLibraryChange) {
                      // Fallback: trigger library refresh so App.jsx picks up the new display flags
                      onLibraryChange();
                    }
                  }}
                />
              }
              label="Immersive mode"
            />
          </Box>
          <FormControlLabel
            control={
              <Switch
                slotProps={{ input: /** @type {any} */ ({ "data-testid": "immersive-fullscreen-switch" }) }}
                checked={fullscreenEnabled}
                disabled={!immersiveModeEnabled}
                onChange={async (e) => {
                  const nextFs = e.target.checked;
                  setFullscreenEnabled(nextFs);
                  await persistDisplayFlags(immersiveModeEnabled, nextFs);
                  if (onFullscreenChange) {
                    onFullscreenChange(nextFs);
                  }
                }}
              />
            }
           label="Fullscreen (Immersive)"
          />
          {!immersiveModeEnabled && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 4.5 }}>
              Enable Immersive mode to use fullscreen.
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            Tip: <KeyboardHint>F11</KeyboardHint> toggles fullscreen. From the Immersive library, <KeyboardHint>Esc</KeyboardHint> exits to desktop.
          </Typography>
          <Box sx={{ mt: 2, maxWidth: 420 }}>
             <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
               Raise this only when the stick drifts. It applies to Immersive directional navigation.
             </Typography>
             <SettingSlider
               label="Controller deadzone"
               value={controllerDeadzone}
               formatValue={(value) => `${Math.round(value * 100)}%`}
               valueTestId="controller-deadzone-value"
               min={GAMEPAD_DEADZONE_MIN}
               max={GAMEPAD_DEADZONE_MAX}
               step={0.05}
               valueLabelDisplay="auto"
               onChange={(_, value) => setControllerDeadzone(normalizeGamepadDeadzone(value))}
               onChangeCommitted={(_, value) => persistControllerDeadzone(value)}
             />
             <Button
               size="small"
               variant="outlined"
               color="inherit"
               onClick={() => persistControllerDeadzone(DEFAULT_GAMEPAD_DEADZONE)}
            >
              Reset deadzone
            </Button>
          </Box>
        </Box>
      </Paper>
      </>
      )}

      {settingsSection === "appearance" && (
      <Paper sx={SETTINGS_CARD_SX}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <PaletteIcon color="primary" />
          <Typography variant="h6">Appearance</Typography>
        </Box>
        
        {/* Theme Mode */}
         <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
           Theme
         </Typography>
        <ToggleButtonGroup
          value={themeMode}
          exclusive
          onChange={async (e, newMode) => {
            if (!newMode) return;
            setThemeMode(newMode);
            try {
              const cfg = await invoke("get_config");
              cfg.display = cfg.display || {};
              cfg.display.theme_mode = newMode;
              await invoke("save_config", { config: cfg });
            } catch (err) {
              console.error("Failed to save theme mode:", err);
            }
          }}
          size="small"
          sx={{ mb: 3 }}
        >
          <ToggleButton value="system" sx={{ px: 2 }}>System</ToggleButton>
          <ToggleButton value="light" sx={{ px: 2 }}>Light</ToggleButton>
           <ToggleButton value="dark" sx={{ px: 2 }}>Dark</ToggleButton>
         </ToggleButtonGroup>

         <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
           Theme preview
         </Typography>
         <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 1.5, mb: 3 }}>
           {[
             { mode: "light", label: "Light", background: "#fffbfe", surface: "#f5f5f5", text: "#1c1b1f", muted: "#5f5f5f" },
             { mode: "system", label: "System", background: "#202124", surface: "#303134", text: "#f1f3f4", muted: "#bdc1c6" },
             { mode: "dark", label: "Dark", background: "#121212", surface: "#1e1e1e", text: "#e1e1e1", muted: "#b3b3b3" },
           ].map((preview) => (
             <Box
               key={preview.mode}
               data-testid={`theme-preview-${preview.mode}`}
               aria-label={`${preview.label} theme preview`}
               sx={{ p: 1, border: 1, borderColor: "divider", borderRadius: 2, bgcolor: preview.background }}
             >
               <Typography variant="caption" sx={{ color: preview.text, fontWeight: 600 }}>
                 {preview.label}
               </Typography>
               <Box sx={{ mt: 0.75, p: 1, borderRadius: 1, bgcolor: preview.surface }}>
                 <Typography variant="caption" sx={{ display: "block", color: preview.text }}>
                   Wingosy Library
                 </Typography>
                 <Box sx={{ display: "flex", gap: 0.5, mt: 0.75 }}>
                   <Box sx={{ width: 18, height: 24, borderRadius: 0.5, bgcolor: "primary.main" }} />
                   <Box sx={{ width: 18, height: 24, borderRadius: 0.5, bgcolor: preview.muted }} />
                   <Box sx={{ flex: 1, height: 24, borderRadius: 0.5, bgcolor: preview.background }} />
                 </Box>
               </Box>
               {preview.mode === "system" && (
                 <Typography variant="caption" sx={{ display: "block", color: preview.muted, mt: 0.5 }}>
                   Follows your OS preference
                 </Typography>
               )}
             </Box>
           ))}
         </Box>
         <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
           These previews are examples only; choosing a theme above applies it to Wingosy.
         </Typography>
        
        {/* Accent Color */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Accent Color
        </Typography>
        <AccentHueSlider accentHue={accentHue} setAccentHue={setAccentHue} />
      </Paper>
      )}

      {settingsSection === "sound" && (
      <Paper sx={SETTINGS_CARD_SX}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <VolumeUpIcon color="primary" />
           <Typography variant="h6">Sound</Typography>
         </Box>
         <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
           UI feedback and background music are used while Immersive mode is active; desktop mode remains silent.
         </Typography>

         <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
           UI sounds
         </Typography>
         <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
           Argosy-style feedback sounds (bundled clips). Preview each sound below.
         </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={uiSoundsEnabled}
              onChange={async (e) => {
                await persistUiSounds(e.target.checked);
              }}
            />
          }
          label="Enable UI sounds"
        />
         <Box sx={{ px: 1, mt: 1, mb: 2, maxWidth: 400 }}>
           <SettingSlider
             label="UI sounds volume"
             value={uiSoundsVolume}
             valueTestId="ui-sounds-value"
             formatValue={(value) => `${Math.round(value)}%`}
             size="small"
             disabled={!uiSoundsEnabled}
             min={0}
             max={100}
             valueLabelDisplay="auto"
            onChange={(_, v) => setUiSoundsVolume(v)}
            onChangeCommitted={(_, v) => persistUiSoundsVolume(v)}
           />
         </Box>
         <List dense sx={{ maxWidth: 520, mb: 2 }}>
           {ARGOSY_SOUND_ENTRIES.map(({ id, label }) => (
             <ListItem
               key={id}
               secondaryAction={
                 <Button
                   size="small"
                   variant="outlined"
                   startIcon={<PlayArrowIcon />}
                   disabled={!uiSoundsEnabled}
                   onClick={() => previewArgosySound?.(id)}
                   data-testid={`ui-sound-preview-${id}`}
                 >
                   Preview
                 </Button>
               }
             >
               <ListItemText primary={label} />
             </ListItem>
           ))}
         </List>

         <Typography variant="subtitle2" sx={{ mb: 0.5, mt: 1 }}>
          Background music
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          Optional looping track or shuffled folder playback while browsing in Immersive mode.
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={ambientEnabled}
               onChange={async (e) => {
                 await persistAmbient({ ambient_enabled: e.target.checked });
               }}
             />
          }
          label="Play background music"
        />
         {!ambientPath ? (
           <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1, ml: 4.5 }}>
             {ambientEnabled
               ? "Choose an audio file or folder below to start playback."
               : "Turn on background music to choose an audio source."}
           </Typography>
        ) : null}
         <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
          <Button size="small" variant="outlined" onClick={pickAmbientFile} disabled={!ambientEnabled}>
             Audio file…
           </Button>
          <Button size="small" variant="outlined" onClick={pickAmbientFolder} disabled={!ambientEnabled}>
             Folder…
          </Button>
          {ambientPath ? (
            <Button size="small" color="inherit" onClick={clearAmbientSource}>
              Clear
            </Button>
          ) : null}
        </Box>
        {ambientPath ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontFamily: "monospace", fontSize: "0.8125rem", wordBreak: "break-all" }}>
            {ambientIsFolder ? "[Folder] " : "[File] "}
            {ambientPath}
          </Typography>
        ) : null}
         {ambientIsFolder ? (
           <FormControlLabel
            sx={{ mb: 2 }}
            control={
              <Switch
                checked={ambientShuffle}
                onChange={async (e) => {
                  await persistAmbient({ ambient_shuffle: e.target.checked });
                }}
                disabled={!ambientEnabled || !ambientPath}
              />
            }
            label="Shuffle tracks"
          />
        ) : null}
         <Box sx={{ px: 1, maxWidth: 400 }}>
           <SettingSlider
             label="Background music volume"
             value={ambientVolume}
             valueTestId="ambient-volume-value"
             formatValue={(value) => `${Math.round(value)}%`}
             size="small"
             disabled={!ambientEnabled || !ambientPath}
             min={0}
             max={100}
            valueLabelDisplay="auto"
            onChange={(_, v) =>
              setAmbientVolume(Array.isArray(v) ? v[0] : v)
            }
            onChangeCommitted={(_, v) => {
              const value = Array.isArray(v) ? v[0] : v;
              persistAmbient({
                ambient_volume: Math.min(100, Math.max(0, Math.round(value))),
              });
            }}
          />
        </Box>
      </Paper>
      )}

      {settingsSection === "romm" && (
      <Paper sx={SETTINGS_CARD_SX} data-testid="romm-settings-card">
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <CloudIcon color="primary" />
          <Typography variant="h6">RomM Server</Typography>
        </Box>
        <TextField
          fullWidth
          label="Server URL"
          placeholder="romm.example.com or 192.168.1.2:3000"
          value={rommUrl}
          onChange={(e) => setRommUrl(e.target.value)}
          disabled={rommUrlLocked}
          helperText={
            rommUrlLocked
              ? "Connected. Disconnect before changing the server URL."
              : "Choose the RomM server Wingosy should connect to."
          }
          sx={{ mb: 2 }}
          size="small"
        />
        
        {/* Auth mode toggle */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Authentication method
          </Typography>
          <ToggleButtonGroup
            value={rommAuthMode}
            disabled={rommSessionActive}
            exclusive
            onChange={(e, newMode) => {
              if (!newMode) return;
              cancelDevicePairing();
              setRommAuthMode(newMode);
            }}
            size="small"
            sx={{ mb: 2 }}
          >
            <ToggleButton value="pairing" sx={{ px: 2 }}>
              <OpenInNewIcon sx={{ mr: 1, fontSize: 18 }} />
              Device pairing
            </ToggleButton>
            <ToggleButton value="token" sx={{ px: 2 }}>
              <VpnKeyIcon sx={{ mr: 1, fontSize: 18 }} />
              Access token
            </ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 640 }}>
            {rommAuthMode === "pairing"
              ? "Secure device pairing opens RomM in your browser. Wingosy never receives or stores your password."
              : "Use a RomM access token for this device. The token is stored securely and never shown again after connecting."}
          </Typography>
        </Box>
        
        {rommAuthMode === "token" && (
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="Device Name"
              value={rommDeviceName}
              onChange={(e) => setRommDeviceName(e.target.value)}
              size="small"
              sx={{ mb: 2 }}
              helperText={`Registered as wingosy-${(rommDeviceName.trim() || "windows-pc").toLowerCase().replace(/\s+/g, "-").replace(/^wingosy-/, "")}`}
            />
            <TextField 
              fullWidth 
              label="Access token"
              placeholder="Paste your RomM access token here"
              value={rommDirectToken} 
              onChange={(e) => setRommDirectToken(e.target.value)} 
              size="small"
              type="password"
            />
          </Box>
        )}
        
        <Box sx={{ display: "flex", gap: 2 }}>
          {!rommSessionActive && (
            <Button
              variant="contained"
              onClick={handleConnectRomM}
              disabled={
                !rommUrl ||
                (rommAuthMode === "token"
                  ? !rommDirectToken.trim()
                  : Boolean(rommPairing))
              }
            >
              {rommPairing ? "Waiting for approval..." : rommAuthMode === "pairing" ? "Pair with RomM" : "Connect"}
            </Button>
          )}
          {rommPairing && (
            <Button variant="text" onClick={cancelDevicePairing}>Cancel</Button>
          )}
          <Button variant="outlined" onClick={handleSyncRomM} disabled={!rommUrl}>Sync Library</Button>
          {rommSessionActive && (
            <Button color="error" variant="outlined" onClick={() => setRommDisconnectDialogOpen(true)}>
              Disconnect
            </Button>
          )}
        </Box>
        <Box data-testid="romm-sync-metadata" sx={{ mt: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Sync metadata
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
              gap: 1.5,
            }}
          >
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "action.hover" }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                Last synced
              </Typography>
              <Typography variant="body2" data-testid="romm-last-synced-value">
                {formatSyncTimestamp(rommSyncMetadata.lastSyncedAt)}
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "action.hover" }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                RomM library
              </Typography>
              <Typography variant="body2" data-testid="romm-library-count-value">
                {formatSyncLibraryCount(rommSyncMetadata.libraryCount)}
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "action.hover" }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                Next scheduled sync
              </Typography>
              <Typography variant="body2" data-testid="romm-next-sync-value">
                {rommSyncMetadata.autoSync ? "Automatic (next run not reported)" : "Not scheduled"}
              </Typography>
            </Paper>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Values are shown from existing RomM configuration or the most recent manual sync in this session.
          </Typography>
        </Box>
        {rommStatus && <Alert severity={rommStatus.type} sx={{ mt: 2 }}>{rommStatus.message}</Alert>}
      </Paper>
      )}

      <ConfirmDestructiveDialog
        open={rommDisconnectDialogOpen}
        title="Disconnect from RomM?"
        message="Wingosy removes the saved RomM session from this device. Your library stays locally, and you can pair or connect again at any time."
        confirmLabel="Disconnect"
        onCancel={() => setRommDisconnectDialogOpen(false)}
        onConfirm={() => {
          setRommDisconnectDialogOpen(false);
          handleDisconnectRomM();
        }}
      />

      {settingsSection === "library" && (
      <>
      <Paper sx={SETTINGS_CARD_SX}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <StorageIcon color="primary" />
          <Typography variant="h6">Storage</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Review Wingosy file locations and choose where ROM downloads are stored.
        </Typography>

        {storageLoading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
        {storageOverview && (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(4, minmax(0, 1fr))" },
              gap: 1.5,
              mb: 3,
            }}
          >
            <Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover" }}>
              <Typography variant="caption" color="text.secondary">Tracked ROMs</Typography>
              <Typography variant="h6">{storageOverview.tracked_rom_count}</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover" }}>
              <Typography variant="caption" color="text.secondary">Tracked size</Typography>
              <Typography variant="h6">{formatStorageBytes(storageOverview.tracked_rom_bytes)}</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover" }}>
              <Typography variant="caption" color="text.secondary">Active downloads</Typography>
              <Typography variant="h6">{storageOverview.active_rom_downloads}</Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover" }}>
              <Typography variant="caption" color="text.secondary">Free disk space</Typography>
              <Typography variant="h6" data-testid="storage-free-space-value">
                {formatOptionalStorageBytes(storageOverview.free_disk_bytes)}
              </Typography>
            </Paper>
          </Box>
        )}
        {storageOverview && storageOverview.free_disk_bytes == null && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: -2, mb: 2 }}>
            Free disk space is not reported by the current backend.
          </Typography>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          ROM Storage Directory
        </Typography>
        <Box sx={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 2, 
          mb: 2,
          p: 1.5,
          bgcolor: "rgba(0,0,0,0.2)",
          borderRadius: 2,
        }}>
          <FolderOpenIcon color="action" />
          <Typography 
            variant="body2" 
            sx={{ 
              flex: 1, 
              fontFamily: "monospace",
              color: "text.primary",
              overflowWrap: "anywhere",
            }}
          >
            {romsDirectory || "Loading..."}
          </Typography>
          {storageOverview?.using_default_roms_directory && <Chip size="small" label="Default" />}
          <Button
            size="small"
            variant="outlined"
            onClick={handleChangeRomsDirectory}
            disabled={storageChangeBusy || activeRomDownloadCount > 0}
            title={activeRomDownloadCount > 0 ? "Wait for ROM downloads to finish before changing storage" : undefined}
          >
            Change
          </Button>
          <Button
            size="small"
            onClick={handleResetRomsDirectory}
            disabled={
              storageOverview?.using_default_roms_directory ||
              storageChangeBusy ||
              activeRomDownloadCount > 0
            }
            title="Reset to Wingosy's default ROM folder"
          >
            Reset to default
          </Button>
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          Changing folders never moves files silently. Choose whether to move tracked ROMs or use the new folder for future downloads; active downloads must finish first.
        </Alert>

        {storageOverview?.locations?.length > 0 && (
          <List disablePadding sx={{ mb: 2 }}>
            {storageOverview.locations.map((location) => (
              <ListItem
                key={location.key}
                divider
                disableGutters
                secondaryAction={<Typography variant="caption">{formatStorageBytes(location.bytes)}</Typography>}
              >
                <ListItemButton
                  onClick={() => handleOpenStorageLocation(location)}
                  disabled={!location.exists}
                  aria-label={location.exists ? `Open ${location.label} folder` : `${location.label} folder is not created`}
                  sx={{ borderRadius: 1.5 }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}><FolderOpenIcon fontSize="small" /></ListItemIcon>
                  <ListItemText
                    primary={location.label}
                    secondary={location.path}
                    slotProps={{ secondary: { sx: { fontFamily: "monospace", overflowWrap: "anywhere", pr: 8 } } }}
                  />
                  <OpenInNewIcon fontSize="small" color="action" sx={{ ml: 1 }} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Scan for ROMs to add them to your library.
        </Typography>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <Button 
            variant="contained" 
            onClick={handleScanDirectory}
            disabled={!romsDirectory}
            title={romsDirectory ? `Scan ${romsDirectory}` : "Set a ROM directory first"}
          >
            Scan ROM Directory
          </Button>
          <Button variant="outlined" onClick={handleScanCustomDirectory}>
            Scan Other Folder...
          </Button>
        </Box>
        {scanMessage && <Alert severity={scanMessage.type} sx={{ mt: 2 }}>{scanMessage.message}</Alert>}
      </Paper>

      <Paper sx={SETTINGS_CARD_GRADIENT_SX}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <VisibilityOffIcon color="primary" />
          <Typography variant="h6">Hidden Games</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          View and restore games that you've hidden from your library.
        </Typography>
        <Button
          variant="outlined"
          startIcon={<VisibilityIcon />}
          onClick={handleOpenHiddenDialog}
        >
          View Hidden Games
        </Button>
      </Paper>
      </>
      )}

      {settingsSection === "bios" && <BiosSettings libraryPlatforms={platforms} />}

      {settingsSection === "emulators" && (
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          gap: 3,
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          alignItems: "flex-start",
        }}
      >
      <Paper sx={{ ...SETTINGS_CARD_SX, flex: 1, minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "stretch", sm: "center" },
            justifyContent: "space-between",
            gap: 1.5,
            mb: 2,
            flexWrap: "wrap",
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: { xs: "flex-start", sm: "center" },
              gap: 1,
              flex: 1,
              minWidth: 0,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", minWidth: 0 }}>
            <SportsEsportsIcon color="primary" />
            <Typography variant="h6" sx={{ whiteSpace: "nowrap" }}>Emulators</Typography>
            <Chip label={`${installedEmus.length} installed`} size="small" color="success" variant="outlined" />
            {missingCores.length > 0 && (
              <Chip 
                label={`${missingCores.length} cores needed`} 
                size="small" 
                color="warning" 
                variant="outlined"
                icon={<MemoryIcon sx={{ fontSize: 14 }} />}
              />
            )}
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 1, flexShrink: 0, alignItems: "center", alignSelf: { xs: "stretch", sm: "center" } }}>
            <Tooltip title="Use newly detected emulator paths without changing existing configured paths">
              <Button size="small" variant="outlined" onClick={handleApplyPaths} sx={{ whiteSpace: "nowrap" }}>
                Apply detected paths
              </Button>
            </Tooltip>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => { loadEmulators(); loadMissingCores(); }}
            >
              Refresh
            </Button>
          </Box>
        </Box>

        {emuMessage && <Alert severity={emuMessage.type} onClose={() => setEmuMessage(null)} sx={{ mb: 2 }}>{emuMessage.message}</Alert>}
        {downloadingCore && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

        {installedEmus.length > 0 && (
          <>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Installed</Typography>
            <List dense>
              {installedEmus.map((emu) => {
                const isRetroArch = emu.id === "retroarch";
                const emuCores = isRetroArch ? missingCores : [];
                const isExpanded = expandedEmu === emu.id;
                
                return (
                  <Box key={emu.id}>
                    <ListItem 
                      sx={{ 
                        borderRadius: isExpanded ? "8px 8px 0 0" : 2, 
                        mb: isExpanded ? 0 : 0.5,
                        bgcolor: "rgba(76, 175, 80, 0.08)",
                        "&:hover": { bgcolor: "rgba(76, 175, 80, 0.12)" },
                        cursor: isRetroArch ? "pointer" : "default",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        rowGap: 1,
                        columnGap: 0,
                        pr: 1,
                        pl: 1,
                      }}
                      onClick={() => isRetroArch && setExpandedEmu(isExpanded ? null : emu.id)}
                    >
                      <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                        <CheckCircleIcon color="success" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        sx={{ 
                          flex: "1 1 200px", 
                          minWidth: 0, 
                          maxWidth: { xs: "100%", sm: "calc(100% - 48px)" },
                        }}
                        primary={
                          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, columnGap: 1, rowGap: 0.5 }}>
                            <Box component="span" sx={{ typography: "body2", fontWeight: 600 }}>
                              {emu.name}
                            </Box>
                            {emu.version && (
                              <Box component="span" sx={{ typography: "caption", color: "text.secondary" }}>
                                {/^\d/.test(emu.version) ? `v${emu.version}` : emu.version}
                              </Box>
                            )}
                            <Chip 
                              label={getInstallTypeLabel(emu.install_type)} 
                              size="small" 
                              color={emu.install_type === "steam" ? "primary" : "default"}
                              variant="outlined"
                              sx={{ fontSize: "0.75rem", height: 22 }}
                            />
                            {isRetroArch && emuCores.length > 0 && (
                              <Chip 
                                label={`${emuCores.length} cores needed`}
                                size="small" 
                                color="warning"
                                variant="filled"
                                sx={{ fontSize: "0.75rem", height: 22 }}
                              />
                            )}
                          </Box>
                        }
                        secondary={(
                          <Tooltip title={emu.installed_path || "Install path unavailable"} placement="top-start">
                            <Box
                              component="span"
                              sx={{
                                display: "block",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                maxWidth: "100%",
                                mt: 0.5,
                              }}
                            >
                              {emu.installed_path || "Install path unavailable"}
                            </Box>
                          </Tooltip>
                        )}
                        slotProps={{
                          secondary: {
                            sx: {
                              display: "block",
                              maxWidth: "100%",
                            },
                          },
                        }}
                      />
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: { xs: "row", sm: "row" },
                          flexWrap: "wrap",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          gap: 0.5,
                          flex: { xs: "1 1 100%", sm: "0 0 auto" },
                          flexBasis: { xs: "100%", sm: "auto" },
                          minWidth: 0,
                          pl: { xs: 4.5, sm: 0 },
                          order: { xs: 3, sm: 0 },
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Tooltip title="Supported platforms / systems">
                          <Chip 
                            label={emu.supported_platforms.slice(0, 3).join(", ").toUpperCase() + (emu.supported_platforms.length > 3 ? "…" : "")} 
                            size="small" 
                            variant="outlined"
                            sx={{ 
                               fontSize: "0.75rem", 
                               maxWidth: { xs: 160, sm: 150 },
                              "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis", display: "block" },
                            }} 
                          />
                        </Tooltip>
                        <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0, gap: 0.25, ml: { xs: "auto", sm: 0 } }}>
                        <Button
                            size="small"
                            color="primary"
                            startIcon={<PlayArrowIcon fontSize="small" />}
                            onClick={(e) => {
                              e.stopPropagation();
                              invoke("launch_emulator", { emulatorPath: emu.installed_path })
                                .then(() => setEmuMessage({ type: "success", message: `Launched ${emu.name}` }))
                                .catch(err => setEmuMessage({ type: "error", message: `Failed: ${err}` }));
                            }}
                        >
                          Launch
                        </Button>
                        <Button
                            size="small"
                            startIcon={<FolderOpenIcon fontSize="small" />}
                            onClick={(e) => {
                              e.stopPropagation();
                              invoke("open_emulator_location", { emulatorPath: emu.installed_path })
                                .catch(err => setEmuMessage({ type: "error", message: `Failed: ${err}` }));
                            }}
                        >
                          Open folder
                        </Button>
                        <Button
                          size="small"
                          startIcon={<ContentCopyIcon fontSize="small" />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyEmulatorPath(emu.installed_path);
                          }}
                          disabled={!emu.installed_path}
                        >
                          Copy path
                        </Button>
                        <Button
                          size="small"
                          startIcon={<MoreVertIcon fontSize="small" />}
                          onClick={(e) => { e.stopPropagation(); handleEmuMenuOpen(e, emu); }}
                        >
                          More
                        </Button>
                        {isRetroArch && (
                          <Button
                            size="small"
                            startIcon={isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                            aria-expanded={isExpanded}
                            onClick={(e) => { e.stopPropagation(); setExpandedEmu(isExpanded ? null : emu.id); }}
                          >
                            {isExpanded ? "Hide cores" : "Show cores"}
                          </Button>
                        )}
                        </Box>
                      </Box>
                    </ListItem>
                    
                    {/* Cores section for RetroArch */}
                    {isRetroArch && (
                      <Collapse in={isExpanded}>
                        <Box sx={{ 
                          bgcolor: "rgba(255, 152, 0, 0.05)", 
                          borderRadius: "0 0 8px 8px",
                          border: "1px solid rgba(255, 152, 0, 0.2)",
                          borderTop: "none",
                          mb: 0.5,
                          p: 2
                        }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                            {emu.install_type === "managed"
                              ? `Wingosy-managed RetroArch setup ${emu.version || "recorded"}`
                              : "RetroArch installed outside Wingosy"}
                          </Typography>
                           <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
                             <Button size="small" variant="outlined" onClick={handleOpenRetroarchInputSetup}>
                               Open RetroArch input setup
                             </Button>
                             {emu.install_type === "managed" ? (
                               <Button size="small" variant="outlined" onClick={handleRepairRetroarchProfile}>
                                Repair Wingosy controller setup
                               </Button>
                             ) : (
                               <Button size="small" variant="outlined" color="warning" onClick={handleResetRetroarchControllerAdditions}>
                                 Reset Wingosy controller additions
                               </Button>
                             )}
                          </Box>
                          {emu.install_type === "external" && (
                            <FormControlLabel
                              control={
                                <Switch
                                  size="small"
                                  checked={Boolean(config?.emulators?.retroarch_use_beta_profile)}
                                  onChange={handleRetroarchBetaProfileChange}
                                />
                              }
                              label="Use Wingosy controller settings for this installation"
                            />
                          )}
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.25, mb: 1 }}>
                            Recovery: Input → RetroPad Binds → Port 1 → Set All Controls → Save Controller Profile.
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                            Supported RetroArch systems:
                          </Typography>
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mb: 1.5 }}>
                            {retroarchCoreInventory.map((core) => {
                              const statusLabel = core.status
                                ? core.status.charAt(0).toUpperCase() + core.status.slice(1)
                                : "Unknown";
                              return (
                                <Box
                                  key={core.platform_id}
                                  data-testid="retroarch-core-inventory-row"
                                  sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}
                                >
                                  <Typography variant="body2" sx={{ minWidth: 180 }}>
                                    {core.platform_name}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                                    {core.core_filename}
                                  </Typography>
                                  <Chip
                                    label={core.required ? "Required" : "Optional"}
                                    size="small"
                                    variant="outlined"
                                    color={core.required ? "primary" : "default"}
                                  />
                                  <Chip
                                    label={statusLabel}
                                    size="small"
                                    data-testid={`retroarch-core-status-${core.platform_id}`}
                                    color={core.status === "installed" ? "success" : "warning"}
                                  />
                                </Box>
                              );
                            })}
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                            RetroArch support needed for your game library:
                          </Typography>
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                            {emuCores.map((core) => (
                              <Chip
                                key={core.core_filename}
                                data-testid="retroarch-core-chip"
                                icon={downloadingCore === core.core_filename ? null : <MemoryIcon sx={{ fontSize: 14 }} />}
                                label={
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                    <span>{core.core_filename.replace("_libretro.dll", "")}</span>
                                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                                      ({core.platform_name})
                                    </Typography>
                                  </Box>
                                }
                                onClick={() => handleDownloadCore(core.core_filename)}
                                onDelete={() => handleDownloadCore(core.core_filename)}
                                deleteIcon={
                                  downloadingCore === core.core_filename 
                                    ? <Box sx={{ width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <Box sx={{ width: 14, height: 14, border: "2px solid", borderColor: "warning.main", borderRadius: "50%", borderRightColor: "transparent", animation: "spin 1s linear infinite", "@keyframes spin": { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } } }} />
                                      </Box>
                                    : <DownloadIcon sx={{ fontSize: 16 }} />
                                }
                                disabled={downloadingCore !== null}
                                sx={{ 
                                  bgcolor: "rgba(255, 152, 0, 0.1)",
                                  "&:hover": { bgcolor: "rgba(255, 152, 0, 0.2)" },
                                  "& .MuiChip-deleteIcon": { color: "warning.main" }
                                }}
                                size="small"
                              />
                            ))}
                          </Box>
                          {emuCores.length > 1 && (
                            <Button 
                              size="small" 
                              variant="outlined" 
                              color="warning"
                              startIcon={<DownloadIcon />}
                              onClick={async () => {
                                for (const core of emuCores) {
                                  await handleDownloadCore(core.core_filename);
                                }
                              }}
                              disabled={downloadingCore !== null}
                              sx={{ mt: 1.5 }}
                            >
                              Download all support files
                            </Button>
                          )}
                        </Box>
                      </Collapse>
                    )}
                  </Box>
                );
              })}
            </List>
            <Menu
              anchorEl={emuMenuAnchor}
              open={Boolean(emuMenuAnchor)}
              onClose={handleEmuMenuClose}
            >
              <MenuItem onClick={handleLaunchEmulator}>
                <PlayArrowIcon fontSize="small" sx={{ mr: 1 }} />
                Launch Emulator
              </MenuItem>
              <MenuItem onClick={handleOpenLocation}>
                <FolderOpenIcon fontSize="small" sx={{ mr: 1 }} />
                Open Install Location
              </MenuItem>
              {selectedEmu?.install_type === "managed" && (
                <MenuItem 
                  onClick={handleUninstallEmulator}
                  sx={{ color: "error.main" }}
                >
                  <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
                  Uninstall
                </MenuItem>
              )}
            </Menu>
          </>
        )}

        {availableEmus.length > 0 && (
          <>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
              Available for Download
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              Version and size are shown when the download source reports them; some release details are resolved only when installation starts.
            </Typography>
            <List dense>
              {availableEmus.map((emu) => {
                const prog = emuInstallProgress[emu.id];
                const busy = Boolean(prog);
                const btnLabel =
                  prog?.phase === "extract"
                    ? "Extracting…"
                    : prog?.phase === "pending"
                      ? "Starting…"
                      : prog
                        ? "Downloading…"
                        : "Install";
                const progressIndeterminate =
                  prog?.phase === "extract" ||
                  prog?.phase === "pending" ||
                  (prog?.phase === "download" && prog?.total == null);
                return (
                  <Box key={emu.id} sx={{ width: "100%", mb: 0.75 }}>
                    <ListItem
                      sx={{
                        borderRadius: 2,
                        flexDirection: "column",
                        alignItems: "stretch",
                        bgcolor: busy ? "action.hover" : "transparent",
                      }}
                    >
                      <Box sx={{ display: "flex", width: "100%", alignItems: "center", gap: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <CloudDownloadIcon color="action" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={emu.name}
                          secondary={(
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mt: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                Supports: {emu.supported_platforms.join(", ").toUpperCase()}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Version: {emu.version || "Not reported"}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Size: {formatOptionalStorageBytes(emu.download_size_bytes)}
                              </Typography>
                              <Chip size="small" label="Not installed" variant="outlined" />
                            </Box>
                          )}
                          sx={{ flex: 1, minWidth: 0 }}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<DownloadIcon />}
                          onClick={() => handleDownloadEmulator(emu.id)}
                          disabled={busy}
                          sx={{ ml: 1, flexShrink: 0 }}
                        >
                          {btnLabel}
                        </Button>
                      </Box>
                      {prog ? (
                        <Box sx={{ width: "100%", pl: { xs: 0, sm: 4.5 }, pr: 0.5, mt: 1, boxSizing: "border-box" }}>
                          <LinearProgress
                            variant={progressIndeterminate ? "indeterminate" : "determinate"}
                            value={prog.percent ?? 0}
                            sx={{ borderRadius: 1, height: 6 }}
                          />
                          {prog.phase === "download" && (prog.downloaded > 0 || prog.total) ? (
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                              {formatDownloadLabel({
                                downloaded: prog.downloaded,
                                total: prog.total,
                                percent: prog.percent,
                              })}
                            </Typography>
                          ) : null}
                          {prog.phase === "extract" ? (
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                              Extracting archive…
                            </Typography>
                          ) : null}
                        </Box>
                      ) : null}
                    </ListItem>
                  </Box>
                );
              })}
            </List>
          </>
        )}

        {unavailableEmus.length > 0 && (
          <>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
              Manual Install Required
            </Typography>
            <List dense>
              {unavailableEmus.map((emu) => (
                <ListItem key={emu.id} sx={{ borderRadius: 2, mb: 0.5, opacity: 0.6 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <OpenInNewIcon color="action" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={emu.name} secondary="Download manually from the emulator's website" />
                </ListItem>
              ))}
            </List>
          </>
        )}

        <Paper
          variant="outlined"
          data-testid="native-controller-card"
          sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: "rgba(33, 150, 243, 0.04)" }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <SportsEsportsIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1">Eden controller</Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadNativeControllers}
              disabled={nativeControllerLoading || nativeControllerCapture !== null}
            >
              Refresh controllers
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Wingosy uses the native SDL controller identity and applies the saved standard mapping to Eden when you play.
            Browser gamepad names are not used for this setup.
          </Typography>
          {nativeControllerMessage && (
            <Alert severity={nativeControllerMessage.type} sx={{ mb: 1.5 }}>
              {nativeControllerMessage.message}
            </Alert>
          )}
          {nativeControllerLoading && <LinearProgress sx={{ mb: 1.5, borderRadius: 1 }} />}
          {!nativeControllerLoading && nativeControllers.length === 0 && !nativeControllerMessage && (
            <Alert severity="info">
              No standard SDL controller is connected. Eden will use its defaults until one is connected.
            </Alert>
          )}
          {nativeControllers.length > 0 && (
            <List dense disablePadding>
              {nativeControllers.map((controller) => (
                <ListItem
                  key={controller.device_id}
                  disableGutters
                  secondaryAction={(
                    <Button
                      size="small"
                      variant={controller.configured ? "outlined" : "contained"}
                      onClick={() => handleCaptureNativeController(controller.device_id)}
                      disabled={nativeControllerCapture !== null}
                    >
                      {nativeControllerCapture === controller.device_id ? "Saving…" : controller.configured ? "Update" : "Capture"}
                    </Button>
                  )}
                >
                  <ListItemText
                    primary={controller.name}
                    secondary={controller.configured ? "Saved mapping for this SDL hardware model" : "No saved mapping"}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
        
        {/* Show missing cores alert if RetroArch is NOT installed but cores are needed */}
        {missingCores.length > 0 && !installedEmus.some(e => e.id === "retroarch") && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              RetroArch support needed for {missingCores.length} game system{missingCores.length === 1 ? "" : "s"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Install RetroArch to play these systems: {missingCores.map(c => c.platform_name).join(", ")}
            </Typography>
          </Alert>
        )}
      </Paper>

      {platforms.length > 0 && installedEmus.length > 0 ? (
        <Paper sx={{ ...SETTINGS_CARD_GRADIENT_SX, flex: 1, minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
            <TuneIcon color="primary" />
            <Typography variant="h6" component="div" sx={{ flex: "1 1 auto", minWidth: 0 }}>
              Platform defaults
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose which emulator to use for each platform with games in your library. &quot;Auto&quot; uses the first available.
            Platforms not listed here stay on Auto until you add a game; install a compatible emulator below to make it available.
            RetroArch appears only after the mapped libretro core for that platform is installed.
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {platforms.map(([platform, gameCount]) => {
              const compatibleEmus = installedEmus.filter((e) => {
                const platformMatch =
                  e.supported_platforms.includes(platform.id) ||
                  e.supported_platforms.includes("*");
                if (!platformMatch) return false;
                if (e.id === "retroarch") {
                  return retroarchCoreReadyPlatformIds.includes(platform.id);
                }
                return true;
              });
              const currentDefault = platformDefaults[platform.id] || "";
              const selectValue = compatibleEmus.some((e) => e.id === currentDefault) ? currentDefault : "";
              const raDll = retroarchCoreDllByPlatform[platform.id];
              const selectedEmulator = compatibleEmus.find((emu) => emu.id === selectValue);
              const selectedLabel = selectedEmulator
                ? selectedEmulator.id === "retroarch" && raDll
                  ? `${selectedEmulator.name} (${formatLibretroDllLabel(raDll)} core)`
                  : selectedEmulator.name
                : null;

              return (
                <Box
                  key={platform.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "minmax(220px, 1fr) minmax(240px, 1.5fr)" },
                    alignItems: "center",
                    gap: 1.5,
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {platform.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {gameCount} game{gameCount !== 1 ? "s" : ""}
                    </Typography>
                  </Box>
                  <Select
                    data-testid={`platform-default-${platform.id}`}
                    aria-label={`${platform.name} default emulator`}
                    value={selectValue}
                    displayEmpty
                    size="small"
                    fullWidth
                    disabled={compatibleEmus.length === 0}
                    renderValue={() => selectedLabel || (compatibleEmus.length > 0 ? "Auto (default)" : "Install a compatible emulator below")}
                    onChange={(e) => handleSetDefaultEmulator(platform.id, e.target.value)}
                  >
                    <MenuItem value="">
                      <em>Auto</em>
                    </MenuItem>
                    {compatibleEmus.map((emu) => (
                      <MenuItem key={emu.id} value={emu.id}>
                        {emu.id === "retroarch" && raDll
                          ? `${emu.name} (${formatLibretroDllLabel(raDll)} core)`
                          : emu.name}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              );
            })}
          </Box>
        </Paper>
      ) : (
        <Paper sx={{ ...SETTINGS_CARD_GRADIENT_SX, flex: 1, minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
            <TuneIcon color="primary" />
            <Typography variant="h6" component="div" sx={{ flex: "1 1 auto", minWidth: 0 }}>
              Platform defaults
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Add games to your library and install at least one emulator to choose a default per platform.
          </Typography>
        </Paper>
      )}
      </Box>
      )}

      {settingsSection === "integrations" && (
      <Paper sx={SETTINGS_CARD_GRADIENT_SX}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <EmojiEventsIcon color="primary" />
          <Typography variant="h6">Integrations</Typography>
          <Chip label="Preview" size="small" color="info" variant="outlined" />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          App-wide preferences for third-party services. These apply to your whole library, not individual games.
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          RetroAchievements tracking and achievement data are not shipped yet. This preview page is informational;
          enabling it currently has no effect and does not add achievement placeholders elsewhere in Wingosy.
        </Alert>
        <FormControlLabel
          control={<Switch checked={false} disabled />}
          label="Enable RetroAchievements"
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, maxWidth: 520 }}>
          The setting stays disabled until the integration is available. Existing game details keep the same
          explanatory off state instead of rendering fake locked achievements.
        </Typography>
      </Paper>
      )}

      {settingsSection === "updates" && (
      <Paper sx={SETTINGS_CARD_SX}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <SystemUpdateIcon color="primary" />
          <Typography variant="h6">Updates</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Wingosy checks GitHub for your selected channel. When a newer signed build is published, use{" "}
          <strong>Download &amp; install</strong> for an in-place update (Windows restarts the app when the installer
          finishes). You can still open the release page for installers or release notes.
        </Typography>
         <AppVersionField value={appVersion} />

         <FormControl component="fieldset" sx={{ mb: 2 }}>
           <FormLabel component="legend">Update behavior</FormLabel>
           <ToggleButtonGroup
             value={updatePreference}
             exclusive
             aria-label="Update mode choices"
             onChange={(_, nextPreference) => {
               if (nextPreference) persistUpdatePreference(nextPreference);
             }}
             size="small"
             sx={{ mt: 1 }}
           >
             <ToggleButton value={UPDATE_PREFERENCE.OFF}>Off</ToggleButton>
             <ToggleButton value={UPDATE_PREFERENCE.CHECK_ONLY}>Check and notify</ToggleButton>
             <ToggleButton value={UPDATE_PREFERENCE.AUTOMATIC}>Automatic</ToggleButton>
           </ToggleButtonGroup>
           <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, maxWidth: 560 }}>
             {updatePreference === UPDATE_PREFERENCE.AUTOMATIC
               ? "Check for updates at startup and install signed updates automatically."
               : updatePreference === UPDATE_PREFERENCE.CHECK_ONLY
                 ? "Check for updates at startup and notify you before installing anything."
                 : "Do not check for updates at startup. You can still check manually below."}
           </Typography>
         </FormControl>

        <FormControl component="fieldset" sx={{ mb: 2 }} variant="standard">
          <FormLabel component="legend">Update channel</FormLabel>
          <RadioGroup
            value={updateChannel}
            onChange={(e) => requestChannelChange(e.target.value)}
          >
            <FormControlLabel value="stable" control={<Radio size="small" />} label="Stable — latest official release" />
            <FormControlLabel
              value="beta"
              control={<Radio size="small" />}
              label="Beta — early preview releases with new features and less testing"
            />
            <FormControlLabel
              value="nightly"
              control={<Radio size="small" />}
              label="Nightly — frequent development releases for trying changes early"
            />
          </RadioGroup>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, maxWidth: 560 }}>
            Beta and Nightly apply to manual and startup checks. Signed in-app installs are available when a release
            includes{" "}
            <Typography component="span" variant="inherit" sx={{ fontFamily: "monospace", color: "text.secondary" }}>
              latest.json
            </Typography>
            ; otherwise use Open release to download the installer manually.
          </Typography>
        </FormControl>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 }}>
          <Button
            variant="contained"
            startIcon={<SystemUpdateIcon />}
            disabled={updateCheckLoading}
            onClick={handleCheckForUpdates}
            data-testid="check-for-updates-button"
          >
            {updateCheckLoading ? "Checking…" : "Check for updates"}
          </Button>
          <Button
            variant="outlined"
            startIcon={<OpenInNewIcon />}
            onClick={() => shellOpen("https://github.com/auron-labs/wingosy-launcher/releases")}
          >
            All releases
          </Button>
        </Box>
        {updateMessage && (
          <Alert severity={updateMessage.type} onClose={() => setUpdateMessage(null)} sx={{ mt: 2 }}>
            {updateMessage.message}
          </Alert>
        )}
        {updateCheckLoading && <LinearProgress sx={{ mt: 2, borderRadius: 1 }} />}
        {updateCheckResult?.error && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {updateCheckResult.error}
            {updateCheckResult.channel ? (
              <Typography variant="caption" sx={{ mt: 1, display: "block" }}>
                Channel: {updateCheckResult.channel}
              </Typography>
            ) : null}
          </Alert>
        )}
        {updateCheckResult && !updateCheckResult.error && updateCheckResult.is_update_available && (
          <Alert
            severity="success"
            sx={{ mt: 2 }}
            action={
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }}>
                {updateCheckResult.signed_update_manifest_url ? (
                  <Button
                    color="inherit"
                    size="small"
                    disabled={signedUpdateInstalling}
                    onClick={() => handleInstallSignedUpdateFromSettings()}
                  >
                    {signedUpdateInstalling ? "Installing…" : "Download & install"}
                  </Button>
                ) : null}
                {updateCheckResult.release_url ? (
                  <Button color="inherit" size="small" onClick={() => shellOpen(updateCheckResult.release_url)}>
                    Open release
                  </Button>
                ) : null}
              </Box>
            }
          >
            Update available on {updateCheckResult.channel || updateChannel}
            {updateCheckResult.latest_version ? ` (${updateCheckResult.latest_version})` : ""}.
            {!updateCheckResult.signed_update_manifest_url ? (
                <Typography variant="caption" sx={{ mt: 1, display: "block" }}>
                In-app install is unavailable for this release (missing or invalid signed updater manifest). Use{" "}
                <strong>Open release</strong> to download the installer manually.
              </Typography>
            ) : null}
          </Alert>
        )}
        {updateCheckResult && !updateCheckResult.error && !updateCheckResult.is_update_available && (
          <Alert severity="info" sx={{ mt: 2 }}>
            You’re up to date on {updateCheckResult.channel || updateChannel}
            {updateCheckResult.latest_version ? ` (latest: ${updateCheckResult.latest_version})` : ""}.
          </Alert>
        )}
      </Paper>
      )}

        </Box>
      </Box>

      <Dialog
        open={storageMigrationDialogOpen}
        onClose={() => !storageChangeBusy && setStorageMigrationDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <DriveFileMoveIcon />
            Move existing ROMs?
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Wingosy found <strong>{storageOverview?.migratable_rom_count || 0}</strong> tracked game
            {(storageOverview?.migratable_rom_count || 0) === 1 ? "" : "s"} ({formatStorageBytes(storageOverview?.migratable_rom_bytes)}) in the current ROM folder.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <strong>Migrate ROMs</strong> copies each game into the new folder, updates its library path, and removes the old copy only after the database update succeeds. Existing destination files are never overwritten.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <strong>Don&apos;t migrate</strong> leaves existing games where they are and sends future downloads to the new folder. Those existing games remain launchable from their saved paths.
          </Typography>
          <Box sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">New ROM folder</Typography>
            <Typography variant="body2" sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}>
              {pendingRomsDirectory}
            </Typography>
          </Box>
          {storageChangeBusy && <LinearProgress sx={{ mt: 2, borderRadius: 1 }} />}
          {activeRomDownloadCount > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Wait for {activeRomDownloadCount} active ROM download{activeRomDownloadCount === 1 ? "" : "s"} to finish before changing storage.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap" }}>
          <Button
            onClick={() => {
              setStorageMigrationDialogOpen(false);
              setPendingRomsDirectory("");
            }}
            disabled={storageChangeBusy}
          >
            Cancel
          </Button>
          <Button
            variant="outlined"
            onClick={() => applyRomsDirectoryChange(pendingRomsDirectory, false)}
            disabled={storageChangeBusy || activeRomDownloadCount > 0}
          >
            Don&apos;t migrate
          </Button>
          <Button
            variant="contained"
            startIcon={<DriveFileMoveIcon />}
            onClick={() => applyRomsDirectoryChange(pendingRomsDirectory, true)}
            disabled={storageChangeBusy || activeRomDownloadCount > 0}
          >
            Migrate ROMs
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={prereleaseLeaveDialogOpen} onClose={cancelPrereleaseLeave} maxWidth="sm" fullWidth>
        <DialogTitle>
          {leavingPrereleaseChannel === "beta" ? "Leave the Beta channel?" : "Leave the Nightly channel?"}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            You’re switching away from{" "}
            <strong>{leavingPrereleaseChannel === "beta" ? "Beta" : "Nightly"}</strong>. Your update checks will follow
            the{" "}
            <strong>
              {pendingChannel === "stable" ? "Stable" : pendingChannel === "beta" ? "Beta" : "Nightly"}
            </strong>{" "}
            channel.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {pendingChannel === "stable" && (
              <>
                On <strong>Stable</strong>, in-app updates follow regular releases.{" "}
              </>
            )}
            If you want the <strong>latest stable build immediately</strong> (for example, to leave beta or nightly sooner
            than the next stable release), download and install it manually from{" "}
            <Box component="span" sx={{ fontWeight: 600 }}>GitHub Releases</Box> — the app does not downgrade by itself.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelPrereleaseLeave}>Cancel</Button>
          <Button variant="contained" onClick={confirmPrereleaseLeave}>
            Continue
          </Button>
        </DialogActions>
      </Dialog>

      {/* Hidden Games Dialog */}
      <Dialog
        open={hiddenDialogOpen}
        onClose={() => setHiddenDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <VisibilityOffIcon />
            Hidden Games
          </Box>
        </DialogTitle>
        <DialogContent>
          {hiddenLoading ? (
            <LinearProgress sx={{ my: 2 }} />
          ) : hiddenGames.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
              No hidden games. Games you hide will appear here.
            </Typography>
          ) : (
            <List dense>
              {hiddenGames.map((game) => (
                <ListItem key={game.id}>
                  <ListItemText
                    primary={game.name}
                    secondary={game.platform_id?.toUpperCase()}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<VisibilityIcon />}
                    onClick={() => handleUnhideGame(game.id)}
                  >
                    Unhide
                  </Button>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHiddenDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
