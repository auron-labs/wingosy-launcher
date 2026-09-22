import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cleanupGameDetailsTest,
  createDeferred,
  invoke,
  renderDetails,
  switchRemoteGame,
} from "./game-details-test-fixtures";

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

describe("GameDetails missing emulator installation", () => {
  afterEach(cleanupGameDetailsTest);

  it("installs the sole compatible emulator without relaunching the game", async () => {
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
    renderDetails({ game: switchRemoteGame, onLaunch });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    const install = await screen.findByRole("button", {
      name: "Install Eden",
    });
    fireEvent.click(install);

    expect(invoke).toHaveBeenCalledWith("download_emulator", {
      emulatorId: "eden",
    });
    expect(screen.getByText("Installing Eden…")).toBeInTheDocument();
    expect(install).toBeDisabled();

    await act(async () => {
      installation.resolve("C:\\Emulators\\eden.exe");
      await installation.promise;
    });
    await expect(
      screen.findByText("Eden was installed. Press Play when you're ready.")
    ).resolves.toBeInTheDocument();
    expect({
      launches: onLaunch.mock.calls,
      playDisabled: screen
        .getByRole("button", { name: "Play" })
        .hasAttribute("disabled"),
    }).toStrictEqual({
      launches: [[switchRemoteGame.id]],
      playDisabled: false,
    });
  });

  it("cancels the install offer while keeping missing-emulator guidance", async () => {
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
    renderDetails({ game: switchRemoteGame, onLaunch });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(
      invoke.mock.calls.filter(([command]) => command === "download_emulator")
    ).toHaveLength(0);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Open Settings → Emulators"
    );
    expect(
      screen.queryByRole("button", { name: "Install Eden" })
    ).not.toBeInTheDocument();
  });
});

describe("GameDetails missing emulator installation availability", () => {
  afterEach(cleanupGameDetailsTest);

  it.each([
    ["zero", []],
    ["multiple", [eden, { ...eden, id: "ryujinx", name: "Ryujinx" }]],
  ])(
    "does not offer an install with %s eligible candidates",
    async (_, emulators) => {
      const onLaunch = vi.fn().mockResolvedValue({
        error: "No emulator configured for platform: switch",
        success: false,
      });
      invoke.mockImplementation((command) => {
        if (command === "get_emulators_for_platform") {
          return emulators;
        }
        return { display: {} };
      });
      renderDetails({ game: switchRemoteGame, onLaunch });

      fireEvent.click(screen.getByRole("button", { name: "Play" }));
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith("get_emulators_for_platform", {
          platformId: "switch",
        });
      });
      expect(screen.queryByRole("button", { name: /Install /u })).toBeNull();
    }
  );

  it("does not look up an install offer for unrelated launch errors", async () => {
    const onLaunch = vi.fn().mockResolvedValue({
      error: "The emulator closed before it could start",
      success: false,
    });
    renderDetails({ game: switchRemoteGame, onLaunch });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await expect(
      screen.findByText("The emulator closed before it could start")
    ).resolves.toBeInTheDocument();
    expect(
      invoke.mock.calls.filter(
        ([command]) => command === "get_emulators_for_platform"
      )
    ).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Install /u })).toBeNull();
  });
});
