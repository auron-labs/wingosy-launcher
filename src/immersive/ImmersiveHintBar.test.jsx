import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ImmersiveHintBar from "./ImmersiveHintBar";
import { MuiTestProvider } from "../test/muiHarness";

afterEach(cleanup);

describe("ImmersiveHintBar controller recovery hints", () => {
  it("uses neutral intent labels and keeps keyboard recovery visible", () => {
    render(
      <MuiTestProvider>
        <ImmersiveHintBar view="library" unsupportedGamepad />
      </MuiTestProvider>,
    );

    expect(screen.getByText("Confirm / Open")).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();
    expect(screen.getByText("Menu")).toBeInTheDocument();
    expect(screen.getByText(/standard\/XInput controller or keyboard/)).toBeInTheDocument();
    expect(screen.queryByText(/^A$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^B$/)).not.toBeInTheDocument();
  });

  it("keeps unsupported recovery status visible when help is hidden", () => {
    render(
      <MuiTestProvider>
        <ImmersiveHintBar view="library" visible={false} unsupportedGamepad />
      </MuiTestProvider>,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Confirm / Open")).not.toBeInTheDocument();
  });
});
