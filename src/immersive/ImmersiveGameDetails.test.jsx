import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import ImmersiveGameDetails from "./ImmersiveGameDetails";
import { useGamepadKeyboardMapper } from "./useGamepadKeyboardMapper";
import { RomDownloadsProvider } from "../RomDownloadsContext";
import { MuiTestProvider } from "../test/muiHarness";

const { invoke, listen } = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn() }));

// These mocks provide deterministic UI/command sequencing evidence, not proof of a real emulator launch.
vi.mock("@tauri-apps/api/core", () => ({
  invoke,
  convertFileSrc: (path) => path,
}));

vi.mock("@tauri-apps/api/event", () => ({ listen }));

vi.mock("../ThemeContext", () => ({
  useAppTheme: () => ({
    colors: {
      primary: "#5C6BC0",
      primaryLight: "#8E99F3",
    },
  }),
}));

vi.mock("../components/game/GameScreenshotsSection", () => ({
  default: () => null,
}));

vi.mock("../components/game/GameAchievementsSection", () => ({
  default: () => null,
}));

vi.mock("../components/game/CollectionPickerDialog", () => ({
  default: () => null,
}));

const eventListeners = new Map();

function dispatchControllerKey(key, { repeat = false } = {}) {
  const code = { Enter: "Enter", Escape: "Escape" }[key] || "";
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key,
      code,
      repeat,
      bubbles: true,
      cancelable: true,
    }));
  });
}

function ControllerProbe() {
  useGamepadKeyboardMapper();
  return null;
}

function ControllerDetailsRouteProbe() {
  const [detailsOpen, setDetailsOpen] = useState(false);
  useGamepadKeyboardMapper();

  if (!detailsOpen) {
    return (
      <div
        data-testid="immersive-library"
        onKeyDown={(event) => {
          if (event.key === "Enter") setDetailsOpen(true);
        }}
      />
    );
  }

  return (
    <ImmersiveGameDetails
      game={remoteOnlyGame}
      platformLabel="Game Boy Advance"
      onBack={vi.fn()}
      onLaunch={vi.fn().mockResolvedValue({ success: true })}
      onToggleFavorite={vi.fn()}
      onGameUpdate={vi.fn()}
      rommToken="saved-token"
      rommUrl="https://romm.example"
    />
  );
}

function makeStandardPad(buttonIndex = null) {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
  if (buttonIndex !== null) buttons[buttonIndex].pressed = true;
  return { index: 1, mapping: "standard", buttons, axes: [] };
}

function installControllerTestEnvironment() {
  const frames = new Map();
  let nextFrameId = 1;
  let pads = [];
  let now = 1000;
  const originalGetGamepadsDescriptor = Object.getOwnPropertyDescriptor(navigator, "getGamepads");
  const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => now);

  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: () => pads,
  });
  vi.stubGlobal("requestAnimationFrame", (callback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id) => frames.delete(id));

  return {
    setPads(nextPads) {
      pads = nextPads;
    },
    runFrame() {
      const next = frames.entries().next().value;
      if (!next) return;
      const [id, callback] = next;
      frames.delete(id);
      act(() => callback(0));
    },
    advanceRepeatDelay() {
      now += 240;
    },
    restore() {
      if (originalGetGamepadsDescriptor) {
        Object.defineProperty(navigator, "getGamepads", originalGetGamepadsDescriptor);
      } else {
        delete navigator.getGamepads;
      }
      vi.unstubAllGlobals();
      nowSpy.mockRestore();
    },
  };
}

afterEach(() => {
  cleanup();
  eventListeners.clear();
  invoke.mockReset();
  listen.mockReset();
  delete window.__TAURI_INTERNALS__;
});

const remoteOnlyGame = {
  id: 7,
  name: "Cloud Game",
  platform_id: "gba",
  source: "RomM",
  romm_id: 42,
  local_file_path: null,
  sync_state: "remote_only",
  screenshot_paths: [],
  summary: "A game in the cloud.",
  is_favorite: false,
};

