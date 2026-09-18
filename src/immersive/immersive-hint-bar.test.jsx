import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MuiTestProvider } from "../test/mui-harness";
import ImmersiveHintBar from "./immersive-hint-bar";

describe("ImmersiveHintBar controller recovery hints", () => {
  afterEach(cleanup);

  it("uses neutral intent labels and keeps keyboard recovery visible", () => {
    render(
      <MuiTestProvider>
        <ImmersiveHintBar view="library" unsupportedGamepad />
      </MuiTestProvider>
    );

    expect(screen.getByText("Confirm / Open")).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();
    expect(screen.getByText("Menu")).toBeInTheDocument();
    expect(screen.getByText("F11")).toBeInTheDocument();
    expect(screen.getByText("Fullscreen")).toBeInTheDocument();
  });

  it("explains controller recovery without legacy button labels", () => {
    render(
      <MuiTestProvider>
        <ImmersiveHintBar view="library" unsupportedGamepad />
      </MuiTestProvider>
    );

    expect(
      screen.getByText(/standard\/XInput controller or keyboard/u)
    ).toBeInTheDocument();
    expect(screen.queryByText(/^A$/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/^B$/u)).not.toBeInTheDocument();
  });

  it("keeps unsupported recovery status visible when help is hidden", () => {
    render(
      <MuiTestProvider>
        <ImmersiveHintBar view="library" visible={false} unsupportedGamepad />
      </MuiTestProvider>
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Confirm / Open")).not.toBeInTheDocument();
  });
});
