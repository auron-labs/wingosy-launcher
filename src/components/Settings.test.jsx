import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MuiTestProvider } from "../test/muiHarness";
import Settings from "./Settings";

const {
  invoke,
  listen,
  shellOpen,
  open,
  setThemeMode,
  setAccentHue,
  previewArgosySound,
  soundState,
} = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
  open: vi.fn(),
  previewArgosySound: vi.fn(),
  setAccentHue: vi.fn(),
  setThemeMode: vi.fn(),
  shellOpen: vi.fn(),
  soundState: { enabled: false },
}));

vi.mock(import("@tauri-apps/api/core"), () => ({ invoke }));
vi.mock(import("@tauri-apps/api/event"), () => ({ listen }));
vi.mock(import("@tauri-apps/plugin-shell"), () => ({ open: shellOpen }));
vi.mock(import("@tauri-apps/plugin-dialog"), () => ({ open }));
vi.mock(import("../ThemeContext"), () => ({
  useAppTheme: () => ({
    accentHue: null,
    setAccentHue,
    setThemeMode,
    themeMode: "dark",
  }),
}));
vi.mock(import("../UiSoundsContext"), () => ({
  useUiSounds: () => ({
    previewArgosySound,
    refreshUiSoundsFromConfig: vi.fn(),
    setUiSoundsEnabled: vi.fn(),
    setUiSoundsVolume: vi.fn(),
    uiSoundsEnabled: soundState.enabled,
    uiSoundsVolume: 80,
  }),
}));

afterEach(() => {
  cleanup();
  invoke.mockReset();
  listen.mockReset();
  shellOpen.mockReset();
  open.mockReset();
  setThemeMode.mockReset();
  setAccentHue.mockReset();
  previewArgosySound.mockReset();
  soundState.enabled = false;
});

/**
 * @param {{ emulators?: any[], config?: any, initialSection?: string, inventory?: any[] | (() => any[]), nativeControllers?: any[], savedRommSession?: boolean, rommConnectionStatus?: string, rommToken?: string | null, rommUrl?: string, syncGames?: any[], platforms?: any[], biosFirmware?: any[], storageOverview?: any }} options
 */
function renderSettings({
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
} = {}) {
  invoke.mockImplementation(async (command) => {
    switch (command) {
      case "get_config": {
        return {
          romm: {},
          library: {},
          display: {},
          audio: {},
          updater: {},
          ...config,
        };
      }
      case "get_all_emulators": {
        return emulators;
      }
      case "get_native_controllers": {
        return nativeControllers;
      }
      case "capture_native_controller": {
        return {};
      }
      case "get_retroarch_core_inventory": {
        return typeof inventory === "function" ? inventory() : inventory;
      }
      case "get_missing_cores":
      case "get_platform_ids_with_installed_retroarch_core": {
        return [];
      }
      case "get_platforms_with_games": {
        return platforms;
      }
      case "get_retroarch_default_core_dlls":
      case "get_platform_default_emulators": {
        return {};
      }
      case "has_saved_romm_session": {
        return savedRommSession;
      }
      case "check_romm_connection": {
        return rommConnectionStatus;
      }
      case "sync_romm_library": {
        return syncGames;
      }
      case "get_default_romm_device_name": {
        return "Windows PC";
      }
      case "get_app_version": {
        return "0.0.111";
      }
      case "get_storage_overview": {
        return storageOverview;
      }
      case "get_bios_directory": {
        return "C:\\Wingosy\\bios";
      }
      case "list_bios_firmware": {
        return biosFirmware;
      }
      default: {
        return undefined;
      }
    }
  });
  listen.mockResolvedValue(() => {});

  return render(
    <MuiTestProvider>
      <Settings
        onRommConnect={vi.fn()}
        onLibraryChange={vi.fn()}
        rommToken={rommToken}
        rommUrl={rommUrl}
        initialSection={initialSection}
      />
    </MuiTestProvider>
  );
}

