import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MuiTestProvider } from "../test/muiHarness";
import Library from "./Library";

vi.mock(import("@tauri-apps/api/core"), () => ({
  convertFileSrc: (path) => path,
}));

vi.mock(import("../ThemeContext"), () => ({
  useAppTheme: () => ({
    colors: {
      focusGlow: "rgba(92,107,192,0.4)",
      primary: "#5C6BC0",
      primaryLight: "#8E99F3",
    },
  }),
}));

vi.mock(import("../RomDownloadsContext"), () => ({
  useRomDownloads: () => ({
    getLaunchProgress: () => null,
    getProgress: () => null,
  }),
}));

afterEach(() => {
  cleanup();
});

const games = [
  {
    id: 1,
    is_favorite: false,
    local_file_path: "/roms/zelda.nsp",
    name: "Zelda",
    platform_id: "switch",
    source: "Local",
    sync_state: "local_only",
  },
  {
    id: 2,
    is_favorite: true,
    local_file_path: null,
    name: "Mario",
    platform_id: "switch",
    source: "RomM",
    sync_state: "remote_only",
  },
];

function renderLibrary(overrides = {}) {
  const props = {
    error: null,
    games,
    loading: false,
    onDismissError: vi.fn(),
    onLaunchGame: vi.fn(),
    onNavigateLibrarySettings: vi.fn(),
    onNavigateRommSettings: vi.fn(),
    onPageChange: vi.fn(),
    onSearchChange: vi.fn(),
    onSelectGame: vi.fn(),
    onToggleFavorite: vi.fn(),
    page: 1,
    pageSize: 60,
    searchQuery: "",
    total: games.length,
    ...overrides,
  };
  render(
    <MuiTestProvider>
      <Library {...props} />
    </MuiTestProvider>
  );
  return props;
}

describe("Library desktop controls", () => {
  it("shows a result count, clear affordance, shortcut hint, and sort/filter controls", () => {
    renderLibrary({ games: [games[1]], searchQuery: "mar", total: 1 });

    expect(screen.getByTestId("library-result-count")).toHaveTextContent(
      "1 result"
    );
    expect(screen.getByRole("button", { name: "Clear search" })).toBeEnabled();
    expect(screen.getByText("Ctrl+F / ⌘F to search")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Sort by" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Filter" })
    ).toBeInTheDocument();
  });

  it("clears the controlled search query", () => {
    const props = renderLibrary({ searchQuery: "mar" });

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(props.onSearchChange).toHaveBeenCalledWith("");
  });

  it("focuses search with the advertised keyboard shortcut", () => {
    renderLibrary();
    const input = screen.getByPlaceholderText("Search games...");

    fireEvent.keyDown(window, { ctrlKey: true, key: "f" });

    expect(document.activeElement).toBe(input);
  });

  it("offers Settings for deterministic launch failures without a Retry action", () => {
    const onOpenSettings = vi.fn();
    const onRetryLaunch = vi.fn();
    renderLibrary({
      error:
        "This game cannot start because no compatible emulator is installed for PlayStation 2.",
      launchError: {
        guidance:
          "Open Settings → Emulators to install or select a compatible emulator.",
        retryable: false,
      },
      onOpenSettings,
      onRetryLaunch,
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Open Settings → Emulators");
    expect(
      screen.getByRole("button", { name: "Open Settings" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retry" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(onRetryLaunch).not.toHaveBeenCalled();
  });

  it("filters the visible page by favorites", () => {
    renderLibrary();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Filter" }));
    fireEvent.click(screen.getByRole("option", { name: "Favorites" }));

    expect(screen.getByText("Mario")).toBeInTheDocument();
    expect(screen.queryByText("Zelda")).not.toBeInTheDocument();
    expect(screen.getByTestId("library-result-count")).toHaveTextContent(
      "1 result"
    );
  });
});
