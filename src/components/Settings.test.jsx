import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Settings from "./Settings";
import { MuiTestProvider } from "../test/muiHarness";

const { invoke, listen, shellOpen, open } = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
  shellOpen: vi.fn(),
  open: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen }));
vi.mock("@tauri-apps/plugin-shell", () => ({ open: shellOpen }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open }));
vi.mock("../ThemeContext", () => ({
  useAppTheme: () => ({
    themeMode: "dark",
    setThemeMode: vi.fn(),
    accentHue: null,
    setAccentHue: vi.fn(),
  }),
}));
vi.mock("../UiSoundsContext", () => ({
  useUiSounds: () => ({
    uiSoundsEnabled: false,
    uiSoundsVolume: 80,
    setUiSoundsEnabled: vi.fn(),
    setUiSoundsVolume: vi.fn(),
    refreshUiSoundsFromConfig: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  invoke.mockReset();
  listen.mockReset();
  shellOpen.mockReset();
  open.mockReset();
});

function renderSettings({ emulators = [], config = {}, initialSection = "general" } = {}) {
  invoke.mockImplementation(async (command) => {
    switch (command) {
      case "get_config":
        return {
          romm: {},
          library: {},
          display: {},
          audio: {},
          updater: {},
          ...config,
        };
      case "get_all_emulators":
        return emulators;
      case "get_missing_cores":
      case "get_platform_ids_with_installed_retroarch_core":
      case "get_platforms_with_games":
        return [];
      case "get_retroarch_default_core_dlls":
      case "get_platform_default_emulators":
        return {};
      case "has_saved_romm_session":
        return false;
      case "get_default_romm_device_name":
        return "Windows PC";
      case "get_app_version":
        return "0.0.111";
      case "get_storage_overview":
        return { roms_directory: "" };
      default:
        return undefined;
    }
  });
  listen.mockResolvedValue(() => {});

  return render(
    <MuiTestProvider>
      <Settings
        onBack={vi.fn()}
        onRommConnect={vi.fn()}
        onLibraryChange={vi.fn()}
        rommToken="test-token"
        rommUrl="https://romm.example"
        initialSection={initialSection}
      />
    </MuiTestProvider>
  );
}

describe("Settings beta support", () => {
  it("loads the controller deadzone and persists the reset default", async () => {
    renderSettings({ config: { display: { controller_deadzone: 0.6 } } });

    const deadzone = await screen.findByRole("slider", { name: "Controller deadzone" });
    expect(deadzone).toHaveValue("0.6");
    expect(deadzone).toHaveAttribute("min", "0.1");
    expect(deadzone).toHaveAttribute("max", "0.8");

    fireEvent.click(screen.getByRole("button", { name: "Reset deadzone" }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("save_config", {
        config: expect.objectContaining({
          display: expect.objectContaining({ controller_deadzone: 0.35 }),
        }),
      });
    });
  });

  it("opens the canonical logs folder from the Private Beta card", async () => {
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Open Logs Folder" }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("open_logs_folder"));
  });

  it("shows report guidance and opens the canonical bug report route", async () => {
    renderSettings();

    expect(screen.getByText(/Windows version/)).toBeInTheDocument();
    expect(screen.getByText(/reproduction steps/)).toBeInTheDocument();
    expect(screen.getByText(/expected and actual behavior/)).toBeInTheDocument();
    expect(screen.getByText(/relevant redacted logs/)).toBeInTheDocument();
    expect(screen.getByText(/Never share credentials, user data/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Report a Problem" }));

    expect(shellOpen).toHaveBeenCalledWith(
      "https://github.com/auron-labs/wingosy-launcher/issues/new?template=bug_report.md"
    );
    expect(await screen.findByText("0.0.111")).toBeInTheDocument();
  });

  it("repairs the Wingosy RetroArch profile for managed installs", async () => {
    renderSettings({
      emulators: [{
        id: "retroarch",
        name: "RetroArch",
        version: "1.19.1",
        install_type: "managed",
        installed_path: "C:\\RetroArch\\retroarch.exe",
        is_installed: true,
        supported_platforms: ["nes"],
      }],
      initialSection: "emulators",
    });

    fireEvent.click(await screen.findByText("RetroArch", { exact: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Repair Wingosy RetroArch profile" }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("repair_retroarch_profile"));
  });

  it("does not offer managed profile repair for external installs", async () => {
    renderSettings({
      emulators: [{
        id: "retroarch",
        name: "RetroArch",
        install_type: "external",
        installed_path: "C:\\RetroArch\\retroarch.exe",
        is_installed: true,
        supported_platforms: ["nes"],
      }],
      config: { emulators: {} },
      initialSection: "emulators",
    });

    fireEvent.click(await screen.findByText("RetroArch", { exact: true }));

    expect(screen.queryByRole("button", { name: "Repair Wingosy RetroArch profile" })).not.toBeInTheDocument();
    expect(screen.getByText("Use Wingosy beta profile for this external install")).toBeInTheDocument();
  });
});