function renderDetails(
  onLaunch = vi.fn().mockResolvedValue({ success: true }),
  game = remoteOnlyGame,
  { onBack = vi.fn(), onToggleFavorite = vi.fn(), onGameUpdate = vi.fn() } = {},
) {
  return render(
    <MuiTestProvider>
      <RomDownloadsProvider>
        <ImmersiveGameDetails
          game={game}
          platformLabel="Game Boy Advance"
          onBack={onBack}
          onLaunch={onLaunch}
          onToggleFavorite={onToggleFavorite}
          onGameUpdate={onGameUpdate}
          rommToken="saved-token"
          rommUrl="https://romm.example"
        />
      </RomDownloadsProvider>
    </MuiTestProvider>
  );
}

function tapPadButton(controller, pad, buttonIndex) {
  for (const button of pad.buttons) button.pressed = false;
  controller.runFrame();
  pad.buttons[buttonIndex].pressed = true;
  controller.runFrame();
  pad.buttons[buttonIndex].pressed = false;
  controller.runFrame();
}

describe("ImmersiveGameDetails launch controls", () => {
  it.each([
    ["a local-only game", { ...remoteOnlyGame, id: 8, name: "Local Game", source: "Local", romm_id: null, local_file_path: "/roms/local.gba", sync_state: "local_only" }],
    ["a cached RomM game", { ...remoteOnlyGame, id: 9, name: "Cached Game", local_file_path: "/roms/cached.gba", sync_state: "synced" }],
  ])("routes Play for %s through onLaunch", async (_label, game) => {
    const onLaunch = vi.fn().mockResolvedValue({ success: true });
    renderDetails(onLaunch, game);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => expect(onLaunch).toHaveBeenCalledWith(game.id));
  });

  it("offers Play and explicit Download for a remote-only RomM game", async () => {
    const onLaunch = vi.fn().mockResolvedValue({ success: true });
    renderDetails(onLaunch);

    const play = screen.getByRole("button", { name: "Play" });
    expect(play).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();

    fireEvent.click(play);
    expect(onLaunch).toHaveBeenCalledWith(remoteOnlyGame.id);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(play).not.toBeDisabled();
  });

  it("starts the same launch flow when controller A dispatches Enter to window", async () => {
    const onLaunch = vi.fn().mockResolvedValue({ success: true });
    renderDetails(onLaunch);

    dispatchControllerKey("Enter");

    expect(onLaunch).toHaveBeenCalledWith(remoteOnlyGame.id);
    await waitFor(() => expect(screen.getByRole("button", { name: "Play" })).not.toBeDisabled());
  });

  it("moves focus across details actions from a standard controller direction", () => {
    const controller = installControllerTestEnvironment();
    try {
      const pad = makeStandardPad(15);
      controller.setPads([pad]);
      render(<ControllerProbe />);
      renderDetails();
      const details = screen.getByTestId("immersive-game-details");
      const hiddenAncestor = document.createElement("div");
      hiddenAncestor.hidden = true;
      hiddenAncestor.setAttribute("aria-hidden", "true");
      hiddenAncestor.style.display = "none";
      const hiddenAction = document.createElement("button");
      hiddenAncestor.append(hiddenAction);
      details.append(hiddenAncestor);

      controller.runFrame();
      expect(screen.getByRole("button", { name: "Download" })).toHaveFocus();

      pad.buttons[15].pressed = false;
      controller.runFrame();
      controller.advanceRepeatDelay();
      pad.buttons[15].pressed = true;
      controller.runFrame();

      expect(screen.getByRole("button", { name: "Favorite" })).toHaveFocus();

      pad.buttons[15].pressed = false;
      controller.runFrame();
      controller.advanceRepeatDelay();
      pad.buttons[15].pressed = true;
      controller.runFrame();

      expect(hiddenAction).not.toHaveFocus();
      expect(screen.getByRole("button", { name: "Favorite" })).toHaveFocus();
    } finally {
      controller.restore();
    }
  });

  it("keeps the opening frame's direction when controller input opens details", () => {
    const controller = installControllerTestEnvironment();
    try {
      const pad = makeStandardPad(0);
      pad.buttons[15].pressed = true;
      controller.setPads([pad]);

      render(
        <MuiTestProvider>
          <RomDownloadsProvider>
            <ControllerDetailsRouteProbe />
          </RomDownloadsProvider>
        </MuiTestProvider>,
      );

      controller.runFrame();
      controller.runFrame();

      expect(screen.getByRole("button", { name: "Download" })).toHaveFocus();
    } finally {
      controller.restore();
    }
  });

  it("lets mapper Confirm activate a focused non-Play action", () => {
    const onLaunch = vi.fn().mockResolvedValue({ success: true });
    const onToggleFavorite = vi.fn();
    const controller = installControllerTestEnvironment();

    try {
      renderDetails(onLaunch, remoteOnlyGame, { onToggleFavorite });
      const pad = makeStandardPad(15);
      controller.setPads([pad]);
      render(<ControllerProbe />);
      controller.runFrame();
      expect(screen.getByRole("button", { name: "Download" })).toHaveFocus();

      pad.buttons[15].pressed = false;
      controller.runFrame();
      controller.advanceRepeatDelay();
      pad.buttons[15].pressed = true;
      controller.runFrame();
      expect(screen.getByRole("button", { name: "Favorite" })).toHaveFocus();

      pad.buttons[15].pressed = false;
      controller.runFrame();
      pad.buttons[0].pressed = true;
      controller.runFrame();

      expect(onToggleFavorite).toHaveBeenCalledWith(remoteOnlyGame.id);
      expect(onLaunch).not.toHaveBeenCalled();
    } finally {
      controller.restore();
    }
  });

  it("moves within the menu without moving details focus", () => {
    const controller = installControllerTestEnvironment();

    try {
      const pad = makeStandardPad();
      controller.setPads([pad]);
      render(<ControllerProbe />);
      renderDetails();
      controller.runFrame();

      const moreOptions = screen.getByRole("button", { name: "More options" });
      fireEvent.click(moreOptions);
      const menuFocus = document.activeElement;
      if (!(menuFocus instanceof HTMLElement)) throw new Error("Expected menu to own focus");
      expect(screen.getByRole("menu")).toContainElement(menuFocus);

      pad.buttons[13].pressed = true;
      controller.runFrame();

      expect(screen.getByRole("menuitem", { name: /Ratings & status/ })).toHaveFocus();
      expect(moreOptions).not.toHaveFocus();
    } finally {
      controller.restore();
    }
  });

  it("opens the menu once and activates the selected enabled item once", async () => {
    const controller = installControllerTestEnvironment();
    const onLaunch = vi.fn().mockResolvedValue({ success: true });

    try {
      renderDetails(onLaunch);
      const moreOptions = screen.getByRole("button", { name: "More options" });
      const openMenu = vi.spyOn(moreOptions, "click");
      moreOptions.focus();
      const pad = makeStandardPad(0);
      controller.setPads([pad]);
      render(<ControllerProbe />);

      controller.runFrame();
      expect(openMenu).toHaveBeenCalledTimes(1);
      expect(screen.getAllByRole("menu")).toHaveLength(1);
      expect(screen.getByRole("menuitem", { name: /Manage cached saves/ })).toHaveFocus();

      for (let index = 0; index < 7; index += 1) tapPadButton(controller, pad, 13);
      expect(screen.getByRole("menuitem", { name: /Add to collection/ })).toHaveFocus();

      tapPadButton(controller, pad, 0);
      await waitFor(() => expect(invoke).toHaveBeenCalledWith("get_collections"));
      expect(invoke.mock.calls.filter(([command]) => command === "get_collections")).toHaveLength(1);
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(onLaunch).not.toHaveBeenCalled();
    } finally {
      controller.restore();
    }
  });

  it("closes the menu with controller Back and restores details focus", async () => {
    const controller = installControllerTestEnvironment();
    const onBack = vi.fn();

    try {
      renderDetails(undefined, remoteOnlyGame, { onBack });
      const moreOptions = screen.getByRole("button", { name: "More options" });
      moreOptions.focus();
      const pad = makeStandardPad(0);
      controller.setPads([pad]);
      render(<ControllerProbe />);

      controller.runFrame();
      expect(screen.getByRole("menu")).toBeInTheDocument();

      tapPadButton(controller, pad, 1);
      await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
      expect(moreOptions).toHaveFocus();
      expect(onBack).not.toHaveBeenCalled();
    } finally {
      controller.restore();
    }
  });

  it("does not move details focus while a dialog owns controller input", async () => {
    const onLaunch = vi.fn().mockRejectedValue(new Error("network unavailable"));
    const controller = installControllerTestEnvironment();

    try {
      renderDetails(onLaunch);
      fireEvent.click(screen.getByRole("button", { name: "Play" }));
      await waitFor(() => expect(screen.getByText("network unavailable")).toBeInTheDocument());
      const retry = screen.getByRole("button", { name: "Retry" });
      await waitFor(() => expect(retry).toHaveFocus());

      const pad = makeStandardPad(15);
      controller.setPads([pad]);
      render(<ControllerProbe />);
      controller.runFrame();

      expect(retry).toHaveFocus();
    } finally {
      controller.restore();
    }
  });

  it("does not route native control key events through the controller handler", () => {
    const onLaunch = vi.fn().mockResolvedValue({ success: true });
    renderDetails(onLaunch);

    fireEvent.keyDown(screen.getByRole("button", { name: "Download" }), { key: "Enter" });

    expect(onLaunch).not.toHaveBeenCalled();
  });

  it("ignores repeated or buffered Enter input while preparation is active", async () => {
    let finish;
    const onLaunch = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    renderDetails(onLaunch);

    dispatchControllerKey("Enter");
    dispatchControllerKey("Enter");
    dispatchControllerKey("Enter", { repeat: true });

    expect(onLaunch).toHaveBeenCalledTimes(1);
    await act(async () => finish({ success: true }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Play" })).not.toBeDisabled());
  });

  it("shows determinate and indeterminate preparation progress while Play is awaiting exit", async () => {
    window.__TAURI_INTERNALS__ = {};
    listen.mockImplementation(async (event, handler) => {
      eventListeners.set(event, handler);
      return () => eventListeners.delete(event);
    });
    let finish;
    const onLaunch = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    renderDetails(onLaunch);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(eventListeners.has("game-launch-progress")).toBe(true));

    await act(async () => {
      eventListeners.get("game-launch-progress")({
        payload: {
          game_id: remoteOnlyGame.id,
          game_name: remoteOnlyGame.name,
          stage: "bios_preparation",
        },
      });
    });

    expect(screen.getByText("Preparing BIOS...")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");

    await act(async () => {
      eventListeners.get("game-launch-progress")({
        payload: {
          game_id: remoteOnlyGame.id,
          game_name: remoteOnlyGame.name,
          stage: "downloading",
          downloaded: 512 * 1024,
          total: 1024 * 1024,
          percent: 50,
        },
      });
    });

    expect(screen.getByRole("dialog")).toHaveTextContent("Cloud Game");
    expect(screen.getByText("Downloading ROM...")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText(/50%.*512\.0 KB.*1\.00 MB/)).toBeInTheDocument();

    await act(async () => {
      eventListeners.get("game-launch-progress")({
        payload: {
          game_id: remoteOnlyGame.id,
          game_name: remoteOnlyGame.name,
          stage: "running",
          downloaded: null,
          total: null,
          percent: null,
        },
      });
    });

    expect(screen.getByText("Emulator running")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");

    await act(async () => {
      eventListeners.get("game-launch-progress")({
        payload: {
          game_id: remoteOnlyGame.id,
          game_name: remoteOnlyGame.name,
          stage: "completion",
        },
      });
    });
    expect(screen.getByText("Launch complete")).toBeInTheDocument();

    await act(async () => finish({ success: true }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Play" })).toHaveFocus();
  });

  it("keeps failure recovery controller-safe with focused Retry and Back", async () => {
    const onBack = vi.fn();
    const onLaunch = vi.fn().mockRejectedValue(new Error("network unavailable"));
    render(
      <MuiTestProvider>
        <RomDownloadsProvider>
          <ImmersiveGameDetails
            game={remoteOnlyGame}
            platformLabel="Game Boy Advance"
            onBack={onBack}
            onLaunch={onLaunch}
            onToggleFavorite={vi.fn()}
            onGameUpdate={vi.fn()}
            rommToken="saved-token"
            rommUrl="https://romm.example"
          />
        </RomDownloadsProvider>
      </MuiTestProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(screen.getByText("network unavailable")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus());

    dispatchControllerKey("Enter", { repeat: true });
    expect(onLaunch).toHaveBeenCalledTimes(1);

    dispatchControllerKey("Enter");
    await waitFor(() => expect(onLaunch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText("network unavailable")).toBeInTheDocument());

    dispatchControllerKey("Escape", { repeat: true });
    expect(onBack).not.toHaveBeenCalled();
    dispatchControllerKey("Escape");
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
