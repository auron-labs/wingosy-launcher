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

import { RomDownloadsProvider } from "../rom-downloads-context";
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

/** @param {import("./use-bios-settings").BiosInvoke} invokeBios BIOS command boundary. @param {typeof import("@tauri-apps/api/event").listen} listen Downloads event boundary. */
const renderBiosPageWithDownloads = (invokeBios, listen) => (
  <MuiTestProvider>
    <RomDownloadsProvider listen={listen}>
      <BiosSettings invokeBios={invokeBios} libraryPlatforms={[]} />
    </RomDownloadsProvider>
  </MuiTestProvider>
);

/** @param {boolean} downloaded - Whether the firmware is already present. @param {number} [id] Firmware identifier. */
const getFirmware = (downloaded, id = 1) => ({
  file_name: id === 1 ? "gba-bios.bin" : `gba-bios-rev${id}.bin`,
  file_size_bytes: 1024,
  id,
  is_downloaded: downloaded,
  local_path: downloaded
    ? `C:\\Wingosy\\bios\\gba\\${id === 1 ? "gba-bios.bin" : `gba-bios-rev${id}.bin`}`
    : null,
  md5_hash: null,
  missing_from_fs: false,
  platform_name: "Game Boy Advance",
  platform_slug: "gba",
});

/** @param {Partial<{downloaded: number, message: string, percent: number, speed: string, total: number}>} [overrides] BIOS event fields. */
const biosPayload = (overrides = {}) => ({
  downloaded: 0,
  file_name: "gba-bios.bin",
  firmware_id: 1,
  message: null,
  percent: null,
  platform_name: "Game Boy Advance",
  platform_slug: "gba",
  speed: null,
  total: null,
  transfer_id: "bios:gba:1",
  ...overrides,
});

/** @param {Map<string, (event: import("@tauri-apps/api/event").Event<unknown>) => void>} listeners Event listeners. @param {string} event Event name. @param {object} payload Event payload. */
const emitBiosDownloadEvent = (listeners, event, payload) => {
  act(() => {
    listeners.get(event)?.({ event, id: 1, payload });
  });
};

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

/** @param {import("./bios-types").BiosDistributionResult[]|Error} distributionResponse Distribution command response. */
const createDistributionHarness = (distributionResponse) => {
  /** @type {import("vitest").Mock<BiosMockInvoke>} */
  const invokeBiosMock = vi.fn((command) => {
    switch (command) {
      case "get_bios_directory": {
        return "C:\\Wingosy\\bios";
      }
      case "list_bios_firmware": {
        return [getFirmware(true)];
      }
      case "distribute_bios_firmware": {
        if (distributionResponse instanceof Error) {
          throw distributionResponse;
        }
        return distributionResponse;
      }
      default: {
        return null;
      }
    }
  });
  /** @type {import("./use-bios-settings").BiosInvoke} */
  // @ts-expect-error -- The mock returns the command-specific BIOS values exercised by this fixture.
  const invokeBios = invokeBiosMock;
  return { invokeBios };
};

describe("useBiosSettings", () => {
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
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

describe("BIOS distribution reporting", () => {
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  });

  it("shows the completed distribution result", async () => {
    const { invokeBios } = createDistributionHarness([
      {
        emulator_id: "retroarch",
        files_copied: 2,
        target_path: "C:\\Wingosy\\emulators\\retroarch\\system",
      },
    ]);
    render(renderBiosPage(invokeBios));

    const distributeButton = await screen.findByRole("button", {
      name: "Distribute to emulators",
    });
    await waitFor(() => {
      expect(distributeButton).not.toBeDisabled();
    });
    fireEvent.click(distributeButton);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Distributed 2 file copies (retroarch: 2)."
    );
    expect(alert).toHaveClass("MuiAlert-colorSuccess");
    expect(invokeBios).toHaveBeenCalledWith("distribute_bios_firmware");
  });

  it("shows a rejected distribution invocation as an error", async () => {
    const { invokeBios } = createDistributionHarness(
      new Error("No supported emulator is installed")
    );
    render(renderBiosPage(invokeBios));

    const distributeButton = await screen.findByRole("button", {
      name: "Distribute to emulators",
    });
    await waitFor(() => {
      expect(distributeButton).not.toBeDisabled();
    });
    fireEvent.click(distributeButton);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No supported emulator is installed");
    expect(alert).toHaveClass("MuiAlert-colorError");
  });
});