describe("Settings beta support", () => {
  it("sections beta guidance, labels the selectable app version, and uses plain support language", async () => {
    renderSettings();

    await expect(
      screen.findByRole("textbox", { name: "App version" })
    ).resolves.toHaveValue("0.0.111");
    expect(screen.getByText("Private beta scope")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Windows 11 with RetroArch for NES, SNES, GB, GBC, GBA, and Genesis/
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("View supported emulator paths")
    ).toBeInTheDocument();
    expect(screen.queryByText(/certification ledger/i)).not.toBeInTheDocument();
  });

  it("explains why fullscreen is disabled outside Immersive mode", async () => {
    renderSettings();

    const fullscreenSwitch = await screen.findByRole("switch", {
      name: "Fullscreen (Immersive)",
    });
    expect(fullscreenSwitch).toBeDisabled();
    expect(
      screen.getByText("Enable Immersive mode to use fullscreen.")
    ).toBeInTheDocument();
  });

  it("uses the settings navigation and labels the shared RomM status without a redundant Back button", async () => {
    renderSettings({ rommToken: null, rommUrl: "" });

    expect(
      screen.queryByRole("button", { name: "Back" })
    ).not.toBeInTheDocument();
    const status = await screen.findByTestId("settings-sync-status");
    expect(status).toHaveTextContent("Not configured");

    fireEvent.mouseOver(status);
    await expect(screen.findByRole("tooltip")).resolves.toHaveTextContent(
      "Connect to a RomM server"
    );
  });

  it("makes the connected RomM server URL read-only until the session is disconnected", async () => {
    renderSettings({
      config: { romm: { server_url: "https://romm.example" } },
      initialSection: "romm",
      rommConnectionStatus: "online",
      savedRommSession: true,
    });

    const serverUrl = await screen.findByRole("textbox", {
      name: "Server URL",
    });
    await waitFor(() => {
      expect(serverUrl).toBeDisabled();
    });
    expect(screen.getByTestId("settings-sync-status")).toHaveTextContent(
      "Connected"
    );
    expect(
      screen.getByText("Connected. Disconnect before changing the server URL.")
    ).toBeInTheDocument();
  });

  it("uses one RomM connection status instead of separate Connected and Session saved indicators", async () => {
    renderSettings({
      initialSection: "romm",
      rommConnectionStatus: "online",
      savedRommSession: true,
    });

    await screen.findByTestId("romm-settings-card");
    // Exactly one status indicator: the shared header chip (not a duplicate in the section).
    expect(screen.getByTestId("settings-sync-status")).toHaveTextContent(
      "Connected"
    );
    expect(screen.queryByTestId("romm-sync-status")).not.toBeInTheDocument();
    const rommCard = screen.getByTestId("romm-settings-card");
    expect(
      within(rommCard).queryByText("Session saved")
    ).not.toBeInTheDocument();
    expect(
      within(rommCard).queryByRole("button", { name: "Connected" })
    ).not.toBeInTheDocument();
  });

  it("confirms the shared destructive RomM disconnect action before invoking it", async () => {
    renderSettings({
      initialSection: "romm",
      rommConnectionStatus: "online",
      savedRommSession: true,
    });

    fireEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/removes the saved RomM session/)
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Disconnect" }));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("disconnect_romm");
    });
  });

  it("explains each RomM authentication method and reveals the token field when selected", async () => {
    renderSettings({ initialSection: "romm" });

    expect(
      screen.getByRole("button", { name: "Device pairing" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Access token" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Secure device pairing opens RomM in your browser/)
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Access token")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Access token" }));

    await expect(
      screen.findByText(/Use a RomM access token/)
    ).resolves.toBeInTheDocument();
    expect(screen.getByLabelText("Access token")).toBeInTheDocument();
  });

  it("surfaces available RomM sync metadata without inventing a schedule", async () => {
    renderSettings({
      config: {
        romm: {
          auto_sync: true,
          server_url: "https://romm.example",
        },
      },
      initialSection: "romm",
      rommConnectionStatus: "online",
      savedRommSession: true,
      syncGames: [{ id: 1 }, { id: 2 }],
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Sync Library" })
    );
    await expect(
      screen.findByText("Synced 2 games from RomM!")
    ).resolves.toBeInTheDocument();
    const metadata = await screen.findByTestId("romm-sync-metadata");
    expect(metadata).toHaveTextContent("Last synced");
    expect(screen.getByTestId("romm-last-synced-value")).not.toHaveTextContent(
      "Not reported"
    );
    expect(metadata).toHaveTextContent("2 games");
    expect(metadata).toHaveTextContent("Next scheduled sync");
    expect(screen.getByTestId("romm-next-sync-value")).toHaveTextContent(
      "Automatic"
    );
  });

  it("marks RetroAchievements as a disabled preview instead of offering a dead-end toggle", async () => {
    renderSettings({ initialSection: "integrations" });

    await expect(screen.findByText("Preview")).resolves.toBeInTheDocument();
    expect(
      screen.getByText(/tracking and achievement data are not shipped yet/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Enable RetroAchievements" })
    ).toBeDisabled();
  });

  it("loads the controller deadzone and persists the reset default", async () => {
    renderSettings({ config: { display: { controller_deadzone: 0.6 } } });

    const deadzone = await screen.findByRole("slider", {
      name: "Controller deadzone",
    });
    expect(deadzone).toHaveValue("0.6");
    expect(deadzone).toHaveAttribute("min", "0.1");
    expect(deadzone).toHaveAttribute("max", "0.8");
    expect(screen.getByTestId("controller-deadzone-value")).toHaveTextContent(
      "60%"
    );
    expect(screen.getByRole("button", { name: "Reset deadzone" })).toHaveClass(
      "MuiButton-outlined"
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset deadzone" }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("save_config", {
        config: expect.objectContaining({
          display: expect.objectContaining({ controller_deadzone: 0.35 }),
        }),
      });
    });
  });

  it("previews theme choices and clarifies the default accent swatch", async () => {
    renderSettings({ initialSection: "appearance" });

    await expect(
      screen.findByText("Theme preview")
    ).resolves.toBeInTheDocument();
    expect(screen.getByTestId("theme-preview-light")).toBeInTheDocument();
    expect(screen.getByTestId("theme-preview-system")).toBeInTheDocument();
    expect(screen.getByTestId("theme-preview-dark")).toBeInTheDocument();
    expect(screen.getByTestId("accent-hue-value")).toHaveTextContent("235°");
    expect(
      screen.getByText(/The Default \(Indigo\) swatch is the built-in accent/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reset to Default" })
    ).toHaveClass("MuiButton-contained");
  });

  it("disables sound children with their parent and offers a UI sound preview", async () => {
    renderSettings({
      config: {
        audio: {
          ambient_enabled: false,
          ambient_is_folder: true,
          ambient_path: "C:\\Music",
          ambient_volume: 35,
        },
      },
      initialSection: "sound",
    });

    await expect(
      screen.findByRole("slider", { name: "UI sounds volume" })
    ).resolves.toBeDisabled();
    expect(screen.getByTestId("ui-sound-preview-tap")).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Preview" })).toHaveLength(7);
    expect(
      screen.getByRole("slider", { name: "Background music volume" })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Audio file…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Folder…" })).toBeDisabled();
    expect(screen.getByTestId("ui-sounds-value")).toHaveTextContent("80%");
    expect(screen.getByTestId("ambient-volume-value")).toHaveTextContent("35%");
  });

  it("offers a preview action for every bundled UI sound", () => {
    soundState.enabled = true;
    renderSettings({ initialSection: "sound" });

    for (const soundId of [
      "tap",
      "click",
      "success",
      "error",
      "back",
      "open",
      "close",
    ]) {
      fireEvent.click(screen.getByTestId(`ui-sound-preview-${soundId}`));
    }

    expect(
      previewArgosySound.mock.calls.map(([soundId]) => soundId)
    ).toStrictEqual([
      "tap",
      "click",
      "success",
      "error",
      "back",
      "open",
      "close",
    ]);
  });

  it("uses one three-state update preference control and persists automatic mode", async () => {
    renderSettings({
      config: {
        updater: {
          auto_update_enabled: false,
          channel: "stable",
          check_on_startup: true,
        },
      },
      initialSection: "updates",
    });

    await expect(
      screen.findByRole("group", { name: "Update mode choices" })
    ).resolves.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Off" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Check and notify" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Automatic" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Automatic" }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("save_config", {
        config: expect.objectContaining({
          updater: expect.objectContaining({
            auto_update_enabled: true,
            check_on_startup: true,
          }),
        }),
      });
    });
  });

  it("uses a labeled version field and user-language update channel descriptions", async () => {
    renderSettings({
      config: {
        updater: {
          auto_update_enabled: false,
          channel: "stable",
          check_on_startup: true,
        },
      },
      initialSection: "updates",
    });

    await expect(
      screen.findByRole("textbox", { name: "App version" })
    ).resolves.toHaveValue("0.0.111");
    expect(screen.getByText("latest.json").tagName).not.toBe("CODE");
    expect(
      screen.getByText(/Beta — early preview releases/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Nightly — frequent development releases/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/tag contains/i)).not.toBeInTheDocument();
  });

  it("opens the canonical logs folder from the Private Beta card", async () => {
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Open Logs Folder" }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("open_logs_folder");
    });
  });

  it("shows report guidance and opens the canonical bug report route", async () => {
    renderSettings();

    expect(screen.getByText(/Windows version/)).toBeInTheDocument();
    expect(screen.getByText(/reproduction steps/)).toBeInTheDocument();
    expect(
      screen.getByText(/expected and actual behavior/)
    ).toBeInTheDocument();
    expect(screen.getByText(/relevant redacted logs/)).toBeInTheDocument();
    expect(
      screen.getByText(/Never share credentials, user data/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Report a Problem" }));

    expect(shellOpen).toHaveBeenCalledWith(
      "https://github.com/auron-labs/wingosy-launcher/issues/new?template=bug_report.md"
    );
    await expect(
      screen.findByRole("textbox", { name: "App version" })
    ).resolves.toHaveValue("0.0.111");
  });

  it("repairs the Wingosy RetroArch profile for managed installs", async () => {
    renderSettings({
      emulators: [
        {
          id: "retroarch",
          install_type: "managed",
          installed_path: "C:\\RetroArch\\retroarch.exe",
          is_installed: true,
          name: "RetroArch",
          supported_platforms: ["nes"],
          version: "1.19.1",
        },
      ],
      initialSection: "emulators",
    });

    fireEvent.click(await screen.findByText("RetroArch", { exact: true }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Repair Wingosy controller setup",
      })
    );

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("repair_retroarch_profile");
    });
  });

  it("captures a native SDL controller without using browser identity", async () => {
    renderSettings({
      initialSection: "emulators",
      nativeControllers: [
        {
          configured: false,
          device_id: 7,
          guid: "000000005e0400008e02000000000000",
          name: "USB Gamepad",
        },
      ],
    });

    await expect(screen.findByText("USB Gamepad")).resolves.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Capture" }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("capture_native_controller", {
        deviceId: 7,
      });
    });
    expect(
      screen.getByText("Controller mapping saved for this SDL hardware model.")
    ).toBeInTheDocument();
  });

  it("does not offer managed profile repair for external installs", async () => {
    renderSettings({
      config: { emulators: {} },
      emulators: [
        {
          id: "retroarch",
          name: "RetroArch",
          install_type: "external",
          installed_path: "C:\\RetroArch\\retroarch.exe",
          is_installed: true,
          supported_platforms: ["nes"],
        },
      ],
      initialSection: "emulators",
    });

    fireEvent.click(await screen.findByText("RetroArch", { exact: true }));

    expect(
      screen.queryByRole("button", { name: "Repair Wingosy controller setup" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Use Wingosy controller settings for this installation")
    ).toBeInTheDocument();
  });

  it("renders the current managed core inventory with required and validity states", async () => {
    renderSettings({
      emulators: [
        {
          id: "retroarch",
          install_type: "managed",
          installed_path: "C:\\RetroArch\\retroarch.exe",
          is_installed: true,
          name: "RetroArch",
          supported_platforms: ["*"],
          version: "1.19.1",
        },
      ],
      initialSection: "emulators",
      inventory: [
        {
          core_filename: "fceumm_libretro.dll",
          platform_id: "nes",
          platform_name: "Nintendo Entertainment System",
          required: true,
          status: "installed",
        },
        {
          core_filename: "snes9x_libretro.dll",
          platform_id: "snes",
          platform_name: "Super Nintendo",
          required: true,
          status: "invalid",
        },
      ],
    });

    fireEvent.click(await screen.findByText("RetroArch", { exact: true }));

    await expect(
      screen.findByText("Supported RetroArch systems:")
    ).resolves.toBeInTheDocument();
    expect(screen.getByTestId("retroarch-core-status-nes")).toHaveTextContent(
      "Installed"
    );
    expect(screen.getByTestId("retroarch-core-status-snes")).toHaveTextContent(
      "Invalid"
    );
    expect(screen.getAllByText("Required")).toHaveLength(2);
  });

  it("refreshes core status from disk after the managed installation changes", async () => {
    let currentInventory = [
      {
        core_filename: "fceumm_libretro.dll",
        platform_id: "nes",
        platform_name: "Nintendo Entertainment System",
        required: true,
        status: "missing",
      },
    ];

    renderSettings({
      emulators: [
        {
          id: "retroarch",
          install_type: "managed",
          installed_path: "C:\\RetroArch\\retroarch.exe",
          is_installed: true,
          name: "RetroArch",
          supported_platforms: ["*"],
          version: "1.19.1",
        },
      ],
      initialSection: "emulators",
      inventory: () => currentInventory,
    });

    fireEvent.click(await screen.findByText("RetroArch", { exact: true }));
    await expect(
      screen.findByTestId("retroarch-core-status-nes")
    ).resolves.toHaveTextContent("Missing");

    currentInventory = [{ ...currentInventory[0], status: "installed" }];
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(screen.getByTestId("retroarch-core-status-nes")).toHaveTextContent(
        "Installed"
      );
    });
  });

  it("labels installed emulator actions and exposes the full install path", async () => {
    renderSettings({
      emulators: [
        {
          id: "dolphin",
          install_type: "external",
          installed_path: "C:\\Games\\Emulators\\Dolphin\\Dolphin.exe",
          is_installed: true,
          name: "Dolphin",
          supported_platforms: ["gc", "wii"],
          version: "5.0",
        },
      ],
      initialSection: "emulators",
    });

    await expect(
      screen.findByRole("button", { name: "Launch" })
    ).resolves.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open folder" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy path" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();

    fireEvent.mouseOver(
      screen.getByText("C:\\Games\\Emulators\\Dolphin\\Dolphin.exe")
    );
    await expect(screen.findByRole("tooltip")).resolves.toHaveTextContent(
      "C:\\Games\\Emulators\\Dolphin\\Dolphin.exe"
    );
  });

  it("shows honest download metadata and an explicit uninstalled state", async () => {
    renderSettings({
      emulators: [
        {
          has_download: true,
          id: "pcsx2",
          is_installed: false,
          name: "PCSX2",
          supported_platforms: ["ps2"],
        },
      ],
      initialSection: "emulators",
    });

    await expect(
      screen.findByText("Version: Not reported")
    ).resolves.toBeInTheDocument();
    expect(screen.getByText("Size: Not reported")).toBeInTheDocument();
    expect(screen.getByText("Not installed")).toBeInTheDocument();
    expect(
      screen.getByText(
        /some release details are resolved only when installation starts/
      )
    ).toBeInTheDocument();
  });

  it("aligns platform defaults and displays Auto as the selected value", async () => {
    renderSettings({
      emulators: [
        {
          id: "mgba",
          name: "mGBA",
          is_installed: true,
          install_type: "external",
          installed_path: "C:\\mGBA\\mGBA.exe",
          supported_platforms: ["nes"],
        },
      ],
      initialSection: "emulators",
      platforms: [[{ id: "nes", name: "Nintendo Entertainment System" }, 3]],
    });

    const select = await screen.findByTestId("platform-default-nes");
    expect(select).toHaveTextContent("Auto");
    expect(
      screen.getByText(/Platforms not listed here stay on Auto/)
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Emulator", { exact: true })
    ).not.toBeInTheDocument();
  });

  it("explains unavailable BIOS totals and offers a per-platform download", async () => {
    renderSettings({
      biosFirmware: [
        {
          id: 1,
          platform_slug: "gba",
          platform_name: "Game Boy Advance",
          file_name: "gba-bios.bin",
          file_size_bytes: 1024,
          missing_from_fs: false,
          is_downloaded: false,
        },
        {
          id: 2,
          platform_slug: "ps2",
          platform_name: "PlayStation 2",
          file_name: "ps2-bios.bin",
          file_size_bytes: 2048,
          missing_from_fs: true,
          is_downloaded: false,
        },
      ],
      initialSection: "bios",
      platforms: [[{ id: "gba", name: "Game Boy Advance" }, 4]],
    });

    await expect(
      screen.findByTestId("bios-count-explanation")
    ).resolves.toHaveTextContent("1 listed file is unavailable");
    expect(screen.getByText("Needed by your library")).toBeInTheDocument();
    expect(screen.getByText("0 of 1 available downloaded")).toBeInTheDocument();
    const downloadButton = screen.getByRole("button", {
      name: "Download missing (1)",
    });
    expect(downloadButton).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Show files" })).toHaveLength(
      2
    );

    fireEvent.click(downloadButton);
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("download_bios_firmware", {
        firmwareId: 1,
      });
    });
  });

  it("adds free-space status, ordered directory actions, and clickable storage rows", async () => {
    renderSettings({
      config: { library: { roms_directory: "C:\\Games\\ROMs" } },
      initialSection: "library",
      storageOverview: {
        active_rom_downloads: 0,
        locations: [
          {
            key: "roms",
            label: "ROMs",
            path: "C:\\Games\\ROMs",
            exists: true,
            bytes: 4096,
          },
        ],
        migratable_rom_bytes: 0,
        migratable_rom_count: 0,
        roms_directory: "C:\\Games\\ROMs",
        tracked_rom_bytes: 4096,
        tracked_rom_count: 2,
        using_default_roms_directory: false,
      },
    });

    await expect(
      screen.findByText("Free disk space")
    ).resolves.toBeInTheDocument();
    expect(screen.getByTestId("storage-free-space-value")).toHaveTextContent(
      "Not reported"
    );
    expect(
      screen.getByText(
        "Free disk space is not reported by the current backend."
      )
    ).toBeInTheDocument();
    const directoryBox = screen.getByText(
      "ROM Storage Directory"
    ).parentElement;
    expect(
      within(directoryBox).getByRole("button", { name: "Change" })
    ).toBeInTheDocument();
    expect(
      within(directoryBox).getByRole("button", { name: "Reset to default" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open ROMs folder" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Changing folders never moves files silently/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open ROMs folder" }));
    await waitFor(() => {
      expect(shellOpen).toHaveBeenCalledWith("C:\\Games\\ROMs");
    });
  });

  it("formats the backend-reported free disk space", async () => {
    renderSettings({
      initialSection: "library",
      storageOverview: {
        free_disk_bytes: 2 * 1024 ** 3,
        roms_directory: "C:\\Games\\ROMs",
      },
    });

    await expect(
      screen.findByTestId("storage-free-space-value")
    ).resolves.toHaveTextContent("2.00 GB");
    expect(
      screen.queryByText(
        "Free disk space is not reported by the current backend."
      )
    ).not.toBeInTheDocument();
  });
});
