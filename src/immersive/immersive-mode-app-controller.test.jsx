import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  initialGames,
  invoke,
  renderImmersiveModeApp,
  resetImmersiveModeTest,
} from "./immersive-mode-app-test-fixtures";

const makeControllerPad = () => ({
  axes: [0, 0],
  buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
  index: 0,
  mapping: "standard",
});

let restoreControllerPad = () => {};

/** @param {{axes: number[], buttons: {pressed: boolean}[], index: number, mapping: string}} pad Controller to expose to the mapper. */
const installControllerPad = (pad) => {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "getGamepads");
  const getGamepads = vi.fn(() => [pad]);
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: getGamepads,
  });
  restoreControllerPad = () => {
    if (descriptor === undefined) {
      Reflect.deleteProperty(navigator, "getGamepads");
    } else {
      Object.defineProperty(navigator, "getGamepads", descriptor);
    }
    restoreControllerPad = () => {};
  };
};

const awaitNextAnimationFrame = async () => {
  const deferred = Promise.withResolvers();
  window.requestAnimationFrame(() => {
    deferred.resolve();
  });
  await deferred.promise;
};

/** @param {{buttons: {pressed: boolean}[]}} pad Controller to press. @param {number} buttonIndex Standard button index. */
const tapControllerButton = async (pad, buttonIndex) => {
  pad.buttons[buttonIndex].pressed = true;
  await act(async () => {
    await awaitNextAnimationFrame();
  });
  pad.buttons[buttonIndex].pressed = false;
  await act(async () => {
    await awaitNextAnimationFrame();
  });
};

const resetControllerRouteTest = () => {
  restoreControllerPad();
  resetImmersiveModeTest();
};

const mockLoadedLibrary = () => {
  invoke.mockImplementation((command) => {
    if (command === "get_games_page") {
      return { games: initialGames, total: initialGames.length };
    }
    if (command === "get_platforms_with_games") {
      return [];
    }
    if (command === "get_config") {
      return { display: { big_picture: true } };
    }
    return null;
  });
};

describe("ImmersiveModeApp controller library route", () => {
  afterEach(resetControllerRouteTest);

  it("moves the visible library selection once and opens that game on confirm", async () => {
    mockLoadedLibrary();

    renderImmersiveModeApp();
    await waitFor(() => {
      expect(screen.getByTestId("game-1")).toBeInTheDocument();
    });

    const pad = makeControllerPad();
    installControllerPad(pad);
    pad.axes[0] = 1;
    await waitFor(() => {
      expect(screen.getByTestId("selected-index")).toHaveTextContent("1");
    });
    pad.axes[0] = 0;
    pad.buttons[0].pressed = true;
    await waitFor(() => {
      expect(screen.getByTestId("details-game")).toHaveTextContent(
        "Second Game"
      );
    });
    pad.buttons[0].pressed = false;
  });
});

