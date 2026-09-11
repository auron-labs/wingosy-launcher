import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MuiTestProvider } from "../test/muiHarness";
import BiosSettings from "./BiosSettings";

const { invoke, open } = vi.hoisted(() => ({
  invoke: vi.fn(),
  open: vi.fn(),
}));

const noop = () => {};

// Tauri commands are the hook's integration seam; keep the test at that boundary.
// eslint-disable-next-line anti-slop/no-module-mocking
vi.mock(import("@tauri-apps/api/core"), () => ({ invoke }));
// eslint-disable-next-line anti-slop/no-module-mocking
vi.mock(import("@tauri-apps/plugin-dialog"), () => ({ open }));

const renderBiosPage = () => (
  <StrictMode>
    <MuiTestProvider>
      <BiosSettings libraryPlatforms={[]} />
    </MuiTestProvider>
  </StrictMode>
);

/** @param {boolean} downloaded - Whether the firmware is already present. */
const getFirmware = (downloaded) => ({
  file_name: "gba-bios.bin",
  file_size_bytes: 1024,
  id: 1,
  is_downloaded: downloaded,
  local_path: downloaded ? "C:\\Wingosy\\bios\\gba\\gba-bios.bin" : null,
  md5_hash: null,
  missing_from_fs: false,
  platform_name: "Game Boy Advance",
  platform_slug: "gba",
});

/** @param {boolean} deferReturnedLoads - Hold the remounted page's loads. */
const createDownloadHarness = (deferReturnedLoads = false) => {
  let downloaded = false;
  /** @type {() => void} */
  let resolveDownload = noop;
  let listCalls = 0;
  /** @type {() => void} */
  let resolveStaleList = noop;
  /** @type {() => void} */
  let resolveRefreshList = noop;
  // A deferred promise models an active Tauri command without adding a dependency.
  /** @type {Promise<string>} */
  // oxlint-disable-next-line promise/avoid-new
  const downloadFinished = new Promise((resolve) => {
    resolveDownload = () => {
      downloaded = true;
      resolve("C:\\Wingosy\\bios\\gba\\gba-bios.bin");
    };
  });
  /** @type {Promise<ReturnType<typeof getFirmware>[]>} */
  // oxlint-disable-next-line promise/avoid-new
  const staleList = new Promise((resolve) => {
    resolveStaleList = () => {
      resolve([getFirmware(false)]);
    };
  });
  /** @type {Promise<ReturnType<typeof getFirmware>[]>} */
  // oxlint-disable-next-line promise/avoid-new
  const refreshedList = new Promise((resolve) => {
    resolveRefreshList = () => {
      resolve([getFirmware(downloaded)]);
    };
  });

  const invokeBios = async (command) => {
    switch (command) {
      case "get_bios_directory": {
        return "C:\\Wingosy\\bios";
      }
      case "list_bios_firmware": {
        listCalls += 1;
        if (deferReturnedLoads && listCalls === 2) {
          return await staleList;
        }
        if (deferReturnedLoads && listCalls === 3) {
          return await refreshedList;
        }
        return [getFirmware(downloaded)];
      }
      case "download_bios_firmware": {
        return await downloadFinished;
      }
      default: {
        return null;
      }
    }
  };

  return {
    invokeBios,
    resolveDownload,
    resolveRefreshList,
    resolveStaleList,
  };
};

const countCommand = (command) =>
  invoke.mock.calls.filter(([calledCommand]) => calledCommand === command)
    .length;

describe("useBiosSettings", () => {
  afterEach(() => {
    cleanup();
    invoke.mockReset();
    open.mockReset();
  });

  it("keeps an active download busy across a page remount and refreshes it on completion", async () => {
    const { invokeBios, resolveDownload } = createDownloadHarness();
    invoke.mockImplementation(invokeBios);

    const { rerender } = render(renderBiosPage());
    const downloadButton = await screen.findByRole("button", {
      name: "Download missing (1)",
    });
    fireEvent.click(downloadButton);

    rerender(
      <MuiTestProvider>
        <div />
      </MuiTestProvider>
    );
    rerender(renderBiosPage());
    const activeButton = await screen.findByRole("button", {
      name: "Downloading…",
    });
    expect(activeButton).toBeDisabled();
    fireEvent.click(activeButton);
    expect(countCommand("download_bios_firmware")).toBe(1);

    await act(async () => {
      resolveDownload();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(document.body).toHaveTextContent(
        /Downloaded 1 Game Boy Advance firmware file\.[\s\S]*Ready/u
      );
    });
    expect(countCommand("download_bios_firmware")).toBe(1);
    expect(countCommand("list_bios_firmware")).toBe(3);
  });

  it("does not let a pending remount load overwrite completion refresh data", async () => {
    const {
      invokeBios,
      resolveDownload,
      resolveRefreshList,
      resolveStaleList,
    } = createDownloadHarness(true);
    invoke.mockImplementation(invokeBios);

    const { rerender } = render(renderBiosPage());
    const downloadButton = await screen.findByRole("button", {
      name: "Download missing (1)",
    });
    fireEvent.click(downloadButton);
    rerender(
      <MuiTestProvider>
        <div />
      </MuiTestProvider>
    );
    rerender(renderBiosPage());

    await act(async () => {
      resolveDownload();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(countCommand("list_bios_firmware")).toBe(3);
    });
    await act(async () => {
      resolveRefreshList();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(document.body).toHaveTextContent(/Ready/u);
    });
    await act(async () => {
      resolveStaleList();
      await Promise.resolve();
    });
    expect(document.body).toHaveTextContent(/Ready/u);
  });
});
