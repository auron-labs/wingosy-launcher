import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RomDownloadsProvider } from "../rom-downloads-context";
import { MuiTestProvider } from "../test/mui-harness";
import { ThemeContext } from "../theme-context";
import ImmersiveGameDetails from "./immersive-game-details";
import {
  createVoidCallback,
  dispatchControllerKey,
  installControllerTestEnvironment,
  invoke,
  listen,
  makeStandardPad,
  remoteOnlyGame,
  renderDetails,
  resetImmersiveGameDetailsTest,
  tapPadButton,
  testIpc,
  themeValue,
} from "./immersive-game-details-test-fixtures";
import ImmersiveLibrary from "./immersive-library";
import { useGamepadKeyboardMapper } from "./use-gamepad-keyboard-mapper";

const ControllerProbe = () => {
  useGamepadKeyboardMapper({});
  return null;
};

const ControllerDetailsRouteProbe = () => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  useGamepadKeyboardMapper({});

  if (!detailsOpen) {
    return (
      <ImmersiveLibrary
        loading={false}
        error={null}
        games={[remoteOnlyGame]}
        selectedIndex={selectedIndex}
        onSelectedIndexChange={setSelectedIndex}
        onSelectGame={() => {
          setDetailsOpen(true);
        }}
        onExitImmersive={() => {}}
        onOpenSettings={() => {}}
        onOpenDownloads={() => {}}
      />
    );
  }

  return (
    <ImmersiveGameDetails
      game={remoteOnlyGame}
      platformLabel="Game Boy Advance"
      onBack={() => {}}
      onLaunch={vi.fn().mockResolvedValue({ success: true })}
      onToggleFavorite={() => {}}
      onGameUpdate={() => {}}
      rommToken="saved-token"
      rommUrl="https://romm.example"
      dependencies={{ ipc: testIpc }}
    />
  );
};

const expectControllerFocused = (element) => {
  expect(element).toHaveFocus();
  expect(element).toHaveAttribute("data-controller-focused", "true");
};

const expectSingleInvocation = (command) => {
  expect(
    invoke.mock.calls.filter(([calledCommand]) => calledCommand === command)
  ).toHaveLength(1);
};

const expectMenuClosedWithoutLaunch = (onLaunch) => {
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(onLaunch).not.toHaveBeenCalled();
};

/** @typedef {{message: string, details: {actionId?: number, controllerIndex?: number, key?: string, outcome?: string, reason?: string, receiver?: string}}} DebugEvent */
/** @param {DebugEvent[]} events @param {string} message @param {string} [receiver] @returns {DebugEvent|null} Matching debug event. */
const findDebugEvent = (events, message, receiver) =>
  events.find(
    ({ message: entryMessage, details }) =>
      entryMessage === message &&
      (receiver === undefined || details.receiver === receiver)
  ) ?? null;

/** @param {DebugEvent[]} events @returns {(message: string, details: DebugEvent["details"]) => void} Debug logger. */
const createDebugLogger = (events) => (message, details) => {
  events.push({ details, message });
};

describe("ImmersiveGameDetails controller launch", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("starts the same launch flow when controller A dispatches Enter to window", async () => {
    const onLaunch = vi.fn().mockResolvedValue({ success: true });
    const localGame = { ...remoteOnlyGame, local_file_path: "/roms/cloud.gba" };
    renderDetails(onLaunch, localGame);

    dispatchControllerKey("Enter");

    expect(onLaunch).toHaveBeenCalledWith(localGame.id);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Play" })).not.toBeDisabled();
    });
  });
});

describe("ImmersiveGameDetails controller focus", () => {
  afterEach(resetImmersiveGameDetailsTest);

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
      expectControllerFocused(download);

      pad.buttons[15].pressed = false;
      controller.runFrame();
      controller.advanceRepeatDelay();
      pad.buttons[15].pressed = true;
      controller.runFrame();

      const favorite = screen.getByRole("button", { name: "Favorite" });
      expectControllerFocused(favorite);
      expect(download).not.toHaveAttribute("data-controller-focused");

      pad.buttons[15].pressed = false;
      controller.runFrame();
      controller.advanceRepeatDelay();
      pad.buttons[15].pressed = true;
      controller.runFrame();

      expect(hiddenAction).not.toHaveFocus();
    } finally {
      controller.restore();
    }
  });
});

describe("ImmersiveGameDetails controller debug logging", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("correlates a controller action with the details receiver and focus result", () => {
    vi.stubEnv("VITE_WINGOSY_DEBUG", "1");
    /** @type {DebugEvent[]} */
    const events = [];
    vi.spyOn(console, "info").mockImplementation(createDebugLogger(events));
    const controller = installControllerTestEnvironment();

    try {
      renderDetails();
      const pad = makeStandardPad(15);
      controller.setPads([pad]);
      render(<ControllerProbe />);

      controller.runFrame();

      const recognized = findDebugEvent(
        events,
        "[Wingosy][debug][controller] recognized input/action"
      );
      const handled = findDebugEvent(
        events,
        "[Wingosy][debug][controller] receiver handled",
        "details"
      );
      if (recognized?.details.actionId === undefined || handled === null) {
        throw new Error("Expected correlated controller debug logs");
      }
      expect(handled.details.actionId).toBe(recognized.details.actionId);
      expect(handled.details.controllerIndex).toBe(1);
      expect(handled.details.key).toBe("ArrowRight");
      expect(handled.details.outcome).toBe("handled");
      expect(handled.details.reason).toBe("focus-moved");
    } finally {
      controller.restore();
    }
  });
});

