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
          retroAchievementsEnabled={false}
          onOpenIntegrations={() => {
            onOpenIntegrations();
          }}
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
          gameName="Cloud Game"
          retroAchievementsEnabled
          achievements={[{ id: 1, title: "First achievement", unlocked: true }]}
        />
      </MuiTestProvider>
    );

    expect(screen.getByText("(1/1)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View all" })
    ).toBeInTheDocument();
  });
});
