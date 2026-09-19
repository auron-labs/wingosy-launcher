import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MuiTestProvider } from "../../test/mui-harness";
import GameAchievementsSection from "./game-achievements-section";

describe(GameAchievementsSection, () => {
  afterEach(cleanup);

  it("treats disabled RetroAchievements as an explanation instead of locked tiles", () => {
    const onOpenIntegrations = vi.fn();
    render(
      <MuiTestProvider>
        <GameAchievementsSection
          gameName="Cloud Game"
          onOpenIntegrations={() => {
            onOpenIntegrations();
          }}
          retroAchievementsEnabled={false}
        />
      </MuiTestProvider>
    );

    expect(
      screen.getByTestId("achievements-disabled-empty")
    ).toBeInTheDocument();
    const integrationsLink = screen.getByRole("link", {
      name: "Enable it in Settings → Integrations.",
    });
    expect(integrationsLink).toHaveAttribute("href", "#settings/integrations");
    fireEvent.click(integrationsLink);
    expect(onOpenIntegrations).toHaveBeenCalledOnce();
  });

  it("does not show achievement progress or a full-list action while disabled", () => {
    render(
      <MuiTestProvider>
        <GameAchievementsSection
          gameName="Cloud Game"
          retroAchievementsEnabled={false}
        />
      </MuiTestProvider>
    );

    expect(screen.queryByText(/0\/0/u)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "View all" })
    ).not.toBeInTheDocument();
  });

  it("shows progress and the full-list action only when achievement data exists", () => {
    render(
      <MuiTestProvider>
        <GameAchievementsSection
          achievements={[{ id: 1, title: "First achievement", unlocked: true }]}
          gameName="Cloud Game"
          retroAchievementsEnabled
        />
      </MuiTestProvider>
    );

    expect(screen.getByText("(1/1)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View all" })
    ).toBeInTheDocument();
  });
});

describe("GameAchievementsSection presentation state", () => {
  afterEach(cleanup);

  it("shows earned points, determinate completion, badges, and hardcore state", () => {
    render(
      <MuiTestProvider>
        <GameAchievementsSection
          achievements={[
            {
              badge_url: "https://example.test/earned.png",
              id: 1,
              points: 10,
              title: "Earned achievement",
              unlocked: true,
              unlocked_hardcore: true,
            },
            {
              badge_url_lock: "https://example.test/locked.png",
              id: 2,
              points: 20,
              title: "Locked achievement",
              unlocked: false,
            },
          ]}
          gameName="Cloud Game"
          retroAchievementsEnabled
        />
      </MuiTestProvider>
    );

    expect(screen.getByText("10/30 pts")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Achievement completion" })
    ).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText("HC")).toBeInTheDocument();
    expect(
      screen.getByTestId("achievement-tile-1").querySelector("img")
    ).toHaveAttribute("src", "https://example.test/earned.png");
    expect(
      screen.getByTestId("achievement-tile-2").querySelector("img")
    ).toHaveAttribute("src", "https://example.test/locked.png");
  });
});

describe("GameAchievementsSection request feedback", () => {
  afterEach(cleanup);

  it("shows loading and keeps refresh busy while a refresh is active", () => {
    render(
      <MuiTestProvider>
        <GameAchievementsSection
          gameName="Cloud Game"
          loading
          onRefresh={vi.fn(async () => {
            await Promise.resolve();
          })}
          retroAchievementsEnabled
          refreshing
        />
      </MuiTestProvider>
    );

    expect(screen.getByTestId("achievements-loading")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh achievement progress" })
    ).toBeDisabled();
    expect(screen.getByText("Refreshing…")).toBeInTheDocument();
  });

  it("labels retained rows when refresh fails", () => {
    render(
      <MuiTestProvider>
        <GameAchievementsSection
          achievements={[
            { id: 1, points: 10, title: "Earned", unlocked: true },
          ]}
          error="Refresh unavailable"
          gameName="Cloud Game"
          onRefresh={vi.fn(async () => {
            await Promise.resolve();
          })}
          previousResult
          retroAchievementsEnabled
        />
      </MuiTestProvider>
    );

    const feedback = screen.getByTestId("achievements-previous-result");
    expect(feedback).toHaveTextContent("Showing previous results");
    expect(feedback).toHaveTextContent("Refresh unavailable");
    expect(screen.getByTestId("achievement-tile-1")).toBeInTheDocument();
  });
});
