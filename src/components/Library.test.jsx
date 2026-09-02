import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Library from "./Library";
import { MuiTestProvider } from "../test/muiHarness";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path) => path,
}));

vi.mock("../ThemeContext", () => ({
  useAppTheme: () => ({
    colors: {
      primary: "#5C6BC0",
      primaryLight: "#8E99F3",
      focusGlow: "rgba(92,107,192,0.4)",
    },
  }),
}));

vi.mock("../RomDownloadsContext", () => ({
  useRomDownloads: () => ({ getProgress: () => null, getLaunchProgress: () => null }),
}));

afterEach(() => cleanup());

const games = [
  {
    id: 1,
    name: "Zelda",
    platform_id: "switch",
    source: "Local",
    sync_state: "local_only",
    local_file_path: "/roms/zelda.nsp",
    is_favorite: false,
  },
  {
    id: 2,
    name: "Mario",
    platform_id: "switch",
    source: "RomM",
    sync_state: "remote_only",
    local_file_path: null,
    is_favorite: true,
  },
];

function renderLibrary(overrides = {}) {
  const props = {
    games,
    total: games.length,
    page: 1,
    pageSize: 60,
    onPageChange: vi.fn(),
    loading: false,
    searchQuery: "",
    onSearchChange: vi.fn(),
    onSelectGame: vi.fn(),
    onToggleFavorite: vi.fn(),
    onLaunchGame: vi.fn(),
    onNavigateLibrarySettings: vi.fn(),
    onNavigateRommSettings: vi.fn(),
    error: null,
    onDismissError: vi.fn(),
    ...overrides,
  };
  render(
    <MuiTestProvider>
      <Library {...props} />
    </MuiTestProvider>,
  );
  return props;
}

describe("Library desktop controls", () => {
  it("shows a result count, clear affordance, shortcut hint, and sort/filter controls", () => {
    renderLibrary({ searchQuery: "mar", games: [games[1]], total: 1 });

    expect(screen.getByTestId("library-result-count")).toHaveTextContent("1 result");
    expect(screen.getByRole("button", { name: "Clear search" })).toBeEnabled();
    expect(screen.getByText("Ctrl+F / ⌘F to search")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sort by" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filter" })).toBeInTheDocument();
  });

  it("clears the controlled search query", () => {
    const props = renderLibrary({ searchQuery: "mar" });

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(props.onSearchChange).toHaveBeenCalledWith("");
  });

  it("focuses search with the advertised keyboard shortcut", () => {
    renderLibrary();
    const input = screen.getByPlaceholderText("Search games...");

    fireEvent.keyDown(window, { key: "f", ctrlKey: true });

    expect(document.activeElement).toBe(input);
  });

  it("offers Settings for deterministic launch failures without a Retry action", () => {
    const onOpenSettings = vi.fn();
    const onRetryLaunch = vi.fn();
    renderLibrary({
      error: "This game cannot start because no compatible emulator is installed for PlayStation 2.",
      launchError: {
        guidance: "Open Settings → Emulators to install or select a compatible emulator.",
        retryable: false,
      },
      onOpenSettings,
      onRetryLaunch,
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Open Settings → Emulators");
    expect(screen.getByRole("button", { name: "Open Settings" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onRetryLaunch).not.toHaveBeenCalled();
  });

  it("filters the visible page by favorites", () => {
    renderLibrary();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Filter" }));
    fireEvent.click(screen.getByRole("option", { name: "Favorites" }));

    expect(screen.getByText("Mario")).toBeInTheDocument();
    expect(screen.queryByText("Zelda")).not.toBeInTheDocument();
    expect(screen.getByTestId("library-result-count")).toHaveTextContent("1 result");
  });
});
