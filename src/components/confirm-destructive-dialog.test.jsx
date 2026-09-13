import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MuiTestProvider } from "../test/mui-harness";
import ConfirmDestructiveDialog from "./confirm-destructive-dialog";

/** @param {Partial<import("react").ComponentProps<typeof ConfirmDestructiveDialog>>} [props] Overrides for the open deletion dialog. */
const renderDialog = (props = {}) => {
  const defaults = {
    confirmLabel: "Delete",
    message: "This will delete the local ROM file.",
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    open: true,
    title: "Delete Downloaded ROM?",
  };
  return render(
    <MuiTestProvider>
      <ConfirmDestructiveDialog {...defaults} {...props} />
    </MuiTestProvider>
  );
};

describe(ConfirmDestructiveDialog, () => {
  afterEach(cleanup);

  it("renders title, message, cancel and confirm actions", () => {
    renderDialog();
    expect(screen.getByText("Delete Downloaded ROM?")).toBeInTheDocument();
    expect(
      screen.getByText("This will delete the local ROM file.")
    ).toBeInTheDocument();
    expect(screen.getByText("Esc to close")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    renderDialog({ open: false });
    expect(
      screen.queryByText("Delete Downloaded ROM?")
    ).not.toBeInTheDocument();
  });

  it("marks the confirm action as destructive", () => {
    renderDialog();
    const confirm = screen.getByRole("button", { name: "Delete" });
    expect(confirm).toHaveClass("MuiButton-colorError");
    expect(confirm).toHaveClass("MuiButton-contained");
  });

  it("calls onConfirm when the confirm action is clicked", () => {
    /** @type {import("vitest").Mock<() => void>} */
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when Cancel is clicked", () => {
    /** @type {import("vitest").Mock<() => void>} */
    const onCancel = vi.fn();
    renderDialog({ onCancel });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
