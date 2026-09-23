import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDeferred,
  dispatchControllerKey,
  dispatchEvent,
  eventListeners,
  invoke,
  launchableGame,
  listen,
  remoteOnlyGame,
  renderDetails,
  resetImmersiveGameDetailsTest,
  resolveDeferred,
  createVoidCallback,
  switchLaunchableGame,
} from "./immersive-game-details-test-fixtures";

const installLaunchProgressListener = () => {
  window.__TAURI_INTERNALS__ = {};
  listen.mockImplementation(async (event, handler) => {
    eventListeners.set(event, handler);
    return await Promise.resolve(() => {
      eventListeners.delete(event);
    });
  });
};

/** @param {string} label Progress label. */
const expectIndeterminateProgress = (label) => {
  expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
};

const expectDeterminateProgress = () => {
  expect(screen.getByText("Downloading ROM...")).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "50"
  );
  expect(screen.getByText(/50%.*512\.0 KB.*1\.00 MB/u)).toBeInTheDocument();
};

const expectMissingEmulatorDialog = () => {
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent(/PlayStation 2.*Settings → Emulators/u);
  expect(dialog).not.toHaveTextContent("Cloud Game");
  expect(
    screen.queryByRole("button", { name: "Retry" })
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Launch failed" })
  ).toBeInTheDocument();
  expect(screen.getByText("Esc to go back")).toBeInTheDocument();
};

const eden = {
  has_download: true,
  id: "eden",
  install_type: null,
  installed_path: null,
  is_installed: false,
  name: "Eden",
  supported_platforms: ["switch"],
  version: null,
};

describe("ImmersiveGameDetails repeated launch input", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("ignores repeated or buffered Enter input while preparation is active", async () => {
    /** @type {PromiseWithResolvers<{success: boolean}>} */
    const launch = createDeferred();
    const onLaunch = vi.fn(async () => await launch.promise);
    renderDetails(onLaunch, launchableGame);
    const details = screen.getByTestId("immersive-game-details");

    dispatchControllerKey("Enter");
    dispatchControllerKey("Enter");
    dispatchControllerKey("Enter", { repeat: true });

    expect(onLaunch).toHaveBeenCalledOnce();
    resolveDeferred(launch, { success: true });
    await waitFor(() => {
      expect(
        within(details).getByText("Play", { selector: "button" })
      ).toBeEnabled();
    });
  });
});

describe("ImmersiveGameDetails launch progress", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("shows determinate and indeterminate preparation progress while Play is awaiting exit", async () => {
    installLaunchProgressListener();
    /** @type {PromiseWithResolvers<{success: boolean}>} */
    const launch = createDeferred();
    const onLaunch = vi.fn(async () => await launch.promise);
    renderDetails(onLaunch, launchableGame);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => {
      expect(eventListeners.has("game-launch-progress")).toBeTruthy();
    });

    act(() => {
      dispatchEvent("game-launch-progress", {
        game_id: remoteOnlyGame.id,
        game_name: remoteOnlyGame.name,
        stage: "bios_preparation",
      });
    });
    expectIndeterminateProgress("Preparing BIOS...");

    act(() => {
      dispatchEvent("game-launch-progress", {
        downloaded: 512 * 1024,
        game_id: remoteOnlyGame.id,
        game_name: remoteOnlyGame.name,
        percent: 50,
        stage: "downloading",
        total: 1024 * 1024,
      });
    });
    expect(screen.getByRole("dialog")).not.toHaveTextContent("Cloud Game");
    expectDeterminateProgress();
  });
});

describe("ImmersiveGameDetails launch completion", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("returns focus after the emulator starts and launch preparation finishes", async () => {
    installLaunchProgressListener();
    /** @type {PromiseWithResolvers<{success: boolean}>} */
    const launch = createDeferred();
    const onLaunch = vi.fn(async () => await launch.promise);
    renderDetails(onLaunch, launchableGame);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => {
      expect(eventListeners.has("game-launch-progress")).toBeTruthy();
    });

    act(() => {
      dispatchEvent("game-launch-progress", {
        downloaded: null,
        game_id: remoteOnlyGame.id,
        game_name: remoteOnlyGame.name,
        percent: null,
        stage: "running",
        total: null,
      });
    });
    expectIndeterminateProgress("Emulator running");
    act(() => {
      dispatchEvent("game-launch-progress", {
        game_id: remoteOnlyGame.id,
        game_name: remoteOnlyGame.name,
        stage: "completion",
      });
    });
    expect(screen.getByText("Launch complete")).toBeInTheDocument();

    resolveDeferred(launch, { success: true });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Play" })).toHaveFocus();
  });
});

describe("ImmersiveGameDetails launch retry", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("keeps failure recovery controller-safe with focused Retry", async () => {
    const onLaunch = vi
      .fn()
      .mockRejectedValue(new Error("network unavailable"));
    renderDetails(onLaunch, launchableGame);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => {
      expect(screen.getByText("network unavailable")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();
    });

    dispatchControllerKey("Enter", { repeat: true });
    expect(onLaunch).toHaveBeenCalledOnce();
    dispatchControllerKey("Enter");
    await waitFor(() => {
      expect(onLaunch).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByText("network unavailable")).toBeInTheDocument();
    });
  });
});

