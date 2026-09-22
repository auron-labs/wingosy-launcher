import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  cleanupSettingsTest,
  invoke,
  renderSettings,
} from "./settings-test-fixtures";

describe("Settings emulator controls", () => {
  afterEach(cleanupSettingsTest);

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
});

describe("Settings native controllers", () => {
  afterEach(cleanupSettingsTest);

  it("captures a native SDL controller without browser identity", async () => {
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
});

describe("Settings external emulators", () => {
  afterEach(cleanupSettingsTest);

  it("does not offer managed profile repair for external installs", async () => {
    renderSettings({
      config: { emulators: {} },
      emulators: [
        {
          id: "retroarch",
          install_type: "external",
          installed_path: "C:\\RetroArch\\retroarch.exe",
          is_installed: true,
          name: "RetroArch",
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
});

describe("Settings core inventory", () => {
  afterEach(cleanupSettingsTest);

  it("renders managed core inventory validity states", async () => {
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
});

describe("Settings core refresh", () => {
  afterEach(cleanupSettingsTest);

  it("refreshes core status from disk after installation changes", async () => {
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
});

describe("Settings installed emulator actions", () => {
  afterEach(cleanupSettingsTest);

  it("labels installed emulator actions and exposes the full path", async () => {
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
});

describe("Settings emulator download metadata", () => {
  afterEach(cleanupSettingsTest);

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
        /some release details are resolved only when installation starts/u
      )
    ).toBeInTheDocument();
  });
});

describe("Settings platform defaults", () => {
  afterEach(cleanupSettingsTest);

  it("offers installed Switch emulators without RetroArch", async () => {
    renderSettings({
      emulators: [
        {
          id: "retroarch",
          install_type: "external",
          installed_path: "C:\\RetroArch\\retroarch.exe",
          is_installed: true,
          name: "RetroArch",
          supported_platforms: ["nes"],
        },
        {
          id: "eden",
          install_type: "external",
          installed_path: "C:\\Eden\\eden.exe",
          is_installed: true,
          name: "Eden",
          supported_platforms: ["switch"],
        },
      ],
      initialSection: "emulators",
      platforms: [[{ id: "switch", name: "Nintendo Switch" }, 1]],
    });

    const platformDefault = await screen.findByTestId(
      "platform-default-switch"
    );
    const selectTrigger = platformDefault.querySelector('[role="combobox"]');
    if (selectTrigger === null) {
      throw new Error("Switch platform default select trigger is missing");
    }
    fireEvent.mouseDown(selectTrigger);

    await expect(
      screen.findByRole("option", { name: "Eden" })
    ).resolves.toBeVisible();
    expect(
      screen.queryByRole("option", { name: "RetroArch" })
    ).not.toBeInTheDocument();
  });

  it("aligns platform defaults and displays Auto", async () => {
    renderSettings({
      emulators: [
        {
          id: "mgba",
          install_type: "external",
          installed_path: "C:\\mGBA\\mGBA.exe",
          is_installed: true,
          name: "mGBA",
          supported_platforms: ["nes"],
        },
      ],
      initialSection: "emulators",
      platforms: [[{ id: "nes", name: "Nintendo Entertainment System" }, 3]],
    });

    const select = await screen.findByTestId("platform-default-nes");
    expect(select).toHaveTextContent("Auto");
    expect(
      screen.getByText(/Platforms not listed here stay on Auto/u)
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Emulator", { exact: true })
    ).not.toBeInTheDocument();
  });
});
