import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import GameScreenshotsSection from "./GameScreenshotsSection";
import { MuiTestProvider } from "../../test/muiHarness";

afterEach(cleanup);

describe("GameScreenshotsSection", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "View screenshot 1 larger" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next screenshot" })).toBeInTheDocument();
    expect(screen.getByText("Esc")).toBeInTheDocument();
    expect(screen.getByText("← / →")).toBeInTheDocument();
  });
});
