import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  cleanupGameDetailsTest,
  invoke,
  renderDetails,
  switchRemoteGame,
} from "./game-details-test-fixtures";

describe("GameDetails protected Eden saves", () => {
  afterEach(cleanupGameDetailsTest);

  it("shows the persisted protected revision without its baseline fingerprint", async () => {
    invoke.mockImplementation(async (command) => {
      if (command === "get_switch_save_restore_protection") {
        return await Promise.resolve({
          baseline_fingerprint: "must-not-be-displayed",
          selected_revision: {
            file_name: "before-ganondorf.zip",
            id: 9001,
            slot: "before-boss",
            updated_at: "2026-09-18T10:00:00Z",
          },
        });
      }
      return await Promise.resolve({ display: {} });
    });
    renderDetails({ game: switchRemoteGame });

    await expect(
      screen.findByText("Protected Eden revision")
    ).resolves.toBeInTheDocument();
    expect(screen.getByText(/before-ganondorf\.zip/u)).toBeInTheDocument();
    expect(screen.getByText(/before-boss/u)).toBeInTheDocument();
    expect(screen.queryByText("must-not-be-displayed")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Resume normal sync" })
    ).toBeInTheDocument();
  });

  it("keeps protection and offers retry when resuming normal sync fails", async () => {
    let resumeCalls = 0;
    invoke.mockImplementation(async (command) => {
      if (command === "get_switch_save_restore_protection") {
        return await Promise.resolve({
          selected_revision: { file_name: "protected-save.zip", id: 9001 },
        });
      }
      if (command === "resume_switch_save_normal_sync") {
        resumeCalls += 1;
        throw new Error(
          "Resume normal sync returned an error: HTTP status server error (503 Service Unavailable)"
        );
      }
      return await Promise.resolve({ display: {} });
    });
    renderDetails({ game: switchRemoteGame });

    await screen.findByText("Protected Eden revision");
    fireEvent.click(screen.getByRole("button", { name: "Resume normal sync" }));

    await screen.findByText(/503 Service Unavailable/u);
    expect(screen.getByText("Protected Eden revision")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(resumeCalls).toBe(2);
    });
  });
});
