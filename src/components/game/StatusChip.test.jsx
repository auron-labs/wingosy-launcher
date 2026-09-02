import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import StatusChip from "./StatusChip";
import { MuiTestProvider } from "../../test/muiHarness";

afterEach(cleanup);

describe("StatusChip", () => {
  it("uses the same compact outlined treatment for status badges", () => {
    const { container } = render(
      <MuiTestProvider>
        <StatusChip label="NES" />
        <StatusChip label="RomM" />
      </MuiTestProvider>
    );

    const chips = container.querySelectorAll(".MuiChip-root");
    expect(chips).toHaveLength(2);
    chips.forEach((chip) => {
      expect(chip).toHaveClass("MuiChip-outlined");
      expect(chip).toHaveClass("MuiChip-sizeSmall");
    });
  });

  it("provides an explanation tooltip for a sync warning", async () => {
    render(
      <MuiTestProvider>
        <StatusChip
          label="Downloaded, not synced"
          helpText="This ROM is stored locally, but its download has not been synchronized with RomM."
        />
      </MuiTestProvider>
    );

    fireEvent.mouseOver(screen.getByText("Downloaded, not synced"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "has not been synchronized with RomM"
    );
  });
});