describe("BIOS download rows", () => {
  it("shows shared BIOS progress and retries a failed firmware row", async () => {
    /** @type {Map<string, (event: import("@tauri-apps/api/event").Event<unknown>) => void>} */
    const eventListeners = new Map();
    /** @type {typeof import("@tauri-apps/api/event").listen} */
    const listen = async (event, handler) => {
      await Promise.resolve();
      eventListeners.set(event, handler);
      return () => {
        eventListeners.delete(event);
      };
    };
    /** @type {import("vitest").Mock<BiosMockInvoke>} */
    const invokeBiosMock = vi.fn(async (command) => {
      await Promise.resolve();
      if (command === "get_bios_directory") {
        return "C:\\Wingosy\\bios";
      }
      if (command === "list_bios_firmware") {
        return [getFirmware(false)];
      }
      if (command === "download_bios_firmware") {
        return "C:\\Wingosy\\bios\\gba\\gba-bios.bin";
      }
      return null;
    });
    /** @type {import("./use-bios-settings").BiosInvoke} */
    // @ts-expect-error -- The mock returns the command-specific BIOS values exercised by this fixture.
    const invokeBios = invokeBiosMock;
    window.__TAURI_INTERNALS__ = {};
    render(renderBiosPageWithDownloads(invokeBios, listen));

    await screen.findByRole("button", { name: "Show files" });
    await waitFor(() => {
      expect(eventListeners.has("bios-download-progress")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Show files" }));
    emitBiosDownloadEvent(
      eventListeners,
      "bios-download-queued",
      biosPayload({
        downloaded: 512,
        percent: 50,
        speed: "512 B/s",
        total: 1024,
      })
    );

    expect(
      screen.queryByText(/512 B \/ 1\.0 KB|512 B\/s/u)
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Queued" })).toBeDisabled();
    emitBiosDownloadEvent(
      eventListeners,
      "bios-download-progress",
      biosPayload({
        downloaded: 512,
        percent: 50,
        speed: "512 B/s",
        total: 1024,
      })
    );

    expect(
      screen.getByText(/50% · 512 B \/ 1\.0 KB · 512 B\/s/u)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Downloading…" })).toBeDisabled();

    emitBiosDownloadEvent(
      eventListeners,
      "bios-download-error",
      biosPayload({
        downloaded: 512,
        message: "Network unavailable",
        percent: 50,
        total: 1024,
      })
    );

    expect(
      screen.getByText(/Download failed · Network unavailable/u)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(invokeBiosMock).toHaveBeenCalledWith("download_bios_firmware", {
        firmwareId: 1,
      });
    });
  });
});

describe("BIOS platform download submission", () => {
  it("submits every missing platform firmware before waiting for any result", async () => {
    /** @type {PromiseWithResolvers<string>} */
    const firstDownload = Promise.withResolvers();
    /** @type {PromiseWithResolvers<string>} */
    const secondDownload = Promise.withResolvers();
    /** @type {import("vitest").Mock<BiosMockInvoke>} */
    const invokeBiosMock = vi.fn(async (command, args) => {
      if (command === "get_bios_directory") {
        return "C:\\Wingosy\\bios";
      }
      if (command === "list_bios_firmware") {
        return [getFirmware(false), getFirmware(false, 2)];
      }
      if (command === "download_bios_firmware") {
        return args?.firmwareId === 1
          ? await firstDownload.promise
          : await secondDownload.promise;
      }
      return null;
    });
    /** @type {import("./use-bios-settings").BiosInvoke} */
    // @ts-expect-error -- The mock returns the command-specific BIOS values exercised by this fixture.
    const invokeBios = invokeBiosMock;
    render(renderBiosPage(invokeBios));

    fireEvent.click(
      await screen.findByRole("button", { name: "Download missing (2)" })
    );

    await waitFor(() => {
      expect(invokeBiosMock).toHaveBeenCalledWith("download_bios_firmware", {
        firmwareId: 1,
      });
      expect(invokeBiosMock).toHaveBeenCalledWith("download_bios_firmware", {
        firmwareId: 2,
      });
    });

    await act(async () => {
      firstDownload.resolve("C:\\Wingosy\\bios\\gba\\gba-bios.bin");
      secondDownload.resolve("C:\\Wingosy\\bios\\gba\\gba-bios-rev2.bin");
      await Promise.resolve();
    });
  });
});
