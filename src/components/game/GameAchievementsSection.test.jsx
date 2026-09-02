import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import GameAchievementsSection from "./GameAchievementsSection";
import { MuiTestProvider } from "../../test/muiHarness";

afterEach(cleanup);

describe("GameAchievementsSection", () => {
  it("treats disabled RetroAchievements as an explanation instead of locked tiles", () => {
    const onOpenIntegrations = vi.fn();
    render(
      <MuiTestProvider>
        <GameAchievementsSection
          gameName="Cloud Game"
          retroAchievementsEnabled={false}
          onOpenIntegrations={onOpenIntegrations}
        />
      </MuiTestProvider>
    );

    expect(screen.getByTestId("achievements-disabled-empty")).toBeInTheDocument();
    const integrationsLink = screen.getByRole("link", {
      name: "Enable it in Settings → Integrations.",
    });
    expect(integrationsLink).toHaveAttribute("href", "#settings/integrations");
    fireEvent.click(integrationsLink);
    expect(onOpenIntegrations).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/0\/0/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View all" })).not.toBeInTheDocument();
  });

  it("shows progress and the full-list action only when achievement data exists", () => {
    render(
      <MuiTestProvider>
        <GameAchievementsSection
          gameName="Cloud Game"
          retroAchievementsEnabled
          achievements={[{ id: 1, unlocked: true }]}
        />
      </MuiTestProvider>
    );

    expect(screen.getByText("(1/1)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View all" })).toBeInTheDocument();
  });
});