describe("ImmersiveGameDetails failure back", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("uses a non-repeating controller Back to leave a launch failure", async () => {
    const onBack = createVoidCallback();
    const onLaunch = vi
      .fn()
      .mockRejectedValue(new Error("network unavailable"));
    renderDetails(onLaunch, launchableGame, { onBack });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => {
      expect(screen.getByText("network unavailable")).toBeInTheDocument();
    });
    dispatchControllerKey("Escape", { repeat: true });
    expect(onBack).not.toHaveBeenCalled();
    dispatchControllerKey("Escape");
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe("ImmersiveGameDetails missing emulator guidance", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("translates missing emulator guidance without Retry", async () => {
    const onLaunch = vi.fn().mockResolvedValue({
      error: "No emulator configured for platform: ps2",
      success: false,
    });
    renderDetails(onLaunch, launchableGame, {
      platformLabel: "PlayStation 2",
    });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => {
      expect(
        screen.getByText(/no compatible emulator is installed/u)
      ).toBeInTheDocument();
    });
    expectMissingEmulatorDialog();
    expect(document.querySelector(".MuiBackdrop-root")).toBeInTheDocument();
  });
});

describe("ImmersiveGameDetails missing emulator installation confirmation", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("confirms the sole install offer with pending and success feedback without relaunching", async () => {
    /** @type {PromiseWithResolvers<string>} */
    const installation = createDeferred();
    const onLaunch = vi.fn().mockResolvedValue({
      error: "No emulator configured for platform: switch",
      success: false,
    });
    invoke.mockImplementation(async (command) => {
      if (command === "get_emulators_for_platform") {
        return [eden];
      }
      if (command === "download_emulator") {
        return await installation.promise;
      }
      return { display: {} };
    });
    renderDetails(onLaunch, switchLaunchableGame, {
      platformLabel: "Nintendo Switch",
    });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    const install = await screen.findByRole("button", {
      name: "Install Eden",
    });
    expect(install).toHaveFocus();
    fireEvent.click(install);

    expect(invoke).toHaveBeenCalledWith("download_emulator", {
      emulatorId: "eden",
    });
    expect(screen.getByText("Installing Eden…")).toBeInTheDocument();

    await act(async () => {
      installation.resolve("C:\\Emulators\\eden.exe");
      await installation.promise;
    });
    await expect(
      screen.findByText("Eden was installed. Press Play when you're ready.")
    ).resolves.toBeInTheDocument();
    expect(onLaunch).toHaveBeenCalledOnce();
  });
});

describe("ImmersiveGameDetails missing emulator installation errors", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("shows installation errors in the launch recovery dialog", async () => {
    const onLaunch = vi.fn().mockResolvedValue({
      error: "No emulator configured for platform: switch",
      success: false,
    });
    invoke.mockImplementation((command) => {
      if (command === "get_emulators_for_platform") {
        return [eden];
      }
      if (command === "download_emulator") {
        throw new Error("Download failed");
      }
      return { display: {} };
    });
    renderDetails(onLaunch, switchLaunchableGame, {
      platformLabel: "Nintendo Switch",
    });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Install Eden" })
    );

    await expect(
      screen.findByText("Couldn’t install Eden: Download failed")
    ).resolves.toBeInTheDocument();
    expect(onLaunch).toHaveBeenCalledOnce();
  });
});

describe("ImmersiveGameDetails missing emulator installation cancellation", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("cancels only the install offer without installing", async () => {
    const onLaunch = vi.fn().mockResolvedValue({
      error: "No emulator configured for platform: switch",
      success: false,
    });
    invoke.mockImplementation((command) => {
      if (command === "get_emulators_for_platform") {
        return [eden];
      }
      return { display: {} };
    });
    renderDetails(onLaunch, switchLaunchableGame, {
      platformLabel: "Nintendo Switch",
    });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(
      invoke.mock.calls.filter(([command]) => command === "download_emulator")
    ).toHaveLength(0);
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Open Settings → Emulators"
    );
    expect(
      screen.queryByRole("button", { name: "Install Eden" })
    ).not.toBeInTheDocument();
  });
});

describe("ImmersiveGameDetails Settings recovery", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("sends a deterministic launch failure to Settings", async () => {
    const onOpenSettings = createVoidCallback();
    const onLaunch = vi.fn().mockResolvedValue({
      error: "No compatible RetroArch core is installed for ps2",
      success: false,
    });
    renderDetails(onLaunch, launchableGame, {
      onOpenSettings,
      platformLabel: "PlayStation 2",
    });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => {
      expect(
        screen.getByText(/no compatible emulator is installed/u)
      ).toBeInTheDocument();
    });
    dispatchControllerKey("Enter");

    await waitFor(() => {
      expect(onOpenSettings).toHaveBeenCalledOnce();
    });
    expect(onLaunch).toHaveBeenCalledOnce();
  });
});

describe("ImmersiveGameDetails cloud saves guidance", () => {
  afterEach(resetImmersiveGameDetailsTest);

  it("drops the More options menu guidance from cloud saves", () => {
    renderDetails(undefined, remoteOnlyGame);

    expect(
      screen.queryByText(/this game's More options menu/u)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/the menu above/u)).not.toBeInTheDocument();
  });
});
