import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MuiTestProvider } from "../../test/mui-harness";
import GameScreenshotsSection from "./game-screenshots-section";

describe(GameScreenshotsSection, () => {
  afterEach(cleanup);

  it("balances screenshots into equal cards with a larger-view action", async () => {
    render(
      <MuiTestProvider>
        <GameScreenshotsSection
          urls={["/screenshots/one.png", "/screenshots/two.png"]}
          getMediaSrc={(url) => url}
        />
      </MuiTestProvider>
    );

    expect(screen.getByTestId("game-screenshots-grid")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "View screenshot 1 larger" })
    );

    await expect(screen.findByRole("dialog")).resolves.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Next screenshot" })
    ).toBeInTheDocument();
    expect(screen.getByText("Esc")).toBeInTheDocument();
    expect(screen.getByText("← / →")).toBeInTheDocument();
  });
});
