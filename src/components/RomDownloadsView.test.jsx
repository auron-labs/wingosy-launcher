import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import RomDownloadsView from "./RomDownloadsView";
import { MuiTestProvider } from "../test/muiHarness";

const { useRomDownloads } = vi.hoisted(() => ({ useRomDownloads: vi.fn() }));

vi.mock("../RomDownloadsContext", () => ({
  useRomDownloads,
  formatDownloadLabel: () => "",
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

describe("RomDownloadsView", () => {
  it("makes the empty-state instructions actionable", () => {
    const onOpenGameDetails = vi.fn();
    const onOpenCloudLibrary = vi.fn();
    renderDownloads({
      activeDownloads: [],
      recentDownloads: [],
    }, { onOpenGameDetails, onOpenCloudLibrary });

    const detailsLink = screen.getByRole("link", { name: "a game's details page" });
    const libraryLink = screen.getByRole("link", { name: "cloud library tile" });
    fireEvent.click(detailsLink);
    fireEvent.click(libraryLink);

    expect(onOpenGameDetails).toHaveBeenCalledTimes(1);
    expect(onOpenCloudLibrary).toHaveBeenCalledTimes(1);
  });

  it("renders links for the empty state and clears populated history", () => {
    const clearRecentDownloads = vi.fn();
    renderDownloads({
      activeDownloads: [],
      recentDownloads: [],
      clearRecentDownloads,
    });

    expect(screen.getByTestId("downloads-empty-state")).toBeInTheDocument();
    const detailsLink = screen.getByRole("link", { name: "a game's details page" });
    const libraryLink = screen.getByRole("link", { name: "cloud library tile" });
    expect(detailsLink).toHaveAttribute("href", "#library");
    expect(libraryLink).toHaveAttribute("href", "#library");

    cleanup();
    renderDownloads({
      activeDownloads: [],
      recentDownloads: [{ kind: "complete", gameId: 7, gameName: "Cloud Game", at: 1 }],
      clearRecentDownloads,
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear history" }));
    expect(clearRecentDownloads).toHaveBeenCalledTimes(1);
  });
});
