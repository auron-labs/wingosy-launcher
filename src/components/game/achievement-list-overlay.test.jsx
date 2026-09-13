import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MuiTestProvider } from "../../test/mui-harness";
import AchievementListOverlay from "./achievement-list-overlay";

const renderOverlay = (props = {}) =>
  render(
    <MuiTestProvider>
      <AchievementListOverlay
        open
        onClose={() => {}}
        gameTitle="Cloud Game"
        retroAchievementsEnabled={false}
        {...props}
      />
    </MuiTestProvider>
  );

describe("AchievementListOverlay empty state", () => {
  afterEach(cleanup);

  it("centers disabled-state guidance and keeps one close affordance", () => {
    renderOverlay();

    expect(screen.getByTestId("achievement-empty-state")).toBeInTheDocument();
    expect(
      screen.getByText("RetroAchievements is turned off")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open Integrations settings" })
    ).toBeInTheDocument();
    expect(screen.getByText("Esc to close")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1);
  });

  it("does not render legacy back or progress controls in the empty state", () => {
    renderOverlay();

    expect(
      screen.queryByRole("button", { name: "Back" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/0\/0/u)).not.toBeInTheDocument();
  });

  it("routes both integrations actions to the supplied settings navigation", () => {
    const onOpenIntegrations = vi.fn();
    renderOverlay({ onOpenIntegrations });

    fireEvent.click(
      screen.getByRole("link", { name: "Settings → Integrations" })
    );
    fireEvent.click(
      screen.getByRole("link", { name: "Open Integrations settings" })
    );

    expect(onOpenIntegrations).toHaveBeenCalledTimes(2);
  });

  it("also composes an empty state when the enabled integration has no data", () => {
    renderOverlay({ retroAchievementsEnabled: true });

    expect(screen.getByText("No achievements yet")).toBeInTheDocument();
    expect(screen.queryByText(/0\/0/u)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1);
  });
});
