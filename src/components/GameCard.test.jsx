import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MuiTestProvider } from "../test/muiHarness";
import GameCard from "./GameCard";

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

afterEach(() => {
  cleanup();
});

const game = {
  id: 1,
  is_favorite: false,
  local_file_path: "/roms/mario.nsp",
  name: "Super Mario Odyssey",
  platform_id: "switch",
  source: "Local",
  sync_state: "local_only",
};

function renderCard(overrides = {}) {
  const props = {
    downloadProgress: null,
    game: { ...game, ...overrides },
    launchProgress: null,
    onClick: vi.fn(),
    onLaunch: vi.fn(),
    onToggleFavorite: vi.fn(),
  };
  render(
    <MuiTestProvider>
      <GameCard {...props} />
    </MuiTestProvider>
  );
  return props;
}

describe("GameCard desktop affordances", () => {
  it("shows the title, download state, and actions before hover", () => {
    renderCard();

    expect(screen.getByText("Super Mario Odyssey")).toBeInTheDocument();
    expect(screen.getByText("Downloaded")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Play Super Mario Odyssey" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Add Super Mario Odyssey to favorites",
      })
    ).toBeInTheDocument();
  });

  it("keeps cloud-only games legible and exposes the download action", () => {
    renderCard({
      local_file_path: null,
      romm_id: null,
      source: "RomM",
      sync_state: "remote_only",
    });

    expect(screen.getByText("Cloud only")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Download Super Mario Odyssey" })
    ).toBeInTheDocument();
  });

  it("dispatches action clicks without opening the card", () => {
    const props = renderCard();

    fireEvent.click(
      screen.getByRole("button", { name: "Play Super Mario Odyssey" })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Add Super Mario Odyssey to favorites",
      })
    );

    expect(props.onLaunch).toHaveBeenCalledOnce();
    expect(props.onToggleFavorite).toHaveBeenCalledOnce();
    expect(props.onClick).not.toHaveBeenCalled();
  });
});
