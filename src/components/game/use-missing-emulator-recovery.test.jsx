import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  getSoleDownloadableEmulator,
  useMissingEmulatorRecovery,
} from "./use-missing-emulator-recovery";

/** @type {import("./game-details-types").GameDetailsLaunchErrorPresentation} */
const missingEmulatorPresentation = {
  guidance: "Install an emulator.",
  kind: "missing-emulator",
  message: "No emulator is installed.",
  retryable: false,
};

/** @type {import("./game-details-types").GameDetailsLaunchErrorPresentation} */
const otherPresentation = {
  guidance: "Try again.",
  kind: "other",
  message: "The emulator exited.",
  retryable: true,
};

const eden = {
  has_download: true,
  id: "eden",
  install_type: null,
  installed_path: null,
  is_installed: false,
  name: "Eden",
  supported_platforms: ["switch"],
  version: null,
};

describe("missing emulator candidate selection", () => {
  it("offers only one uninstalled downloadable emulator", () => {
    expect(getSoleDownloadableEmulator([])).toBeNull();
    expect(
      getSoleDownloadableEmulator([eden, { ...eden, id: "ryujinx" }])
    ).toBeNull();
    expect(
      getSoleDownloadableEmulator([
        eden,
        { ...eden, id: "ryujinx", is_installed: true },
      ])
    ).toBeNull();
  });
});

describe("missing emulator recovery cancellation", () => {
  it("queries classified failures and cancel does not install", async () => {
    const ipc = {
      downloadEmulator: vi.fn().mockResolvedValue("C:\\Emulators\\eden.exe"),
      getEmulatorsForPlatform: vi.fn().mockResolvedValue([eden]),
    };
    const { result, rerender } = renderHook(
      ({ launchError, launchErrorPresentation, platformId }) =>
        useMissingEmulatorRecovery({
          ipc,
          launchError,
          launchErrorPresentation,
          platformId,
        }),
      {
        initialProps: {
          launchError: "No emulator configured for platform: switch",
          launchErrorPresentation: missingEmulatorPresentation,
          platformId: "switch",
        },
      }
    );

    await waitFor(() => {
      expect(result.current.offer).toBe(eden);
    });
    expect(ipc.getEmulatorsForPlatform).toHaveBeenCalledWith("switch");
    act(() => {
      result.current.cancel();
    });
    expect({
      downloads: ipc.downloadEmulator.mock.calls,
      status: result.current.status,
    }).toStrictEqual({ downloads: [], status: "cancelled" });

    rerender({
      launchError: "The emulator exited.",
      launchErrorPresentation: otherPresentation,
      platformId: "switch",
    });
    await waitFor(() => {
      expect({
        requests: ipc.getEmulatorsForPlatform.mock.calls,
        status: result.current.status,
      }).toStrictEqual({ requests: [["switch"]], status: "idle" });
    });

    rerender({
      launchError: "No emulator configured for platform: ps2",
      launchErrorPresentation: missingEmulatorPresentation,
      platformId: "ps2",
    });
    await waitFor(() => {
      expect({
        offer: result.current.offer,
        requests: ipc.getEmulatorsForPlatform.mock.calls,
      }).toStrictEqual({ offer: eden, requests: [["switch"], ["ps2"]] });
    });
  });
});

describe("missing emulator recovery installation", () => {
  it("installs the offered emulator only after confirmation", async () => {
    const ipc = {
      downloadEmulator: vi.fn().mockResolvedValue("C:\\Emulators\\eden.exe"),
      getEmulatorsForPlatform: vi.fn().mockResolvedValue([eden]),
    };
    const { result } = renderHook(() =>
      useMissingEmulatorRecovery({
        ipc,
        launchError: "No emulator configured for platform: switch",
        launchErrorPresentation: missingEmulatorPresentation,
        platformId: "switch",
      })
    );

    await waitFor(() => {
      expect(result.current.offer).toBe(eden);
    });
    await act(async () => {
      await result.current.confirm();
    });
    expect({
      calls: ipc.downloadEmulator.mock.calls,
      installed: result.current.installed,
    }).toStrictEqual({ calls: [["eden"]], installed: true });
  });

  it("returns installation errors for recovery feedback", async () => {
    const ipc = {
      downloadEmulator: vi.fn().mockRejectedValue(new Error("Download failed")),
      getEmulatorsForPlatform: vi.fn().mockResolvedValue([eden]),
    };
    const { result } = renderHook(() =>
      useMissingEmulatorRecovery({
        ipc,
        launchError: "No emulator configured for platform: switch",
        launchErrorPresentation: missingEmulatorPresentation,
        platformId: "switch",
      })
    );

    await waitFor(() => {
      expect(result.current.offer).toBe(eden);
    });
    await act(async () => {
      await result.current.confirm();
    });
    expect({
      error: result.current.error,
      status: result.current.status,
    }).toStrictEqual({
      error: "Download failed",
      status: "error",
    });
  });
});
