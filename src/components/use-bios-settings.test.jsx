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

import { MuiTestProvider } from "../test/mui-harness";
import BiosSettings from "./bios-settings";

const noop = () => {};

/** @typedef {(command: string, args?: Record<string, unknown>) => unknown} BiosMockInvoke */

/** @param {import("./use-bios-settings").BiosInvoke} invokeBios BIOS command boundary. */
const renderBiosPage = (invokeBios) => (
  <StrictMode>
    <MuiTestProvider>
      <BiosSettings invokeBios={invokeBios} libraryPlatforms={[]} />
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
  /** @type {PromiseWithResolvers<string>} */
  const downloadFinished = Promise.withResolvers();
  resolveDownload = () => {
    downloaded = true;
    downloadFinished.resolve("C:\\Wingosy\\bios\\gba\\gba-bios.bin");
  };
  /** @type {PromiseWithResolvers<ReturnType<typeof getFirmware>[]>} */
  const staleList = Promise.withResolvers();
  resolveStaleList = () => {
    staleList.resolve([getFirmware(false)]);
  };
  /** @type {PromiseWithResolvers<ReturnType<typeof getFirmware>[]>} */
  const refreshedList = Promise.withResolvers();
  resolveRefreshList = () => {
    refreshedList.resolve([getFirmware(downloaded)]);
  };
  /** @type {string[]} */
  const calls = [];

  /** @type {import("vitest").Mock<BiosMockInvoke>} */
  const invokeBiosMock = vi.fn();
  /** @param {string} command BIOS command. */
  const respondToBiosCommand = async (command) => {
    calls.push(command);
    switch (command) {
      case "get_bios_directory": {
        return "C:\\Wingosy\\bios";
      }
      case "list_bios_firmware": {
        listCalls += 1;
        if (deferReturnedLoads && listCalls === 2) {
          return await staleList.promise;
        }
        if (deferReturnedLoads && listCalls === 3) {
          return await refreshedList.promise;
        }
        return [getFirmware(downloaded)];
      }
      case "download_bios_firmware": {
        return await downloadFinished.promise;
      }
      default: {
        return null;
      }
    }
  };
  invokeBiosMock.mockImplementation(respondToBiosCommand);
  /** @type {import("./use-bios-settings").BiosInvoke} */
  // @ts-expect-error -- The mock returns the command-specific BIOS values exercised by this fixture.
  const invokeBios = invokeBiosMock;

  return {
    calls,
    invokeBios,
    resolveDownload,
    resolveRefreshList,
    resolveStaleList,
  };
};

/** @param {string[]} calls @param {string} command */
const countCommand = (calls, command) =>
  calls.filter((calledCommand) => calledCommand === command).length;

describe("useBiosSettings", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps an active download busy across a page remount and refreshes it on completion", async () => {
    const { calls, invokeBios, resolveDownload } = createDownloadHarness();
    const { rerender } = render(renderBiosPage(invokeBios));
    const downloadButton = await screen.findByRole("button", {
      name: "Download missing (1)",
    });
    fireEvent.click(downloadButton);

    rerender(
      <MuiTestProvider>
        <div />
      </MuiTestProvider>
    );
    rerender(renderBiosPage(invokeBios));
    const activeButton = await screen.findByRole("button", {
      name: "Downloading…",
    });
    expect(activeButton).toBeDisabled();
    fireEvent.click(activeButton);
    expect(countCommand(calls, "download_bios_firmware")).toBe(1);

    await act(async () => {
      resolveDownload();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(document.body).toHaveTextContent(
        /Downloaded 1 Game Boy Advance firmware file\.[\s\S]*Ready/u
      );
    });
    expect(countCommand(calls, "download_bios_firmware")).toBe(1);
    expect(countCommand(calls, "list_bios_firmware")).toBe(3);
  });

  it("does not let a pending remount load overwrite completion refresh data", async () => {
    const {
      calls,
      invokeBios,
      resolveDownload,
      resolveRefreshList,
      resolveStaleList,
    } = createDownloadHarness(true);
    const { rerender } = render(renderBiosPage(invokeBios));
    const downloadButton = await screen.findByRole("button", {
      name: "Download missing (1)",
    });
    fireEvent.click(downloadButton);
    rerender(
      <MuiTestProvider>
        <div />
      </MuiTestProvider>
    );
    rerender(renderBiosPage(invokeBios));

    await act(async () => {
      resolveDownload();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(countCommand(calls, "list_bios_firmware")).toBe(3);
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
