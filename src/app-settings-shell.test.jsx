import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AppDesktop from "./app/app-desktop";

/* eslint-disable anti-slop/no-module-mocking -- This AppDesktop test isolates panel children to verify shell ownership. */
vi.mock(import("./components/game-details"), () => ({
  default: () => <div />,
}));
vi.mock(import("./components/library"), () => ({ default: () => <div /> }));
vi.mock(import("./components/rom-downloads-view"), () => ({
  default: () => <div />,
}));
vi.mock(import("./components/romm-sync-monitor"), () => ({
  default: () => <div />,
}));
vi.mock(import("./components/settings"), () => ({ default: () => <div /> }));
vi.mock(import("./components/sidebar"), () => ({
  default: () => <nav aria-label="Library sidebar" />,
}));

const noOp = () => {};
const noOpAsync = async () => {
  await Promise.resolve();
};
const noOpNull = async () => {
  await Promise.resolve();
  return null;
};

/** @type {import("react").ComponentProps<typeof AppDesktop>} */
const desktopProps = {
  detailsProps: {
    onBack: noOpAsync,
    onGameUpdate: noOpAsync,
    onLaunch: noOpNull,
    onOpenIntegrations: noOp,
    onOpenSettings: noOp,
    onToggleFavorite: noOpAsync,
    platforms: [],
    rommToken: null,
    rommUrl: "",
    selectedGame: { id: 1, name: "Test Game", platform_id: "test" },
  },
  downloadsProps: { onOpenCloudLibrary: noOp, onOpenGameDetails: noOp },
  libraryFilterBy: "all",
  libraryProps: {
    error: null,
    gameTotal: 0,
    games: [],
    libraryAvailability: "all",
    libraryFilterBy: "all",
    libraryLaunchError: null,
    librarySortBy: "name",
    loading: false,
    onAvailabilityChange: noOp,
    onDismissError: noOp,
    onFilterChange: noOp,
    onLaunchGame: noOpNull,
    onNavigateLibrarySettings: noOp,
    onNavigateRommSettings: noOp,
    onOpenSettings: noOp,
    onPageChange: noOp,
    onRetryLaunch: noOpAsync,
    onSearchChange: noOp,
    onSelectGame: noOp,
    onSortChange: noOp,
    onSortDirectionChange: noOp,
    onToggleFavorite: noOpAsync,
    page: 1,
    scrollRef: createRef(),
    searchQuery: "",
    sortDescending: false,
  },
  onNavigate: noOp,
  onSelectPlatform: noOp,
  platforms: [],
  rommSyncProps: {
    monitor: {
      activeOperation: null,
      error: null,
      loadOverview: noOpAsync,
      loading: false,
      platformStatuses: {},
      platforms: [],
      syncAll: noOpAsync,
      syncAllStatus: { error: null, state: "idle", totalGames: null },
      syncPlatform: noOpAsync,
    },
  },
  rommUrl: "",
  selectedPlatform: null,
  settingsProps: {
    initialSection: "general",
    onLibraryChange: noOp,
    onRommConnect: noOp,
    onRommDisconnect: noOp,
    rommToken: null,
    rommUrl: "",
  },
  view: "library",
};

/** @param {"details"|"downloads"|"library"|"romm-sync"|"settings"} view Desktop route. */
const renderDesktop = (view) =>
  render(<AppDesktop {...desktopProps} view={view} />);
/** @type {Array<"details"|"downloads"|"library"|"romm-sync">} */
const preservedViews = ["library", "downloads", "details", "romm-sync"];

describe("Desktop Settings shell", () => {
  afterEach(cleanup);

  it("omits the library sidebar for Settings", () => {
    renderDesktop("settings");

    expect(
      screen.queryByRole("navigation", { name: "Library sidebar" })
    ).not.toBeInTheDocument();
  });

  it("retains the library sidebar for preserved routes", () => {
    for (const view of preservedViews) {
      renderDesktop(view);

      expect(
        screen.getByRole("navigation", { name: "Library sidebar" })
      ).toBeInTheDocument();
      cleanup();
    }
  });
});
