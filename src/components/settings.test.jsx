import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cleanupSettingsTest,
  invoke,
  previewArgosySound,
  renderSettings,
  shellOpen,
} from "./settings-test-fixtures";

/** @param {unknown} calls Recorded settings IPC calls. @returns {boolean} Whether an automatic update save was issued. */
const hasAutomaticUpdateSave = (calls) => {
  const serialized = JSON.stringify(calls) ?? "";
  return (
    serialized.includes('"save_config"') &&
    serialized.includes('"auto_update_enabled":true')
  );
};

describe("Settings beta guidance", () => {
  afterEach(cleanupSettingsTest);

  it("sections beta guidance, labels the selectable app version, and uses plain support language", async () => {
    renderSettings();

    await expect(
      screen.findByRole("textbox", { name: "App version" })
    ).resolves.toHaveValue("0.0.111");
    expect(screen.getByText("Private beta scope")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Windows 11 with RetroArch for NES, SNES, GB, GBC, GBA, and Genesis/u
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("View supported emulator paths")
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/certification ledger/iu)
    ).not.toBeInTheDocument();
  });
});

describe("Settings general controls", () => {
  afterEach(cleanupSettingsTest);

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
});

describe("Settings navigation status", () => {
  afterEach(cleanupSettingsTest);

  it("uses the settings navigation and labels shared RomM status", async () => {
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
});

describe("Settings desktop navigation", () => {
  afterEach(cleanupSettingsTest);

  it("offers a semantic Back to Library button that uses desktop navigation", () => {
    const onNavigate = vi.fn(() => {});
    renderSettings({ onNavigate });

    fireEvent.click(screen.getByRole("button", { name: "Back to Library" }));

    expect(onNavigate).toHaveBeenCalledExactlyOnceWith("library");
  });
});

describe("Settings controller controls", () => {
  afterEach(cleanupSettingsTest);

  it("loads and resets the controller deadzone", async () => {
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
      expect(invoke.mock.calls.at(-1)?.[1]).toMatchObject({
        config: { display: { controller_deadzone: 0.35 } },
      });
    });
  });
});

describe("Settings appearance and sound", () => {
  afterEach(cleanupSettingsTest);

  it("previews theme choices and clarifies the default accent", async () => {
    renderSettings({ initialSection: "appearance" });

    await expect(
      screen.findByText("Theme preview")
    ).resolves.toBeInTheDocument();
    expect(screen.getAllByTestId(/theme-preview-/u)).toHaveLength(3);
    expect(screen.getByTestId("accent-hue-value")).toHaveTextContent("235°");
    expect(
      screen.getByText(/The Default \(Indigo\) swatch is the built-in accent/u)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reset to Default" })
    ).toHaveClass("MuiButton-contained");
  });
});

describe("Settings sound controls", () => {
  afterEach(cleanupSettingsTest);

  it("disables sound children with their parent", async () => {
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
  });
});

describe("Settings ambient sound controls", () => {
  afterEach(cleanupSettingsTest);

  it("disables ambient controls with their parent and preserves its values", () => {
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

    expect(
      screen.getByRole("slider", { name: "Background music volume" })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Audio file…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Folder…" })).toBeDisabled();
    expect(screen.getByTestId("ui-sounds-value")).toHaveTextContent("80%");
    expect(screen.getByTestId("ambient-volume-value")).toHaveTextContent("35%");
  });
});

describe("Settings sound previews", () => {
  afterEach(cleanupSettingsTest);

  it("offers a preview action for every bundled UI sound", () => {
    renderSettings({ initialSection: "sound", uiSoundsEnabled: true });

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
});

describe("Settings update controls", () => {
  afterEach(cleanupSettingsTest);

  it("uses one three-state update preference control", async () => {
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
      expect(hasAutomaticUpdateSave(invoke.mock.calls)).toBeTruthy();
    });
  });
});

describe("Settings update descriptions", () => {
  afterEach(cleanupSettingsTest);

  it("uses a labeled version field and update channel descriptions", async () => {
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
      screen.getByText(/Beta — early preview releases/u)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Nightly — frequent development releases/u)
    ).toBeInTheDocument();
    expect(screen.queryByText(/tag contains/iu)).not.toBeInTheDocument();
  });
});

describe("Settings support actions", () => {
  afterEach(cleanupSettingsTest);

  it("opens the canonical logs folder from the Private Beta card", async () => {
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Open Logs Folder" }));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("open_logs_folder");
    });
  });
});

describe("Settings bug report", () => {
  afterEach(cleanupSettingsTest);

  it("shows report guidance", () => {
    renderSettings();

    expect(screen.getByText(/Windows version/u)).toBeInTheDocument();
    expect(screen.getByText(/reproduction steps/u)).toBeInTheDocument();
    expect(
      screen.getByText(/expected and actual behavior/u)
    ).toBeInTheDocument();
    expect(screen.getByText(/relevant redacted logs/u)).toBeInTheDocument();
    expect(
      screen.getByText(/Never share credentials, user data/u)
    ).toBeInTheDocument();
  });
});

describe("Settings bug report action", () => {
  afterEach(cleanupSettingsTest);

  it("opens the canonical bug report route", async () => {
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Report a Problem" }));
    expect(shellOpen).toHaveBeenCalledWith(
      "https://github.com/auron-labs/wingosy-launcher/issues/new?template=bug_report.md"
    );
    await expect(
      screen.findByRole("textbox", { name: "App version" })
    ).resolves.toHaveValue("0.0.111");
  });
});
