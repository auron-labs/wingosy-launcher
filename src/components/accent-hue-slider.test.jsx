import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MuiTestProvider } from "../test/muiHarness";
import AccentHueSlider from "./AccentHueSlider";

describe("Accent hue preview", () => {
  afterEach(() => {
    cleanup();
    clearMocks();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("batches dragging and follows saved hues without replacing the input", async () => {
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
    });
    const requestFrame = vi.spyOn(globalThis, "requestAnimationFrame");
    const ipc = vi.fn(
      /** @param {string} command Native command. */
      (command) =>
        command === "get_config" ? { display: { theme: "Dark" } } : null
    );
    mockIPC(ipc);
    /** @type {import("vitest").Mock<(hue: number|null) => void>} */
    const setAccentHue = vi.fn();
    const view = render(
      <MuiTestProvider>
        <AccentHueSlider accentHue={10} setAccentHue={setAccentHue} />
      </MuiTestProvider>
    );
    const slider = screen.getByRole("slider");
    const track = slider.closest(".MuiSlider-root");
    if (track === null) {
      throw new Error("Accent slider track is missing");
    }
    // jsdom has no pointer capture; MUI also tracks dragging on document.
    track.hasPointerCapture = () => false;
    vi.spyOn(track, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 360, 24)
    );
    act(() => {
      slider.focus();
    });
    fireEvent.pointerDown(track, {
      button: 0,
      buttons: 1,
      clientX: 30,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.pointerMove(document, {
      buttons: 1,
      clientX: 120,
      pointerId: 1,
      pointerType: "mouse",
    });
    expect(requestFrame).toHaveBeenCalledOnce();
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(screen.getByTestId("accent-hue-value")).toHaveTextContent("120°");
    fireEvent.pointerUp(document, { pointerId: 1, pointerType: "mouse" });
    await waitFor(() => {
      expect(ipc).toHaveBeenCalledWith("save_config", {
        config: { display: { accent_hue: 120, theme: "Dark" } },
      });
    });
    view.rerender(
      <MuiTestProvider>
        <AccentHueSlider accentHue={65} setAccentHue={setAccentHue} />
      </MuiTestProvider>
    );
    expect(document.activeElement).toBe(slider);
    expect(screen.getByTestId("accent-hue-value")).toHaveTextContent("65°");
  });
});
