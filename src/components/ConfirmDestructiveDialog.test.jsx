import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ConfirmDestructiveDialog from "./ConfirmDestructiveDialog";
import { MuiTestProvider } from "../test/muiHarness";

function renderDialog(props = {}) {
  const defaults = {
    open: true,
    title: "Delete Downloaded ROM?",
    message: "This will delete the local ROM file.",
    confirmLabel: "Delete",
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
  };
  return render(
    <MuiTestProvider>
      <ConfirmDestructiveDialog {...defaults} {...props} />
    </MuiTestProvider>
  );
}

afterEach(cleanup);

describe("ConfirmDestructiveDialog", () => {
  it("renders title, message, cancel and confirm actions", () => {
    renderDialog();
    expect(screen.getByText("Delete Downloaded ROM?")).toBeInTheDocument();
    expect(screen.getByText("This will delete the local ROM file.")).toBeInTheDocument();
    expect(screen.getByText("Esc to close")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    renderDialog({ open: false });
    expect(screen.queryByText("Delete Downloaded ROM?")).not.toBeInTheDocument();
  });

  it("marks the confirm action as destructive", () => {
    renderDialog();
    const confirm = screen.getByRole("button", { name: "Delete" });
    expect(confirm).toHaveClass("MuiButton-colorError");
    expect(confirm).toHaveClass("MuiButton-contained");
  });

  it("calls onConfirm when the confirm action is clicked", () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
