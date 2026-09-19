import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  cleanupGameDetailsTest,
  createDeferred,
  invoke,
  renderDetails,
  switchRemoteGame,
} from "./game-details-test-fixtures";

describe("GameDetails save actions", () => {
  afterEach(cleanupGameDetailsTest);

  it("offers a guarded save-sync retry with the same slot and save id", async () => {
    const saveCalls = [];
    /** @type {PromiseWithResolvers<{message: string}>} */
    const retryRequest = createDeferred();
    invoke.mockImplementation(async (command, args) => {
      if (command === "get_switch_game_saves") {
        return [{ file_name: "Cloud Save", id: 9001, slot: "autosave" }];
      }
      if (command === "download_switch_save") {
        saveCalls.push([command, args]);
        if (saveCalls.length === 1) {
          throw new Error(
            "Device-aware save download returned an error: HTTP status server error (503 Service Unavailable) for url (https://romm.example/api/saves/9001/content)"
          );
        }
        return await retryRequest.promise;
      }
      return { display: {} };
    });
    renderDetails({ game: switchRemoteGame });

    fireEvent.click(screen.getByRole("button", { name: "History" }));
    const history = await screen.findByRole("dialog", { name: "Save history" });
    await within(history).findByText("Current cloud save");
    fireEvent.click(within(history).getByRole("button", { name: "Restore…" }));
    const restore = await screen.findByRole("dialog", {
      name: "Restore this save?",
    });
    fireEvent.click(
      within(restore).getByRole("button", { name: "Restore save" })
    );

    await expect(
      screen.findByText(/503 Service Unavailable/u)
    ).resolves.toBeInTheDocument();
    expect(saveCalls).toStrictEqual([
      [
        "download_switch_save",
        { gameId: switchRemoteGame.id, saveId: 9001, slot: null },
      ],
    ]);

    const retry = await screen.findByRole("button", { name: "Retry" });
    fireEvent.click(retry);
    await waitFor(() => {
      expect(saveCalls).toHaveLength(2);
    });
    expect(saveCalls[1]).toStrictEqual(saveCalls[0]);
    expect(retry).toBeDisabled();

    retryRequest.resolve({ message: "Retry restored save" });
    await expect(
      screen.findAllByText("Save restored.")
    ).resolves.not.toHaveLength(0);
  });

  it("does not offer Retry for a permanent save failure", async () => {
    invoke.mockImplementation(async (command) => {
      if (command === "get_switch_game_saves") {
        return await Promise.resolve([
          { file_name: "Cloud Save", id: 9001, slot: "autosave" },
        ]);
      }
      if (command === "download_switch_save") {
        return await Promise.reject(new Error("Save not found on server"));
      }
      return await Promise.resolve({ display: {} });
    });
    renderDetails({ game: switchRemoteGame });

    fireEvent.click(screen.getByRole("button", { name: "History" }));
    const history = await screen.findByRole("dialog", { name: "Save history" });
    await within(history).findByText("Current cloud save");
    fireEvent.click(within(history).getByRole("button", { name: "Restore…" }));
    const restore = await screen.findByRole("dialog", {
      name: "Restore this save?",
    });
    fireEvent.click(
      within(restore).getByRole("button", { name: "Restore save" })
    );

    await expect(
      screen.findByText("Save not found on server")
    ).resolves.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retry" })
    ).not.toBeInTheDocument();
  });

  it("hides slot internals and offers safe conflict choices", async () => {
    invoke.mockImplementation(async (command, args) => {
      if (command === "get_config") {
        return { display: {}, romm: { sync_saves: false } };
      }
      if (command === "get_switch_game_saves") {
        return [];
      }
      if (command === "sync_current_switch_save") {
        throw new Error(
          'Upload returned 409 Conflict: {"detail":"Slot has a newer save since your last sync"}'
        );
      }
      if (command === "upload_switch_save") {
        return { message: "Backup created" };
      }
      if (command === "download_switch_save") {
        return { message: "Cloud save restored" };
      }
      return { display: {}, ...args };
    });
    renderDetails({ game: switchRemoteGame });

    expect(
      screen.queryByText(/argosy-latest|RomM slot/iu)
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    const history = await screen.findByRole("dialog", { name: "Save history" });

    fireEvent.click(
      within(history).getByRole("button", { name: "Sync current save" })
    );
    expect(
      await within(history).findByText("Choose a save carefully")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Use cloud" })
    ).not.toBeInTheDocument();
  });
});
