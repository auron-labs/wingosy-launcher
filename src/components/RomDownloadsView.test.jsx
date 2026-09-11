import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MuiTestProvider } from "../test/muiHarness";
import RomDownloadsView from "./RomDownloadsView";

const { useRomDownloads } = vi.hoisted(() => ({ useRomDownloads: vi.fn() }));

vi.mock(import("../RomDownloadsContext"), () => ({
  formatDownloadLabel: () => "",
  useRomDownloads,
}));

afterEach(() => {
  cleanup();
  useRomDownloads.mockReset();
});

function renderDownloads(value, props = {}) {
  useRomDownloads.mockReturnValue(value);
  return render(
    <MuiTestProvider>
      <RomDownloadsView {...props} />
    </MuiTestProvider>
  );
}

describe(RomDownloadsView, () => {
  it("makes the empty-state instructions actionable", () => {
    const onOpenGameDetails = vi.fn();
    const onOpenCloudLibrary = vi.fn();
    renderDownloads(
      {
        activeDownloads: [],
        recentDownloads: [],
      },
      { onOpenCloudLibrary, onOpenGameDetails }
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
      clearRecentDownloads,
      recentDownloads: [],
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
      clearRecentDownloads,
      recentDownloads: [
        { kind: "complete", gameId: 7, gameName: "Cloud Game", at: 1 },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear history" }));
    expect(clearRecentDownloads).toHaveBeenCalledOnce();
  });
});