describe("ImmersiveGameDetails opening controller direction", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("keeps the opening frame's direction when controller input opens details", () => {
    const controller = installControllerTestEnvironment();
    try {
      const pad = makeStandardPad(0);
      pad.buttons[15].pressed = true;
      controller.setPads([pad]);

      render(
        <MuiTestProvider>
          <ThemeContext.Provider value={themeValue}>
            <RomDownloadsProvider listen={listen}>
              <ControllerDetailsRouteProbe />
            </RomDownloadsProvider>
          </ThemeContext.Provider>
        </MuiTestProvider>
      );

      for (let frame = 0; frame < 6; frame += 1) {
        controller.runFrame();
      }

      const download = screen.getByRole("button", { name: "Download" });
      expect(download).toHaveFocus();
      expect(download).toHaveAttribute("data-controller-focused", "true");
    } finally {
      controller.restore();
    }
  });
});

describe("ImmersiveGameDetails controller confirmation", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("lets mapper Confirm activate a focused non-Play action", () => {
    const onLaunch = vi.fn().mockResolvedValue({ success: true });
    const onToggleFavorite = createVoidCallback();
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
      expectControllerFocused(screen.getByRole("button", { name: "Favorite" }));

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
});

describe("ImmersiveGameDetails menu focus", () => {
  afterEach(resetImmersiveGameDetailsTest);

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
      if (!(menuFocus instanceof HTMLElement)) {
        throw new Error("Expected menu to own focus");
      }
      expect(screen.getByRole("menu")).toContainElement(menuFocus);

      pad.buttons[13].pressed = true;
      controller.runFrame();

      expect(
        screen.getByRole("menuitem", { name: /Add to collection/u })
      ).toHaveFocus();
      expect(moreOptions).not.toHaveFocus();
    } finally {
      controller.restore();
    }
  });
});

describe("ImmersiveGameDetails menu activation", () => {
  afterEach(resetImmersiveGameDetailsTest);

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
      expect(openMenu).toHaveBeenCalledOnce();
      expect(screen.getAllByRole("menu")).toHaveLength(1);
      expect(
        screen.getByRole("menuitem", { name: /Manage cached saves/u })
      ).toHaveFocus();

      tapPadButton(controller, pad, 13);
      expect(
        screen.getByRole("menuitem", { name: /Add to collection/u })
      ).toHaveFocus();

      tapPadButton(controller, pad, 0);
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith("get_collections");
      });
      expectSingleInvocation("get_collections");
      expectMenuClosedWithoutLaunch(onLaunch);
    } finally {
      controller.restore();
    }
  });
});

describe("ImmersiveGameDetails controller back", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("closes the menu with controller Back and restores details focus", async () => {
    const controller = installControllerTestEnvironment();
    const onBack = createVoidCallback();

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
      await waitFor(() => {
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      });
      expect(moreOptions).toHaveFocus();
      expect(onBack).not.toHaveBeenCalled();
    } finally {
      controller.restore();
    }
  });
});

describe("ImmersiveGameDetails dialog controller focus", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("does not move details focus while a dialog owns controller input", async () => {
    const onLaunch = vi
      .fn()
      .mockRejectedValue(new Error("network unavailable"));
    const controller = installControllerTestEnvironment();

    try {
      renderDetails(onLaunch, {
        ...remoteOnlyGame,
        local_file_path: "/roms/cloud.gba",
      });
      fireEvent.click(screen.getByRole("button", { name: "Play" }));
      await waitFor(() => {
        expect(screen.getByText("network unavailable")).toBeInTheDocument();
      });
      const retry = screen.getByRole("button", { name: "Retry" });
      await waitFor(() => {
        expect(retry).toHaveFocus();
      });

      const pad = makeStandardPad(15);
      controller.setPads([pad]);
      render(<ControllerProbe />);
      controller.runFrame();

      expect(retry).toHaveFocus();
    } finally {
      controller.restore();
    }
  });
});

describe("ImmersiveGameDetails dialog controller debug", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("logs a concise controller suppression reason for an open details dialog", async () => {
    vi.stubEnv("VITE_WINGOSY_DEBUG", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const onLaunch = vi
      .fn()
      .mockRejectedValue(new Error("network unavailable"));
    const controller = installControllerTestEnvironment();

    try {
      renderDetails(onLaunch, {
        ...remoteOnlyGame,
        local_file_path: "/roms/cloud.gba",
      });
      fireEvent.click(screen.getByRole("button", { name: "Play" }));
      await waitFor(() => {
        expect(screen.getByText("network unavailable")).toBeInTheDocument();
      });

      const pad = makeStandardPad(15);
      controller.setPads([pad]);
      render(<ControllerProbe />);
      controller.runFrame();

      expect(info).toHaveBeenCalledWith(
        "[Wingosy][debug][controller] receiver suppressed",
        expect.objectContaining({
          key: "ArrowRight",
          outcome: "suppressed",
          reason: "dialog open",
          receiver: "details",
        })
      );
    } finally {
      controller.restore();
    }
  });
});

describe("ImmersiveGameDetails native controls", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("does not route native control key events through the controller handler", () => {
    const onLaunch = vi.fn().mockResolvedValue({ success: true });
    renderDetails(onLaunch);

    fireEvent.keyDown(screen.getByRole("button", { name: "Download" }), {
      key: "Enter",
    });

    expect(onLaunch).not.toHaveBeenCalled();
  });
});
