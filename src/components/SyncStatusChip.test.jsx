import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import SyncStatusChip from "./SyncStatusChip";
import { MuiTestProvider } from "../test/muiHarness";

afterEach(cleanup);

describe("SyncStatusChip", () => {
  it("uses the shared labeled and tooltipped treatment for server health", async () => {
    render(
      <MuiTestProvider>
        <SyncStatusChip status="online" serverUrl="https://romm.example" />
      </MuiTestProvider>
    );

    const status = screen.getByRole("status", { name: "RomM status: Connected" });
    expect(status).toHaveTextContent("Connected");
    expect(status).toHaveClass("MuiChip-outlined");

    fireEvent.mouseOver(status);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("https://romm.example");
  });

  it("keeps the details-page sync wording in the same shared pattern", () => {
    render(
      <MuiTestProvider>
        <SyncStatusChip status="downloaded-not-synced" />
      </MuiTestProvider>
    );

    expect(screen.getByRole("status", { name: "Sync status: Downloaded, not synced" })).toHaveTextContent(
      "Downloaded, not synced"
    );
  });
});
