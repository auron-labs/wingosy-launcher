import { cleanup, render } from "@testing-library/react";
import { vi } from "vitest";

import { MuiTestProvider } from "../test/mui-harness";
import { ThemeContext } from "../theme-context";
import { UiSoundsContext } from "../ui-sounds-context";
import Settings from "./settings";

/** @typedef {import("./settings-types").SettingsConfig} SettingsConfig */
/** @typedef {import("./settings-types").SettingsEmulator} SettingsEmulator */
/** @typedef {import("./settings-types").NativeController} NativeController */
/** @typedef {import("./settings-types").CoreInventory} CoreInventory */
/** @typedef {import("./settings-types").SettingsGame} SettingsGame */
/** @typedef {import("./settings-types").SettingsPlatform} SettingsPlatform */
/** @typedef {import("./bios-types").BiosFirmware} BiosFirmware */
/** @typedef {NonNullable<import("./settings-types").SettingsPanelProps["storageOverview"]>} StorageOverview */
/** @typedef {<T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T>} SettingsInvoke */
/** @typedef {(command: string, args?: Record<string, unknown>) => unknown} SettingsMockInvoke */
/** @type {import("vitest").Mock<SettingsMockInvoke>} */
export const invoke = vi.fn();
/** @type {import("vitest").Mock<typeof import("@tauri-apps/api/event").listen>} */
export const listen = vi.fn();
/** @type {import("vitest").MockedFunction<typeof import("@tauri-apps/plugin-shell").open>} */
export const shellOpen = vi.fn();
/** @type {import("vitest").MockedFunction<typeof import("@tauri-apps/plugin-dialog").open>} */
export const open = vi.fn();
/** @type {import("vitest").Mock<(mode: "dark"|"light"|"system") => void>} */
export const setThemeMode = vi.fn();
/** @type {import("vitest").Mock<(hue: number|null) => void>} */
export const setAccentHue = vi.fn();
/** @type {import("vitest").Mock<(soundId: string) => void>} */
export const previewArgosySound = vi.fn();
/** @type {{enabled: boolean}} */
const soundState = { enabled: false };

/** @type {import("../theme-context").ThemeContextValue} */
const themeValue = {
  accentHue: null,
  colors: {},
  setAccentHue,
  setThemeMode,
  themeMode: "dark",
};
const noOp = () => {
  // Context callbacks are intentionally inert in fixture renders.
};
const soundValue = {
  playArgosySound: vi.fn(),
  previewArgosySound,
  refreshUiSoundsFromConfig: vi.fn(),
  setUiSoundsEnabled: vi.fn(),
  setUiSoundsVolume: vi.fn(),
  get uiSoundsEnabled() {
    return soundState.enabled;
  },
  uiSoundsVolume: 80,
};

/** @typedef {{emulators?: SettingsEmulator[], config?: SettingsConfig, initialSection?: string, inventory?: CoreInventory[]|(() => CoreInventory[]), nativeControllers?: NativeController[], savedRommSession?: boolean, rommConnectionStatus?: string, rommToken?: string|null, rommUrl?: string, syncGames?: SettingsGame[], platforms?: Array<[SettingsPlatform, number]>, biosFirmware?: BiosFirmware[], storageOverview?: StorageOverview, uiSoundsEnabled?: boolean}} SettingsFixtureOptions */

const resetMocks = () => {
  invoke.mockReset();
  listen.mockReset();
  shellOpen.mockReset();
  open.mockReset();
  setThemeMode.mockReset();
  setAccentHue.mockReset();
  previewArgosySound.mockReset();
  soundValue.playArgosySound.mockReset();
  soundValue.refreshUiSoundsFromConfig.mockReset();
  soundValue.setUiSoundsEnabled.mockReset();
  soundValue.setUiSoundsVolume.mockReset();
  soundState.enabled = false;
};

/** Reset settings test DOM and dependency doubles. */
export const cleanupSettingsTest = () => {
  cleanup();
  resetMocks();
};

/** @param {CoreInventory[]|(() => CoreInventory[])} inventory Inventory fixture. @returns {() => CoreInventory[]} Inventory loader. */
const createInventoryLoader = (inventory = []) =>
  Array.isArray(inventory) ? () => inventory : inventory;

/** @param {SettingsFixtureOptions} options Fixture values. @returns {Record<string, unknown>} IPC responses. */
const createSettingsResponses = ({
  biosFirmware,
  config,
  emulators,
  nativeControllers,
  platforms,
  rommConnectionStatus,
  savedRommSession,
  storageOverview,
  syncGames,
}) => ({
  capture_native_controller: {},
  check_romm_connection: rommConnectionStatus,
  get_all_emulators: emulators,
  get_app_version: "0.0.111",
  get_bios_directory: "C:\\Wingosy\\bios",
  get_config: {
    audio: {},
    display: {},
    library: {},
    romm: {},
    updater: {},
    ...config,
  },
  get_default_romm_device_name: "Windows PC",
  get_missing_cores: [],
  get_native_controllers: nativeControllers,
  get_platform_default_emulators: {},
  get_platform_ids_with_installed_retroarch_core: [],
  get_platforms_with_games: platforms,
  get_retroarch_default_core_dlls: {},
  get_storage_overview: storageOverview,
  has_saved_romm_session: savedRommSession,
  list_bios_firmware: biosFirmware,
  sync_romm_library: syncGames,
});

/** @param {SettingsFixtureOptions} options Fixture values. @returns {SettingsMockInvoke} Test IPC implementation. */
const createSettingsInvoke = (options) => {
  const responses = createSettingsResponses(options);
  const inventoryLoader = createInventoryLoader(options.inventory);
  /** @param {string} command IPC command. */
  const settingsInvoke = async (command) => {
    if (command === "get_retroarch_core_inventory") {
      return await Promise.resolve(inventoryLoader());
    }
    return await Promise.resolve(responses[command] ?? null);
  };
  return settingsInvoke;
};

/** @param {SettingsFixtureOptions} [options] Settings test fixture options. */
export const renderSettings = ({
  emulators = [],
  config = {},
  initialSection = "general",
  inventory = [],
  nativeControllers = [],
  savedRommSession = false,
  rommConnectionStatus,
  rommToken = "test-token",
  rommUrl = "https://romm.example",
  syncGames = [],
  platforms = [],
  biosFirmware = [],
  storageOverview = { roms_directory: "" },
  uiSoundsEnabled = false,
} = {}) => {
  resetMocks();
  soundState.enabled = uiSoundsEnabled;
  invoke.mockImplementation(
    createSettingsInvoke({
      biosFirmware,
      config,
      emulators,
      inventory,
      nativeControllers,
      platforms,
      rommConnectionStatus,
      savedRommSession,
      storageOverview,
      syncGames,
    })
  );
  listen.mockResolvedValue(noOp);
  /** @type {SettingsInvoke} */
  // @ts-expect-error -- Vitest does not preserve the overloaded runtime invoke signature.
  const runtimeInvoke = invoke;

  return render(
    <MuiTestProvider>
      <ThemeContext.Provider value={themeValue}>
        <UiSoundsContext.Provider value={soundValue}>
          <Settings
            dependencies={{
              invoke: runtimeInvoke,
              listen,
              openDialog: open,
              shellOpen,
            }}
            onRommConnect={noOp}
            onLibraryChange={noOp}
            rommToken={rommToken}
            rommUrl={rommUrl}
            initialSection={initialSection}
          />
        </UiSoundsContext.Provider>
      </ThemeContext.Provider>
    </MuiTestProvider>
  );
};
