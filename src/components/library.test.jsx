import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MuiTestProvider } from "../test/mui-harness";
import Library from "./library";

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

const renderLibrary = (overrides = {}) => {
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
};

describe("Library desktop controls", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows a result count, clear affordance, shortcut hint, and sort/filter controls", () => {
    renderLibrary({ games: [], searchQuery: "mar", total: 1 });

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
      games: [],
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
      within(alert).getByRole("button", { name: "Open Settings" })
    ).toBeInTheDocument();
    expect(
      within(alert).queryByRole("button", { name: "Retry" })
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(alert).getByRole("button", { name: "Open Settings" })
    );
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

describe("Library search shortcuts", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses unmodified slash only outside text-entry targets", () => {
    renderLibrary({ searchQuery: "mario" });
    const search = screen.getByPlaceholderText("Search games...");
    if (!(search instanceof HTMLInputElement)) {
      throw new Error("Expected the search field to be an input");
    }
    const targets = [
      document.createElement("input"),
      document.createElement("textarea"),
      document.createElement("select"),
      document.createElement("div"),
    ];
    const targetContainer = document.createElement("div");
    document.body.append(targetContainer);
    for (const target of targets) {
      target.tabIndex = 0;
      if (target instanceof HTMLDivElement) {
        target.setAttribute("contenteditable", "");
      }
      targetContainer.append(target);
    }
    const button = document.createElement("button");
    button.type = "button";
    targetContainer.append(button);

    button.focus();
    fireEvent.keyDown(button, { key: "/" });
    expect(document.activeElement).toBe(search);
    expect(search.selectionStart).toBe(0);
    expect(search.selectionEnd).toBe("mario".length);

    for (const target of targets) {
      target.focus();
      fireEvent.keyDown(target, { key: "/" });
      expect(document.activeElement).toBe(target);
    }
    for (const modifier of ["altKey", "ctrlKey", "metaKey", "shiftKey"]) {
      button.focus();
      fireEvent.keyDown(button, { key: "/", [modifier]: true });
      expect(document.activeElement).toBe(button);
    }
    targetContainer.remove();
  });

  it("clears search with Escape only while the search field is focused", () => {
    const onSearchChange = vi.fn();
    renderLibrary({ onSearchChange, searchQuery: "mario" });
    const search = screen.getByPlaceholderText("Search games...");
    const button = document.createElement("button");
    button.type = "button";
    document.body.append(button);

    button.focus();
    fireEvent.keyDown(button, { key: "Escape" });
    expect(onSearchChange).not.toHaveBeenCalled();

    search.focus();
    fireEvent.keyDown(search, { key: "Escape" });
    expect(onSearchChange).toHaveBeenCalledWith("");
    button.remove();
  });
});

describe("Library query controls", () => {
  afterEach(() => {
    cleanup();
  });

  it("offers the desktop sort modes and independent availability control", () => {
    const onAvailabilityChange = vi.fn();
    const onFilterChange = vi.fn();
    const onSortChange = vi.fn();
    const onSortDirectionChange = vi.fn();
    renderLibrary({
      availability: "all",
      filterBy: "all",
      onAvailabilityChange,
      onFilterChange,
      onSortChange,
      onSortDirectionChange,
      sortBy: "name",
      sortDescending: false,
    });

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Sort by" }));
    expect(
      screen.getAllByRole("option").map((option) => option.textContent)
    ).toStrictEqual([
      "Name",
      "Recently played",
      "Play time",
      "Most played",
      "Release year",
    ]);
    fireEvent.click(screen.getByRole("option", { name: "Most played" }));
    fireEvent.click(screen.getByRole("button", { name: "Sort descending" }));

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Availability" }));
    fireEvent.click(screen.getByRole("option", { name: "Downloaded" }));

    expect(onSortChange).toHaveBeenCalledWith("play_count");
    expect(onSortDirectionChange).toHaveBeenCalledWith(true);
    expect(onAvailabilityChange).toHaveBeenCalledWith("downloaded");
    expect(onFilterChange).not.toHaveBeenCalled();
  });

  it("offers one recovery action for search and availability empty results", () => {
    const onAvailabilityChange = vi.fn();
    const onFilterChange = vi.fn();
    const onSearchChange = vi.fn();
    renderLibrary({
      availability: "downloaded",
      filterBy: "favorites",
      games: [],
      onAvailabilityChange,
      onFilterChange,
      onSearchChange,
      searchQuery: "missing",
      total: 0,
    });

    expect(screen.getByText("No games match this filter")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Try another filter, clear your search, or show all games."
      )
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all games" }));

    expect(onSearchChange).toHaveBeenCalledWith("");
    expect(onAvailabilityChange).toHaveBeenCalledWith("all");
    expect(onFilterChange).toHaveBeenCalledWith("all");
  });
});
