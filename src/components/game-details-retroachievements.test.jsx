import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  cleanupGameDetailsTest,
  createDeferred,
  createDetailsElement,
  invoke,
  remoteOnlyGame,
  renderDetails,
} from "./game-details-test-fixtures";

const countAchievementRequests = () =>
  invoke.mock.calls.filter(
    ([command]) => command === "get_romm_retroachievements"
  ).length;

describe("GameDetails RetroAchievements delivery", () => {
  afterEach(cleanupGameDetailsTest);

  it("delivers mapped achievement rows through the RomM details seam", async () => {
    const achievements = [
      { id: 101, points: 10, title: "Earned", unlocked: true },
      { id: 102, points: 20, title: "Locked", unlocked: false },
    ];
    invoke.mockImplementation((command) => {
      if (command === "get_config") {
        return { display: { retroachievements_enabled: true } };
      }
      if (command === "get_romm_retroachievements") {
        return achievements;
      }
      return { display: {} };
    });

    renderDetails();

    await waitFor(() => {
      expect(screen.getByText("(1/2)")).toBeInTheDocument();
    });
    expect(invoke).toHaveBeenCalledWith("get_romm_retroachievements", {
      refreshProgression: false,
      romId: remoteOnlyGame.romm_id,
      serverUrl: "https://romm.example",
      token: "saved-token",
    });

    fireEvent.click(screen.getByRole("button", { name: "View all" }));
    expect(screen.getByText("Earned")).toBeInTheDocument();
    expect(screen.getByText("Locked")).toBeInTheDocument();
  });

  it("does not reload ordinary progress for an equivalent game object", async () => {
    invoke.mockImplementation((command) => {
      if (command === "get_config") {
        return { display: { retroachievements_enabled: true } };
      }
      if (command === "get_romm_retroachievements") {
        return [{ id: 101, title: "Earned", unlocked: true }];
      }
      return { display: {} };
    });

    const view = renderDetails();
    await waitFor(() => {
      expect(screen.getByText("(1/1)")).toBeInTheDocument();
    });
    view.rerender(createDetailsElement({ game: { ...remoteOnlyGame } }));

    expect(countAchievementRequests()).toBe(1);
  });
});

describe("GameDetails RetroAchievements refresh", () => {
  afterEach(cleanupGameDetailsTest);

  it("retains the previous rows and marks them after a rejected refresh", async () => {
    let achievementRequests = 0;
    invoke.mockImplementation((command) => {
      if (command === "get_config") {
        return { display: { retroachievements_enabled: true } };
      }
      if (command === "get_romm_retroachievements") {
        achievementRequests += 1;
        if (achievementRequests === 1) {
          return [{ id: 101, title: "Earned", unlocked: true }];
        }
        throw new Error("refresh unavailable");
      }
      return { display: {} };
    });

    renderDetails();
    await waitFor(() => {
      expect(screen.getByText("(1/1)")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Refresh achievement progress" })
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("achievements-previous-result")
      ).toHaveTextContent("refresh unavailable");
    });
    expect(screen.getByText("(1/1)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh achievement progress" })
    ).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "View all" }));
    expect(screen.getByText("Earned")).toBeInTheDocument();
  });
});

describe("GameDetails RetroAchievements errors", () => {
  afterEach(cleanupGameDetailsTest);

  it("shows an initial request failure instead of empty or locked progress", async () => {
    invoke.mockImplementation((command) => {
      if (command === "get_config") {
        return { display: { retroachievements_enabled: true } };
      }
      if (command === "get_romm_retroachievements") {
        throw new Error("RomM authentication failed");
      }
      return { display: {} };
    });

    renderDetails();

    await waitFor(() => {
      expect(screen.getByTestId("achievements-error")).toHaveTextContent(
        "RomM authentication failed"
      );
    });
    expect(screen.queryByTestId("achievements-empty")).not.toBeInTheDocument();
    expect(screen.queryByText(/0\/0/u)).not.toBeInTheDocument();
  });
});

describe("GameDetails RetroAchievements request identity", () => {
  afterEach(cleanupGameDetailsTest);

  it("ignores a pending response when the viewed game changes", async () => {
    const oldRequest = createDeferred();
    const nextGame = {
      ...remoteOnlyGame,
      id: 8,
      name: "Next Cloud Game",
      romm_id: 43,
    };
    invoke.mockImplementation(async (command, args) => {
      if (command === "get_config") {
        return { display: { retroachievements_enabled: true } };
      }
      if (command === "get_romm_retroachievements") {
        if (args?.romId === remoteOnlyGame.romm_id) {
          return await oldRequest.promise;
        }
        return [{ id: 201, title: "Next achievement", unlocked: false }];
      }
      return { display: {} };
    });

    const view = renderDetails();
    await waitFor(() => {
      expect(countAchievementRequests()).toBe(1);
    });
    view.rerender(createDetailsElement({ game: nextGame }));

    await waitFor(() => {
      expect(screen.getByText("(0/1)")).toBeInTheDocument();
    });
    await act(async () => {
      oldRequest.resolve([
        { id: 101, title: "Old achievement", unlocked: true },
      ]);
      await oldRequest.promise;
    });
    expect(screen.queryByText("(1/1)")).not.toBeInTheDocument();
    expect(screen.getByText("(0/1)")).toBeInTheDocument();
  });
});
