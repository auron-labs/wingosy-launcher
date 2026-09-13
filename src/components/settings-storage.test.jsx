import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  cleanupSettingsTest,
  invoke,
  renderSettings,
  shellOpen,
} from "./settings-test-fixtures";

const renderConfiguredStorage = () => {
  renderSettings({
    config: { library: { roms_directory: "C:\\Games\\ROMs" } },
    initialSection: "library",
    storageOverview: {
      active_rom_downloads: 0,
      locations: [
        {
          bytes: 4096,
          exists: true,
          key: "roms",
          label: "ROMs",
          path: "C:\\Games\\ROMs",
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
};

describe("Settings BIOS and storage", () => {
  afterEach(cleanupSettingsTest);

  it("explains unavailable BIOS totals and offers per-platform downloads", async () => {
    renderSettings({
      biosFirmware: [
        {
          file_name: "gba-bios.bin",
          file_size_bytes: 1024,
          id: 1,
          is_downloaded: false,
          local_path: null,
          md5_hash: null,
          missing_from_fs: false,
          platform_name: "Game Boy Advance",
          platform_slug: "gba",
        },
        {
          file_name: "ps2-bios.bin",
          file_size_bytes: 2048,
          id: 2,
          is_downloaded: false,
          local_path: null,
          md5_hash: null,
          missing_from_fs: true,
          platform_name: "PlayStation 2",
          platform_slug: "ps2",
        },
      ],
      initialSection: "bios",
      platforms: [[{ id: "gba", name: "Game Boy Advance" }, 4]],
    });

    await expect(
      screen.findByTestId("bios-count-explanation")
    ).resolves.toHaveTextContent("1 listed file is unavailable");
    expect(
      screen.getAllByText(/Needed by your library|0 of 1 available downloaded/u)
    ).toHaveLength(2);
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
});

describe("Settings storage directory", () => {
  afterEach(cleanupSettingsTest);

  it("adds free-space status", async () => {
    renderConfiguredStorage();

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
  });
});

describe("Settings storage directory actions", () => {
  afterEach(cleanupSettingsTest);

  it("offers ordered directory actions and opens the ROMs folder", async () => {
    renderConfiguredStorage();
    const directoryBox = screen.getByText(
      "ROM Storage Directory"
    ).parentElement;
    if (!directoryBox) {
      throw new Error("ROM storage directory container was not rendered");
    }
    expect(
      within(directoryBox).getByRole("button", { name: "Change" })
    ).toBeInTheDocument();
    expect(
      within(directoryBox).getByRole("button", { name: "Reset to default" })
    ).toBeInTheDocument();
    await expect(
      screen.findByRole("button", { name: "Open ROMs folder" })
    ).resolves.toBeInTheDocument();
    expect(
      screen.getByText(/Changing folders never moves files silently/u)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open ROMs folder" }));
    await waitFor(() => {
      expect(shellOpen).toHaveBeenCalledWith("C:\\Games\\ROMs");
    });
  });
});

describe("Settings free disk space", () => {
  afterEach(cleanupSettingsTest);

  it("formats backend-reported free disk space", async () => {
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
