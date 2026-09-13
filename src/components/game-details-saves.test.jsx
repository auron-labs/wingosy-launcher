import { fireEvent, screen, waitFor } from "@testing-library/react";
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
      if (command === "get_game_saves") {
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

    fireEvent.click(screen.getByRole("button", { name: "List Saves" }));
    await screen.findByText("Cloud Save");
    fireEvent.click(screen.getByTitle("Download save"));

    await expect(
      screen.findByText(/503 Service Unavailable/u)
    ).resolves.toBeInTheDocument();
    expect(saveCalls).toStrictEqual([
      [
        "download_switch_save",
        { gameId: switchRemoteGame.id, saveId: 9001, slot: "autosave" },
      ],
    ]);

    fireEvent.change(
      screen.getByRole("textbox", { name: "RomM slot (channel)" }),
      { target: { value: "changed-after-failure" } }
    );
    const retry = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retry);
    await waitFor(() => {
      expect(saveCalls).toHaveLength(2);
    });
    expect(saveCalls[1]).toStrictEqual(saveCalls[0]);
    expect(retry).toBeDisabled();

    retryRequest.resolve({ message: "Retry restored save" });
    await expect(
      screen.findByText("Retry restored save")
    ).resolves.toBeInTheDocument();
  });

  it("does not offer Retry for a permanent save failure", async () => {
    invoke.mockImplementation(async (command) => {
      if (command === "get_game_saves") {
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

    fireEvent.click(screen.getByRole("button", { name: "List Saves" }));
    await screen.findByText("Cloud Save");
    fireEvent.click(screen.getByTitle("Download save"));

    await expect(
      screen.findByText("Save not found on server")
    ).resolves.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retry" })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(
      screen.queryByText("Save not found on server")
    ).not.toBeInTheDocument();
  });
});
