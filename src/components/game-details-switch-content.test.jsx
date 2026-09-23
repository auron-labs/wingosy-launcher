import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  cleanupGameDetailsTest,
  createDeferred,
  dispatchEvent,
  eventListeners,
  invoke,
  listen,
  renderDetails,
  switchRemoteGame,
} from "./game-details-test-fixtures";

describe("GameDetails Switch content sync", () => {
  afterEach(cleanupGameDetailsTest);

  it("dispatches Switch content sync once and reports its completion summary", async () => {
    /** @type {PromiseWithResolvers<{downloaded: number, message: string, reused: number, success: boolean}>} */
    const syncRequest = createDeferred();
    invoke.mockImplementation(async (command) => {
      if (command === "sync_switch_content") {
        return await syncRequest.promise;
      }
      return { display: {} };
    });
    renderDetails({ game: switchRemoteGame });

    const sync = screen.getByRole("button", { name: "Sync Updates & DLC" });
    fireEvent.click(sync);
    fireEvent.click(sync);

    expect(invoke).toHaveBeenCalledWith("sync_switch_content", {
      gameId: switchRemoteGame.id,
    });
    expect(
      invoke.mock.calls.filter(([command]) => command === "sync_switch_content")
    ).toHaveLength(1);
    expect(sync).toBeDisabled();

    syncRequest.resolve({
      downloaded: 1,
      message: "Synced Switch content: 1 downloaded, 2 reused.",
      reused: 2,
      success: true,
    });
    await expect(
      screen.findByText("Synced Switch content: 1 downloaded, 2 reused.")
    ).resolves.toBeInTheDocument();
  });
});

describe("GameDetails Switch content progress", () => {
  afterEach(cleanupGameDetailsTest);

  it("renders Switch content progress and actionable retry guidance", async () => {
    window.__TAURI_INTERNALS__ = {};
    listen.mockImplementation(async (event, handler) => {
      eventListeners.set(event, handler);
      const unsubscribe = () => {
        eventListeners.delete(event);
      };
      return await Promise.resolve(unsubscribe);
    });
    /** @type {PromiseWithResolvers<{message: string, success: boolean}>} */
    const syncRequest = createDeferred();
    invoke.mockImplementation(async (command) => {
      if (command === "sync_switch_content") {
        return await syncRequest.promise;
      }
      return { display: {} };
    });
    renderDetails({ game: switchRemoteGame });

    await waitFor(() => {
      if (!eventListeners.has("switch-content-sync-progress")) {
        throw new Error("Switch content progress listener is not registered");
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Sync Updates & DLC" }));
    act(() => {
      dispatchEvent("switch-content-sync-progress", {
        downloaded: 512,
        file_index: 1,
        game_id: switchRemoteGame.id,
        percent: 50,
        stage: "downloading",
        total: 1024,
        total_files: 2,
      });
    });
    expect(
      screen.getByTestId("switch-content-sync-progress")
    ).toHaveTextContent("Downloading Switch content… (1/2)");
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "50"
    );

    syncRequest.resolve({
      message: "Synced Switch content: 1 downloaded, 1 reused.",
      success: true,
    });
    await waitFor(() => {
      expect(screen.getByText(/1 downloaded, 1 reused/u)).toBeInTheDocument();
    });

    invoke.mockImplementation(async (command) => {
      if (command === "sync_switch_content") {
        return await Promise.reject(new Error("Eden is running"));
      }
      return await Promise.resolve({ display: {} });
    });
    fireEvent.click(screen.getByRole("button", { name: "Sync Updates & DLC" }));
    await expect(
      screen.findByText(/Eden is running/u)
    ).resolves.toBeInTheDocument();
  });
});

const countSwitchStatusCalls = () =>
  invoke.mock.calls.filter(
    ([command]) => command === "get_switch_content_status"
  ).length;

describe("GameDetails Switch content status", () => {
  afterEach(cleanupGameDetailsTest);

  it("loads the read-only status on open and again after reopening", async () => {
    invoke.mockImplementation((command) => {
      if (command === "get_switch_content_status") {
        return { status: "current" };
      }
      return { display: {} };
    });

    const view = renderDetails({ game: switchRemoteGame });
    await waitFor(() => {
      expect(countSwitchStatusCalls()).toBe(1);
    });
    expect(
      screen.queryByTestId("switch-content-status")
    ).not.toBeInTheDocument();
    view.unmount();

    renderDetails({ game: switchRemoteGame });
    await waitFor(() => {
      expect(countSwitchStatusCalls()).toBe(2);
    });
    expect(
      screen.queryByTestId("switch-content-status")
    ).not.toBeInTheDocument();
  });

  it("refreshes the status after a successful Sync Updates & DLC", async () => {
    let status = "missing";
    invoke.mockImplementation((command) => {
      if (command === "get_switch_content_status") {
        return { status };
      }
      if (command === "sync_switch_content") {
        status = "current";
        return {
          downloaded: 1,
          message: "Synced Switch content: 1 downloaded, 0 reused.",
          reused: 0,
          success: true,
        };
      }
      return { display: {} };
    });
    renderDetails({ game: switchRemoteGame });

    await expect(
      screen.findByTestId("switch-content-status")
    ).resolves.toHaveTextContent("Wingosy update & DLC files are missing");

    fireEvent.click(screen.getByRole("button", { name: "Sync Updates & DLC" }));
    await waitFor(() => {
      expect(
        screen.queryByTestId("switch-content-status")
      ).not.toBeInTheDocument();
    });
  });

  it("does not claim current when the status lookup is unavailable", async () => {
    invoke.mockImplementation((command) => {
      if (command === "get_switch_content_status") {
        throw new Error("RomM is offline");
      }
      return { display: {} };
    });
    renderDetails({ game: switchRemoteGame });

    await waitFor(() => {
      expect(
        screen.queryByTestId("switch-content-status")
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/current/u)).not.toBeInTheDocument();
  });
});