describe("ImmersiveModeApp controller details route", () => {
  afterEach(resetControllerRouteTest);

  it("moves among visible details actions and activates the focused action once", async () => {
    mockLoadedLibrary();
    renderImmersiveModeApp();
    await waitFor(() => {
      expect(screen.getByTestId("game-1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("game-1"));

    const favorite = screen.getByRole("button", { name: "Favorite" });
    const pad = makeControllerPad();
    installControllerPad(pad);
    pad.axes[0] = 1;
    await waitFor(() => {
      expect(favorite).toHaveFocus();
    });

    pad.axes[0] = 0;
    await act(async () => {
      await awaitNextAnimationFrame();
    });
    await tapControllerButton(pad, 0);

    expect(screen.getByRole("button", { name: "Unfavorite" })).toBeVisible();
  });
});

describe("ImmersiveModeApp controller details menu priority", () => {
  afterEach(resetControllerRouteTest);

  it("keeps a details menu ahead of background focus before Back navigates", async () => {
    mockLoadedLibrary();
    renderImmersiveModeApp();
    await waitFor(() => {
      expect(screen.getByTestId("game-1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("game-1"));
    const openMenu = screen.getByRole("button", { name: "Open menu" });
    openMenu.focus();
    fireEvent.click(openMenu);

    const pad = makeControllerPad();
    installControllerPad(pad);
    pad.axes[0] = 1;
    await waitFor(() => {
      expect(screen.getByTestId("details-menu-action")).toHaveTextContent(
        "ArrowRight"
      );
    });
    expect(openMenu).toHaveFocus();

    pad.axes[0] = 0;
    await act(async () => {
      await awaitNextAnimationFrame();
    });
    await tapControllerButton(pad, 1);
    expect(screen.queryByTestId("details-menu-action")).not.toBeInTheDocument();
    expect(screen.getByTestId("details-game")).toBeInTheDocument();

    await tapControllerButton(pad, 1);
    await waitFor(() => {
      expect(screen.getByTestId("immersive-library")).toBeInTheDocument();
    });
  });
});

describe("ImmersiveModeApp controller details overlay priority", () => {
  afterEach(resetControllerRouteTest);

  it("closes a visible dialog before the next Back leaves details", async () => {
    mockLoadedLibrary();

    renderImmersiveModeApp();
    await waitFor(() => {
      expect(screen.getByTestId("game-1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("game-1"));
    fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    const pad = makeControllerPad();
    installControllerPad(pad);
    await tapControllerButton(pad, 1);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("details-game")).toBeInTheDocument();

    await tapControllerButton(pad, 1);
    await waitFor(() => {
      expect(screen.getByTestId("immersive-library")).toBeInTheDocument();
    });
  });
});

describe("ImmersiveModeApp controller menu priority", () => {
  afterEach(resetControllerRouteTest);

  it("delivers an action to an open menu without activating the background", async () => {
    mockLoadedLibrary();

    renderImmersiveModeApp();
    await waitFor(() => {
      expect(screen.getByTestId("game-1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    const pad = makeControllerPad();
    installControllerPad(pad);
    pad.buttons[8].pressed = true;
    await waitFor(() => {
      expect(screen.getByTestId("library-menu-action")).toHaveTextContent("h");
    });

    expect(screen.getByTestId("immersive-hints")).toHaveTextContent("true");
    expect(screen.getByTestId("selected-index")).toHaveTextContent("0");
    pad.buttons[8].pressed = false;
  });
});

describe("ImmersiveModeApp controller shell route", () => {
  afterEach(resetControllerRouteTest);

  it("routes shell actions by current view without activating the library", async () => {
    const onExit = vi.fn();
    mockLoadedLibrary();

    renderImmersiveModeApp({ onExit });
    await waitFor(() => {
      expect(screen.getByTestId("game-1")).toBeInTheDocument();
    });

    const pad = makeControllerPad();
    installControllerPad(pad);
    pad.buttons[9].pressed = true;
    await waitFor(() => {
      expect(screen.getByTestId("immersive-settings")).toBeInTheDocument();
    });
    pad.buttons[9].pressed = false;

    pad.buttons[1].pressed = true;
    await waitFor(() => {
      expect(screen.getByTestId("immersive-library")).toBeInTheDocument();
    });
    pad.buttons[1].pressed = false;

    pad.buttons[8].pressed = true;
    await waitFor(() => {
      expect(screen.getByTestId("immersive-hints")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("selected-index")).toHaveTextContent("0");
    pad.buttons[8].pressed = false;

    pad.buttons[1].pressed = true;
    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "Exit immersive mode?" })
      ).toBeInTheDocument();
    });
    pad.buttons[1].pressed = false;

    screen.getByRole("button", { name: "Exit" }).focus();

    pad.buttons[0].pressed = true;
    await waitFor(() => {
      expect(onExit).toHaveBeenCalledOnce();
    });
    expect(screen.getByTestId("selected-index")).toHaveTextContent("0");
    pad.buttons[0].pressed = false;
  });
});

describe("ImmersiveModeApp controller text-entry route", () => {
  afterEach(resetControllerRouteTest);

  it("suppresses routed controller shortcuts while search text has focus", async () => {
    mockLoadedLibrary();

    renderImmersiveModeApp();
    await waitFor(() => {
      expect(screen.getByTestId("game-1")).toBeInTheDocument();
    });
    const search = screen.getByRole("textbox", {
      name: "Search games by name",
    });
    search.focus();

    const pad = makeControllerPad();
    installControllerPad(pad);
    pad.buttons[8].pressed = true;
    await act(async () => {
      await awaitNextAnimationFrame();
    });

    expect(screen.getByTestId("immersive-hints")).toHaveTextContent("true");
    expect(search).toHaveFocus();
    pad.buttons[8].pressed = false;
  });
});
