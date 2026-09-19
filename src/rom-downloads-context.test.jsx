import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import RomDownloadsView from "./components/rom-downloads-view";
import { RomDownloadsProvider } from "./rom-downloads-context";
import { MuiTestProvider } from "./test/mui-harness";

/** @typedef {{event: string, id: number, payload: unknown}} TauriEvent */
/** @typedef {(event: TauriEvent) => void} TauriEventHandler */

/** @param {import("vitest").Mock} [invokeBios] BIOS command boundary. @returns {Promise<{dispatch: (event: string, payload: object) => void, listen: typeof import("@tauri-apps/api/event").listen, rerender: import("@testing-library/react").RenderResult["rerender"]}>} Downloads event test harness. */
const renderDownloads = async (invokeBios) => {
  /** @type {Map<string, TauriEventHandler>} */
  const eventListeners = new Map();
  /** @type {typeof import("@tauri-apps/api/event").listen} */
  const listen = async (event, handler) => {
    eventListeners.set(event, handler);
    await Promise.resolve();
    return () => {
      eventListeners.delete(event);
    };
  };
  window.__TAURI_INTERNALS__ = {};
  const rendered = render(
    <MuiTestProvider>
      <RomDownloadsProvider listen={listen} invokeBios={invokeBios}>
        <RomDownloadsView />
      </RomDownloadsProvider>
    </MuiTestProvider>
  );

  await waitFor(() => {
    expect(eventListeners.has("rom-download-progress")).toBeTruthy();
  });
  return {
    dispatch: (event, payload) => {
      const handler = eventListeners.get(event);
      if (!handler) {
        throw new Error(`Missing test event listener: ${event}`);
      }
      handler({ event, id: 1, payload });
    },
    listen,
    rerender: rendered.rerender,
  };
};

/** @param {Partial<{transfer_id: string, firmware_id: number, platform_slug: string, platform_name: string, file_name: string, downloaded: number, total: number|null, percent: number|null, speed: string|null, path: string|null, message: string|null}>} overrides BIOS event fields. */
const biosPayload = (overrides = {}) => ({
  downloaded: 0,
  file_name: "gba-bios.bin",
  firmware_id: 1,
  message: null,
  path: null,
  percent: null,
  platform_name: "Game Boy Advance",
  platform_slug: "gba",
  speed: null,
  total: null,
  transfer_id: "bios:gba:1",
  ...overrides,
});

/** @param {(event: string, payload: object) => void} dispatch Event dispatcher. */
const startAndProgressDownloads = (dispatch) => {
  act(() => {
    dispatch("rom-download-started", { game_id: 1, game_name: "Alpha" });
    dispatch("rom-download-progress", {
      downloaded: 512 * 1024,
      game_id: 1,
      percent: 50,
      speed: "1.50 MB/s",
      total: 1024 * 1024,
    });
    dispatch("rom-download-started", { game_id: 2, game_name: "Beta" });
    dispatch("rom-download-progress", {
      downloaded: 256 * 1024,
      game_id: 2,
      percent: 25,
      speed: "768.00 KB/s",
      total: 1024 * 1024,
    });
  });
};

/** @param {(event: string, payload: object) => void} dispatch Event dispatcher. */
const startBiosAndCollidingRomTransfers = (dispatch) => {
  act(() => {
    dispatch("rom-download-progress", {
      downloaded: 128,
      game_id: "bios:gba:1",
      game_name: "A ROM with a BIOS-like ID",
      percent: 50,
      speed: "128 B/s",
      total: 256,
    });
    dispatch(
      "bios-download-progress",
      biosPayload({ downloaded: 512 * 1024, speed: "512.00 KB/s" })
    );
    dispatch(
      "bios-download-progress",
      biosPayload({
        downloaded: 512 * 1024,
        file_name: "gba-bios-rev2.bin",
        firmware_id: 2,
        percent: 50,
        speed: "1.00 MB/s",
        total: 1024 * 1024,
        transfer_id: "bios:gba:2",
      })
    );
  });
};

/** Verifies determinate and indeterminate bars are both present. */
const expectBiosProgressModes = () => {
  const progressBars = screen.getAllByRole("progressbar");
  expect(
    progressBars.filter((progressBar) =>
      progressBar.hasAttribute("aria-valuenow")
    )
  ).toHaveLength(2);
  expect(
    progressBars.some(
      (progressBar) => !progressBar.hasAttribute("aria-valuenow")
    )
  ).toBeTruthy();
};

/** Verifies known and unknown BIOS totals render their supplied progress modes. */
const expectActiveBiosTransfers = () => {
  expect(screen.getByText("A ROM with a BIOS-like ID")).toBeInTheDocument();
  expect(screen.getAllByText("Game Boy Advance")).toHaveLength(2);
  expect(screen.getByText(/gba-bios\.bin · 512\.0 KB/u)).toBeInTheDocument();
  expect(screen.getByText(/512\.00 KB\/s/u)).toBeInTheDocument();
  expectBiosProgressModes();
};

