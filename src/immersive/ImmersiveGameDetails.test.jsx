import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import ImmersiveGameDetails from "./ImmersiveGameDetails";
import ImmersiveLibrary from "./ImmersiveLibrary";
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
  default: ({ onOpenIntegrations }) => (
    <button type="button" onClick={onOpenIntegrations}>
      Open integrations
    </button>
  ),
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  useGamepadKeyboardMapper();

  if (!detailsOpen) {
    return (
      <ImmersiveLibrary
        loading={false}
        error={null}
        games={[remoteOnlyGame]}
        selectedIndex={selectedIndex}
        onSelectedIndexChange={setSelectedIndex}
        onSelectGame={() => setDetailsOpen(true)}
        onExitImmersive={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenDownloads={vi.fn()}
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
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
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

const switchRemoteGame = {
  ...remoteOnlyGame,
  id: 17,
  name: "Switch Cloud Game",
  platform_id: "switch",
};

const launchableGame = { ...remoteOnlyGame, local_file_path: "/roms/cloud.gba" };

function renderDetails(
  onLaunch = vi.fn().mockResolvedValue({ success: true }),
  game = remoteOnlyGame,
  {
    onBack = vi.fn(),
    onToggleFavorite = vi.fn(),
    onGameUpdate = vi.fn(),
    onOpenSettings = vi.fn(),
    onOpenIntegrations = vi.fn(),
    platformLabel = "Game Boy Advance",
  } = {},
) {
  return render(
    <MuiTestProvider>
      <RomDownloadsProvider>
        <ImmersiveGameDetails
          game={game}
          platformLabel={platformLabel}
          onBack={onBack}
          onLaunch={onLaunch}
          onToggleFavorite={onToggleFavorite}
          onGameUpdate={onGameUpdate}
          onOpenSettings={onOpenSettings}
          onOpenIntegrations={onOpenIntegrations}
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
  it("passes the Integrations navigation callback to the achievements section", () => {
    const onOpenIntegrations = vi.fn();
    renderDetails(vi.fn().mockResolvedValue({ success: true }), remoteOnlyGame, {
      onOpenIntegrations,
    });

    fireEvent.click(screen.getByRole("button", { name: "Open integrations" }));

    expect(onOpenIntegrations).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a local-only game", { ...remoteOnlyGame, id: 8, name: "Local Game", source: "Local", romm_id: null, local_file_path: "/roms/local.gba", sync_state: "local_only" }],
    ["a cached RomM game", { ...remoteOnlyGame, id: 9, name: "Cached Game", local_file_path: "/roms/cached.gba", sync_state: "synced" }],
  ])("routes Play for %s through onLaunch", async (_label, game) => {
    const onLaunch = vi.fn().mockResolvedValue({ success: true });
    renderDetails(onLaunch, game);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => expect(onLaunch).toHaveBeenCalledWith(game.id));
  });

  it("offers Download as the sole primary action for a remote-only RomM game", () => {
    const onLaunch = vi.fn().mockResolvedValue({ success: true });
    renderDetails(onLaunch);

    expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();
    const download = screen.getByRole("button", { name: "Download" });
    expect(download).toHaveClass("MuiButton-contained");
    expect(screen.getAllByRole("button").filter((button) => button.classList.contains("MuiButton-contained"))).toHaveLength(1);
    expect(onLaunch).not.toHaveBeenCalled();
  });

  it("shows and dispatches the explicit Switch content action without disturbing Play", async () => {
    invoke.mockImplementation((command) => {
      if (command === "sync_switch_content") {
        return Promise.resolve({
          success: true,
          message: "Synced Switch content: 1 downloaded, 1 reused.",
          downloaded: 1,
          reused: 1,
        });
      }
      return Promise.resolve({ display: {} });
    });
    const onLaunch = vi.fn().mockResolvedValue({ success: true });
    renderDetails(onLaunch, switchRemoteGame);

    expect(screen.getByRole("button", { name: "Sync Updates & DLC" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sync Updates & DLC" }));
    fireEvent.click(screen.getByRole("button", { name: "Syncing Updates & DLC…" }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("sync_switch_content", { gameId: switchRemoteGame.id });
    });
    expect(invoke.mock.calls.filter(([command]) => command === "sync_switch_content")).toHaveLength(1);
    expect(await screen.findByText("Synced Switch content: 1 downloaded, 1 reused.")).toBeInTheDocument();
  });

  it("shows Switch content progress and retry guidance in immersive details", async () => {
    window.__TAURI_INTERNALS__ = {};
    listen.mockImplementation(async (event, handler) => {
      eventListeners.set(event, handler);
      return () => eventListeners.delete(event);
    });
    let finish;
    invoke.mockImplementation((command) => {
      if (command === "sync_switch_content") {
        return new Promise((resolve) => {
          finish = resolve;
        });
      }
      return Promise.resolve({ display: {} });
    });
    renderDetails(undefined, switchRemoteGame);

    await waitFor(() => expect(eventListeners.has("switch-content-sync-progress")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Sync Updates & DLC" }));
    await act(async () => {
      eventListeners.get("switch-content-sync-progress")({
        payload: {
          game_id: switchRemoteGame.id,
          stage: "registering",
          file_index: 2,
          total_files: 2,
          downloaded: null,
          total: null,
          percent: null,
        },
      });
    });
    expect(screen.getByTestId("switch-content-sync-progress")).toHaveTextContent("Registering content with Eden… (2/2)");
    finish({ success: true, message: "Synced Switch content: 2 downloaded, 0 reused." });
    await waitFor(() => expect(screen.getByText(/2 downloaded, 0 reused/)).toBeInTheDocument());

    invoke.mockImplementation((command) => (
      command === "sync_switch_content"
        ? Promise.reject(new Error("Eden is running"))
        : Promise.resolve({ display: {} })
    ));
    fireEvent.click(screen.getByRole("button", { name: "Sync Updates & DLC" }));
    await waitFor(() => expect(screen.getByText(/Eden is running.*Choose “Sync Updates & DLC” to retry/)).toBeInTheDocument());
  });

  it("starts the same launch flow when controller A dispatches Enter to window", async () => {
    const onLaunch = vi.fn().mockResolvedValue({ success: true });
    const localGame = { ...remoteOnlyGame, local_file_path: "/roms/cloud.gba" };
    renderDetails(onLaunch, localGame);

    dispatchControllerKey("Enter");

    expect(onLaunch).toHaveBeenCalledWith(localGame.id);
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
      const download = screen.getByRole("button", { name: "Download" });
      expect(download).toHaveFocus();
      expect(download).toHaveAttribute("data-controller-focused", "true");

      pad.buttons[15].pressed = false;
      controller.runFrame();
      controller.advanceRepeatDelay();
      pad.buttons[15].pressed = true;
      controller.runFrame();

      const favorite = screen.getByRole("button", { name: "Favorite" });
      expect(favorite).toHaveFocus();
      expect(favorite).toHaveAttribute("data-controller-focused", "true");
      expect(download).not.toHaveAttribute("data-controller-focused");

      pad.buttons[15].pressed = false;
      controller.runFrame();
      controller.advanceRepeatDelay();
      pad.buttons[15].pressed = true;
      controller.runFrame();

      expect(hiddenAction).not.toHaveFocus();
      expect(favorite).toHaveFocus();
    } finally {
      controller.restore();
    }
  });

  it("correlates a controller action with the details receiver and focus result", () => {
    vi.stubEnv("VITE_WINGOSY_DEBUG", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const controller = installControllerTestEnvironment();

    try {
      renderDetails();
      const pad = makeStandardPad(15);
      controller.setPads([pad]);
      render(<ControllerProbe />);

      controller.runFrame();

      const recognized = info.mock.calls.find(
        ([message]) => message === "[Wingosy][debug][controller] recognized input/action",
      )?.[1];
      const handled = info.mock.calls.find(
        ([message, details]) =>
          message === "[Wingosy][debug][controller] receiver handled" &&
          details?.receiver === "details",
      )?.[1];

      expect(handled).toMatchObject({
        actionId: recognized.actionId,
        key: "ArrowRight",
        controllerIndex: 1,
        outcome: "handled",
        reason: "focus-moved",
        beforeFocus: expect.any(Object),
        afterFocus: expect.objectContaining({ tag: "button", role: "button" }),
      });
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

      for (let frame = 0; frame < 6; frame += 1) controller.runFrame();

      const download = screen.getByRole("button", { name: "Download" });
      expect(download).toHaveFocus();
      expect(download).toHaveAttribute("data-controller-focused", "true");
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
      const favorite = screen.getByRole("button", { name: "Favorite" });
      expect(favorite).toHaveFocus();
      expect(favorite).toHaveAttribute("data-controller-focused", "true");

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

      expect(screen.getByRole("menuitem", { name: /Add to collection/ })).toHaveFocus();
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

      tapPadButton(controller, pad, 13);
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
      renderDetails(onLaunch, launchableGame);
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

  it("logs a concise controller suppression reason for an open details dialog", async () => {
    vi.stubEnv("VITE_WINGOSY_DEBUG", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const onLaunch = vi.fn().mockRejectedValue(new Error("network unavailable"));
    const controller = installControllerTestEnvironment();

    try {
      renderDetails(onLaunch, launchableGame);
      fireEvent.click(screen.getByRole("button", { name: "Play" }));
      await waitFor(() => expect(screen.getByText("network unavailable")).toBeInTheDocument());

      const pad = makeStandardPad(15);
      controller.setPads([pad]);
      render(<ControllerProbe />);
      controller.runFrame();

      expect(info).toHaveBeenCalledWith(
        "[Wingosy][debug][controller] receiver suppressed",
        expect.objectContaining({
          receiver: "details",
          key: "ArrowRight",
          outcome: "suppressed",
          reason: "dialog open",
        }),
      );
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
    renderDetails(onLaunch, launchableGame);

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
    renderDetails(onLaunch, launchableGame);

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

    expect(screen.getByRole("dialog")).not.toHaveTextContent("Cloud Game");
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
            game={launchableGame}
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

  it("translates missing emulator guidance and sends the user to Settings without Retry", async () => {
    const onOpenSettings = vi.fn();
    const onLaunch = vi.fn().mockResolvedValue({
      success: false,
      error: "No compatible RetroArch core is installed for ps2",
    });
    renderDetails(onLaunch, launchableGame, { onOpenSettings, platformLabel: "PlayStation 2" });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => expect(screen.getByText(/no compatible emulator is installed/i)).toBeInTheDocument());
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("PlayStation 2");
    expect(dialog).toHaveTextContent("Settings → Emulators");
    expect(dialog).not.toHaveTextContent("Cloud Game");
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Launch failed" })).toBeInTheDocument();
    expect(screen.getByText("Esc to go back")).toBeInTheDocument();
    expect(document.querySelector(".MuiBackdrop-root")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("routes controller confirmation to Settings instead of retrying a deterministic failure", async () => {
    const onOpenSettings = vi.fn();
    const onLaunch = vi.fn().mockResolvedValue({
      success: false,
      error: "No compatible RetroArch core is installed for ps2",
    });
    renderDetails(onLaunch, launchableGame, { onOpenSettings, platformLabel: "PlayStation 2" });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(screen.getByText(/no compatible emulator is installed/i)).toBeInTheDocument());

    dispatchControllerKey("Enter");

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onLaunch).toHaveBeenCalledTimes(1);
  });

  it("names the More options menu directly in the cloud-saves guidance", () => {
    renderDetails(undefined, remoteOnlyGame);

    expect(screen.getByText(/this game's More options menu/)).toBeInTheDocument();
    expect(screen.queryByText(/the menu above/)).not.toBeInTheDocument();
  });
});
