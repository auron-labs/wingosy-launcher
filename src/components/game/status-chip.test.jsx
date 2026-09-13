import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MuiTestProvider } from "../../test/mui-harness";
import StatusChip from "./status-chip";

describe(StatusChip, () => {
  afterEach(cleanup);

  it("uses the same compact outlined treatment for status badges", () => {
    const { container } = render(
      <MuiTestProvider>
        <StatusChip label="NES" />
        <StatusChip label="RomM" />
      </MuiTestProvider>
    );

    const chips = container.querySelectorAll(".MuiChip-root");
    expect(chips).toHaveLength(2);
    for (const chip of chips) {
      expect(chip).toHaveClass("MuiChip-outlined");
      expect(chip).toHaveClass("MuiChip-sizeSmall");
    }
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

    await expect(screen.findByRole("tooltip")).resolves.toHaveTextContent(
      "has not been synchronized with RomM"
    );
  });
});
