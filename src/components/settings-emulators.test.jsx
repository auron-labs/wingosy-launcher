import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MuiTestProvider } from "../test/muiHarness";
import EmulatorsSettings from "./settings-emulators";

const noop = vi.fn();

const settings = {
  availableEmus: [
    {
      has_download: true,
      id: "pcsx2",
      is_installed: false,
      name: "PCSX2",
      supported_platforms: ["ps2"],
    },
  ],
  config: {},
  downloadingCore: null,
  emuInstallProgress: {},
  emuMenuAnchor: null,
  emuMessage: null,
  expandedEmu: null,
  getInstallTypeLabel: () => "Unverified",
  handleApplyPaths: noop,
  handleCaptureNativeController: noop,
  handleCopyEmulatorPath: noop,
  handleDownloadCore: noop,
  handleDownloadEmulator: noop,
  handleEmuMenuClose: noop,
  handleEmuMenuOpen: noop,
  handleLaunchEmulator: noop,
  handleOpenLocation: noop,
  handleOpenRetroarchInputSetup: noop,
  handleRepairRetroarchProfile: noop,
  handleResetRetroarchControllerAdditions: noop,
  handleSetDefaultEmulator: noop,
  handleUninstallEmulator: noop,
  installedEmus: [],
  loadEmulators: noop,
  loadMissingCores: noop,
  loadNativeControllers: noop,
  missingCores: [],
  nativeControllerLoading: false,
  nativeControllerMessage: null,
  nativeControllers: [],
  platformDefaults: {},
  platforms: [],
  retroarchCoreInventory: [],
  selectedEmu: null,
  setEmuMessage: noop,
  setExpandedEmu: noop,
  unavailableEmus: [],
};

describe("emulator settings markup", () => {
  it("keeps download metadata out of paragraph markup", () => {
    render(
      <MuiTestProvider>
        <EmulatorsSettings {...settings} />
      </MuiTestProvider>
    );

    expect(
      screen.getByText(
        /some release details are resolved only when installation starts/u
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Version: Not reported/u)).toHaveProperty(
      "tagName",
      "DIV"
    );
    expect(document.querySelector("p div")).toBeNull();
  });
});
