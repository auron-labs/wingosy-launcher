import type { SettingsRuntime } from "./settings-runtime";

export type SettingsHandler = (...args: unknown[]) => void;
export type SettingsSliderValue = number | number[];
export type ThemeMode = "light" | "dark" | "system";
export type SettingsSoundId =
  | "tap"
  | "click"
  | "success"
  | "error"
  | "back"
  | "open"
  | "close";
export interface SettingsConfig {
  romm?: {
    server_url?: string;
    auth_token?: string;
    auth_method?: string;
    auto_sync?: boolean;
  };
  display?: {
    big_picture?: boolean;
    fullscreen?: boolean;
    theme_mode?: string;
    controller_deadzone?: number;
    ui_sounds_enabled?: boolean;
    retroachievements_enabled?: boolean;
    accent_hue?: number | null;
  };
  audio?: {
    ambient_enabled?: boolean;
    ambient_volume?: number;
    ambient_path?: string | null;
    ambient_is_folder?: boolean;
    ambient_shuffle?: boolean;
    ui_sounds_volume?: number;
  };
  updater?: {
    channel?: "stable" | "beta" | "nightly";
    auto_update_enabled?: boolean;
    check_on_startup?: boolean;
  };
  library?: { roms_directory?: string | null };
  emulators?: { retroarch_use_beta_profile?: boolean };
}
export interface SettingsEmulator {
  id: string | number;
  name: string;
  install_type?: string;
  installed_path?: string | null;
  is_installed?: boolean;
  has_download?: boolean;
  version?: string | null;
  supported_platforms: string[];
  download_size_bytes?: number | null;
}
export interface MissingCore {
  platform_id?: string;
  platform_name?: string;
  core_filename?: string;
  required?: boolean;
  status?: string;
}
export interface CoreInventory {
  platform_id?: string;
  platform_name?: string;
  core_filename?: string;
  required?: boolean;
  status?: string;
}
export interface NativeController {
  device_id: string | number;
  guid: string;
  name: string;
  configured?: boolean;
}
export interface SettingsPlatform {
  id: string;
  name: string;
}
export interface SettingsGame {
  id: string | number;
  name: string;
  platform_id?: string;
}
export interface SettingsPanelProps {
  accentHue: number | null;
  activeRomDownloadCount: number;
  ambientEnabled: boolean;
  ambientIsFolder: boolean;
  ambientPath: string | null;
  ambientShuffle: boolean;
  ambientVolume: number;
  appVersion: string;
  availableEmus: SettingsEmulator[];
  config: SettingsConfig | null;
  controllerDeadzone: number;
  downloadingCore: string | null;
  emuInstallProgress: Record<
    string | number,
    {
      phase?: string;
      downloaded?: number;
      total?: number | null;
      percent?: number | null;
    }
  >;
  emuMenuAnchor: HTMLElement | null;
  emuMessage: {
    type: "error" | "warning" | "info" | "success";
    message: string;
  } | null;
  expandedEmu: string | number | null;
  fullscreenEnabled: boolean;
  hiddenDialogOpen: boolean;
  hiddenGames: SettingsGame[];
  hiddenLoading: boolean;
  immersiveModeEnabled: boolean;
  installedEmus: SettingsEmulator[];
  missingCores: MissingCore[];
  nativeControllerCapture: string | null;
  nativeControllerLoading: boolean;
  nativeControllerMessage: {
    type: "error" | "warning" | "info" | "success";
    message: string;
  } | null;
  nativeControllers: NativeController[];
  retroarchCoreDllByPlatform: Record<string, string>;
  retroarchCoreReadyPlatformIds: string[];
  prereleaseLeaveDialogOpen: boolean;
  leavingPrereleaseChannel: "nightly" | "beta" | null;
  pendingChannel: string;
  pendingRomsDirectory: string;
  platforms: [SettingsPlatform, number][];
  platformDefaults: Record<string, string | number>;
  retroarchCoreInventory: CoreInventory[];
  runtime: SettingsRuntime;
  rommAuthMode: "pairing" | "token";
  rommConnectionStatus:
    | "checking"
    | "downloaded-not-synced"
    | "not-configured"
    | "offline"
    | "online"
    | "remote-only"
    | "synced";
  rommDeviceName: string;
  rommDirectToken: string;
  rommDisconnectDialogOpen: boolean;
  rommPairing: { device_code: string; user_code: string } | null;
  rommSessionActive: boolean;
  rommStatus: {
    type: "error" | "warning" | "info" | "success";
    message: string;
  } | null;
  rommSyncMetadata: {
    autoSync: boolean;
    lastSyncedAt: string | null;
    libraryCount: number | null;
  };
  rommUrl: string;
  rommUrlLocked: boolean;
  romsDirectory: string;
  scanMessage: {
    type: "error" | "warning" | "info" | "success";
    message: string;
  } | null;
  selectedEmu: SettingsEmulator | null;
  settingsSection: string;
  signedUpdateInstalling: boolean;
  storageChangeBusy: boolean;
  storageLoading: boolean;
  storageMigrationDialogOpen: boolean;
  storageOverview: {
    migratable_rom_count?: number;
    migratable_rom_bytes?: number;
    tracked_rom_count?: number;
    tracked_rom_bytes?: number;
    free_disk_bytes?: number;
    roms_directory?: string;
    active_rom_downloads?: number;
    using_default_roms_directory?: boolean;
    locations?: {
      key: string;
      label: string;
      path: string;
      exists: boolean;
      bytes?: number;
    }[];
  } | null;
  supportMessage: {
    type: "error" | "warning" | "info" | "success";
    message: string;
  } | null;
  themeMode: "light" | "dark" | "system";
  uiSoundsEnabled: boolean;
  uiSoundsVolume: number;
  updateChannel: string;
  updateCheckLoading: boolean;
  updateCheckResult: {
    error?: string;
    channel?: string;
    is_update_available: boolean;
    signed_update_manifest_url?: string | null;
    release_url?: string | null;
    latest_version?: string | null;
  } | null;
  updateMessage: {
    type: "error" | "warning" | "info" | "success";
    message: string;
  } | null;
  updatePreference: string;
  unavailableEmus: SettingsEmulator[];
  applyRomsDirectoryChange: SettingsHandler;
  cancelDevicePairing: SettingsHandler;
  cancelPrereleaseLeave: SettingsHandler;
  clearAmbientSource: () => Promise<void> | void;
  confirmPrereleaseLeave: SettingsHandler;
  defaultGamepadDeadzone: number;
  gamepadDeadzoneMin: number;
  gamepadDeadzoneMax: number;
  getInstallTypeLabel: (installType?: string | null) => string;
  handleApplyPaths: SettingsHandler;
  handleCaptureNativeController: SettingsHandler;
  handleChangeRomsDirectory: SettingsHandler;
  handleCheckForUpdates: SettingsHandler;
  handleConnectRomM: SettingsHandler;
  handleCopyEmulatorPath: SettingsHandler;
  handleDownloadCore: SettingsHandler;
  handleDownloadEmulator: SettingsHandler;
  handleEmuMenuClose: SettingsHandler;
  handleEmuMenuOpen: SettingsHandler;
  handleDisconnectRomM: SettingsHandler;
  handleInstallSignedUpdateFromSettings: SettingsHandler;
  handleLaunchEmulator: SettingsHandler;
  handleOpenHiddenDialog: SettingsHandler;
  handleOpenLocation: SettingsHandler;
  handleOpenLogsFolder: SettingsHandler;
  handleOpenRetroarchInputSetup: SettingsHandler;
  handleOpenStorageLocation: SettingsHandler;
  handleReportProblem: SettingsHandler;
  handleRepairRetroarchProfile: SettingsHandler;
  handleResetRetroarchControllerAdditions: SettingsHandler;
  handleResetRomsDirectory: SettingsHandler;
  handleRetroarchBetaProfileChange: SettingsHandler;
  handleScanCustomDirectory: SettingsHandler;
  handleScanDirectory: SettingsHandler;
  handleSetDefaultEmulator: SettingsHandler;
  handleSyncRomM: SettingsHandler;
  handleUnhideGame: SettingsHandler;
  handleUninstallEmulator: SettingsHandler;
  loadEmulators: SettingsHandler;
  loadMissingCores: SettingsHandler;
  loadNativeControllers: SettingsHandler;
  normalizeGamepadDeadzone: (value: number) => number;
  persistAmbient: (updates: {
    ambient_enabled?: boolean;
    ambient_shuffle?: boolean;
    ambient_volume?: number;
  }) => Promise<void> | void;
  persistControllerDeadzone: (value: number) => Promise<void>;
  persistDisplayFlags: (
    immersiveModeEnabled: boolean,
    fullscreenEnabled: boolean
  ) => Promise<void>;
  persistRetroAchievements: (enabled: boolean) => Promise<void>;
  persistUiSounds: (enabled: boolean) => Promise<void> | void;
  persistUiSoundsVolume: (value: SettingsSliderValue) => Promise<void> | void;
  persistUpdatePreference: SettingsHandler;
  pickAmbientFile: () => Promise<void> | void;
  pickAmbientFolder: () => Promise<void> | void;
  previewArgosySound: SettingsHandler;
  requestChannelChange: SettingsHandler;
  setAccentHue: SettingsHandler;
  setAmbientVolume: SettingsHandler;
  setControllerDeadzone: (value: number) => void;
  setEmuMessage: SettingsHandler;
  setExpandedEmu: SettingsHandler;
  setFullscreenEnabled: (value: boolean) => void;
  setHiddenDialogOpen: SettingsHandler;
  setImmersiveModeEnabled: (value: boolean) => void;
  setPendingRomsDirectory: SettingsHandler;
  setRommAuthMode: SettingsHandler;
  setRommDeviceName: SettingsHandler;
  setRommDirectToken: SettingsHandler;
  setRommDisconnectDialogOpen: SettingsHandler;
  setRommUrl: SettingsHandler;
  setSettingsSection: SettingsHandler;
  setStorageMigrationDialogOpen: SettingsHandler;
  setThemeMode: SettingsHandler;
  setUiSoundsVolume: SettingsHandler;
  setUpdateMessage: SettingsHandler;
  onFullscreenChange: SettingsHandler | null;
  onImmersiveModeChange: SettingsHandler | null;
  onRetroAchievementsChange: ((enabled: boolean) => void) | null;
  onLibraryChange: (() => void | Promise<void>) | null | undefined;
  argosySoundEntries: { id: SettingsSoundId; label: string }[];
  accentHue: number | null;
}