/** @param {import("@testing-library/react").RenderResult["rerender"]} rerender Render boundary. @param {typeof import("@tauri-apps/api/event").listen} listen Event boundary. @param {import("vitest").Mock} invokeBios BIOS command boundary. */
const navigateBackToDownloads = (rerender, listen, invokeBios) => {
  rerender(
    <MuiTestProvider>
      <RomDownloadsProvider listen={listen} invokeBios={invokeBios}>
        <div>Other page</div>
      </RomDownloadsProvider>
    </MuiTestProvider>
  );
  rerender(
    <MuiTestProvider>
      <RomDownloadsProvider listen={listen} invokeBios={invokeBios}>
        <RomDownloadsView />
      </RomDownloadsProvider>
    </MuiTestProvider>
  );
};

describe(RomDownloadsProvider, () => {
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  });

  it("shows an independent readable speed for each active ROM", async () => {
    const { dispatch } = await renderDownloads();

    startAndProgressDownloads(dispatch);

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText(/1\.50 MB\/s/u)).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText(/768\.00 KB\/s/u)).toBeInTheDocument();
  });

  it("clears a restarted or terminal ROM speed without retaining it in history", async () => {
    const { dispatch } = await renderDownloads();

    startAndProgressDownloads(dispatch);
    act(() => {
      dispatch("rom-download-started", { game_id: 1, game_name: "Alpha" });
    });

    expect(screen.queryByText(/1\.50 MB\/s/u)).not.toBeInTheDocument();
    expect(screen.getByText(/768\.00 KB\/s/u)).toBeInTheDocument();

    act(() => {
      dispatch("rom-download-progress", {
        downloaded: 768 * 1024,
        game_id: 1,
        percent: 75,
        speed: "1.25 MB/s",
        total: 1024 * 1024,
      });
      dispatch("rom-download-complete", {
        game_id: 1,
        game_name: "Alpha",
        path: "/roms/alpha.gba",
      });
      dispatch("rom-download-error", {
        game_id: 2,
        game_name: "Beta",
        message: "Network unavailable",
      });
    });

    expect(
      screen.queryByText(/1\.25 MB\/s|768\.00 KB\/s/u)
    ).not.toBeInTheDocument();
    expect(screen.getByText("Saved · /roms/alpha.gba")).toBeInTheDocument();
    expect(screen.getByText("Network unavailable")).toBeInTheDocument();
  });
});

describe("queued BIOS downloads", () => {
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  });

  it("keeps queued BIOS state across navigation and transitions the same row to active", async () => {
    const invokeBios = vi.fn(async () => {
      await Promise.resolve();
      return "/bios/gba-bios.bin";
    });
    const { dispatch, listen, rerender } = await renderDownloads(invokeBios);

    act(() => {
      dispatch(
        "bios-download-queued",
        biosPayload({
          downloaded: 512 * 1024,
          percent: 50,
          speed: "512.00 KB/s",
          total: 1024 * 1024,
        })
      );
    });

    expect(screen.getByText(/gba-bios\.bin · Queued/u)).toBeInTheDocument();
    expect(
      screen.queryByText(/512\.0 KB|512\.00 KB\/s/u)
    ).not.toBeInTheDocument();
    navigateBackToDownloads(rerender, listen, invokeBios);
    expect(screen.getByText(/gba-bios\.bin · Queued/u)).toBeInTheDocument();

    act(() => {
      dispatch("bios-download-started", biosPayload());
      dispatch(
        "bios-download-progress",
        biosPayload({
          downloaded: 512 * 1024,
          percent: 50,
          speed: "512.00 KB/s",
          total: 1024 * 1024,
        })
      );
    });

    expect(screen.getAllByText("Game Boy Advance")).toHaveLength(1);
    expect(
      screen.getByText(/gba-bios\.bin · 50% · 512\.0 KB/u)
    ).toBeInTheDocument();
  });
});

describe("BIOS downloads", () => {
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  });

  it("distinguishes BIOS IDs and replaces retry history", async () => {
    const invokeBios = vi.fn(async () => {
      await Promise.resolve();
      return "/bios/gba-bios.bin";
    });
    const { dispatch } = await renderDownloads(invokeBios);

    startBiosAndCollidingRomTransfers(dispatch);
    expectActiveBiosTransfers();

    act(() => {
      dispatch(
        "bios-download-error",
        biosPayload({ downloaded: 512 * 1024, message: "Network unavailable" })
      );
    });

    expect(screen.queryByText(/512\.00 KB\/s/u)).not.toBeInTheDocument();
    expect(
      screen.getByText(/gba-bios\.bin · Network unavailable/u)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(invokeBios).toHaveBeenCalledWith("download_bios_firmware", {
      firmwareId: 1,
    });

    act(() => {
      dispatch("bios-download-queued", biosPayload());
    });
    expect(screen.queryByText(/Network unavailable/u)).not.toBeInTheDocument();

    act(() => {
      dispatch(
        "bios-download-error",
        biosPayload({ message: "Network unavailable" })
      );
      dispatch(
        "bios-download-error",
        biosPayload({ message: "Network unavailable" })
      );
    });

    expect(screen.getAllByText(/Network unavailable/u)).toHaveLength(1);
  });
});
