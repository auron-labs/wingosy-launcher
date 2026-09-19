import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MuiTestProvider } from "../test/mui-harness";
import RomDownloadsView from "./rom-downloads-view";

/** @typedef {{activeDownloads: {gameId?: number|string, gameName?: string, percent?: number|null, kind?: "complete"|"error", path?: string, message?: string, at?: number, downloaded?: number|null, total?: number|null, stage?: string}[], clearRecentDownloads: () => void, retryBiosDownload: (firmwareId: number|string) => Promise<unknown>, recentDownloads: ({kind: "complete", transferId: string, transferKind: "rom", gameId: number|string, gameName: string, path: string, at: number}|{kind: "error", transferId: string, transferKind: "rom", gameId: number|string, gameName: string, message: string, at: number})[]}} DownloadsValue */
/** @typedef {{onOpenGameDetails?: (() => void)|null, onOpenCloudLibrary?: (() => void)|null}} DownloadViewProps */
/** @returns {Promise<null>} Inert BIOS retry callback. */
const retryBiosDownload = async () => {
  await Promise.resolve();
  return null;
};
/** @param {DownloadsValue} value Download data. @param {DownloadViewProps} [props] View properties. */
const renderDownloads = (value, props = {}) =>
  render(
    <MuiTestProvider>
      <RomDownloadsView {...props} downloads={value} />
    </MuiTestProvider>
  );

describe(RomDownloadsView, () => {
  afterEach(cleanup);

  it("makes the empty-state instructions actionable", () => {
    const onOpenGameDetails = vi.fn();
    const onOpenCloudLibrary = vi.fn();
    renderDownloads(
      {
        activeDownloads: [],
        clearRecentDownloads: () => {},
        recentDownloads: [],
        retryBiosDownload,
      },
      {
        onOpenCloudLibrary: () => {
          onOpenCloudLibrary();
        },
        onOpenGameDetails: () => {
          onOpenGameDetails();
        },
      }
    );

    const detailsLink = screen.getByRole("link", {
      name: "a game's details page",
    });
    const libraryLink = screen.getByRole("link", {
      name: "cloud library tile",
    });
    fireEvent.click(detailsLink);
    fireEvent.click(libraryLink);

    expect(onOpenGameDetails).toHaveBeenCalledOnce();
    expect(onOpenCloudLibrary).toHaveBeenCalledOnce();
  });

  it("renders links for the empty state and clears populated history", () => {
    const clearRecentDownloads = vi.fn();
    renderDownloads({
      activeDownloads: [],
      clearRecentDownloads: () => {
        clearRecentDownloads();
      },
      recentDownloads: [],
      retryBiosDownload,
    });

    expect(screen.getByTestId("downloads-empty-state")).toBeInTheDocument();
    const detailsLink = screen.getByRole("link", {
      name: "a game's details page",
    });
    const libraryLink = screen.getByRole("link", {
      name: "cloud library tile",
    });
    expect(detailsLink).toHaveAttribute("href", "#library");
    expect(libraryLink).toHaveAttribute("href", "#library");

    cleanup();
    renderDownloads({
      activeDownloads: [],
      clearRecentDownloads: () => {
        clearRecentDownloads();
      },
      recentDownloads: [
        {
          at: 1,
          gameId: 7,
          gameName: "Cloud Game",
          kind: "complete",
          path: "C:\\Games\\cloud.gba",
          transferId: "rom:7",
          transferKind: "rom",
        },
      ],
      retryBiosDownload,
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear history" }));
    expect(clearRecentDownloads).toHaveBeenCalledOnce();
  });
});
