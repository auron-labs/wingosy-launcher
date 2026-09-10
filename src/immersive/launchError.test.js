import { describe, expect, it } from "vitest";
import { canRetryLaunch, getLaunchErrorPresentation } from "./launchError";

describe("immersive launch errors", () => {
  it("translates a missing core error into plain-language guidance", () => {
    const presentation = getLaunchErrorPresentation(
      "No compatible RetroArch core is installed for ps2",
      "PlayStation 2",
    );

    expect(presentation.message).toBe(
      "This game cannot start because no compatible emulator is installed for PlayStation 2.",
    );
    expect(presentation.guidance).toContain("Settings → Emulators");
    expect(presentation.retryable).toBe(false);
    expect(presentation.message).not.toMatch(/promised|certified|RetroArch/i);
  });

  it("does not offer Retry for a deterministic missing-core failure", () => {
    expect(canRetryLaunch("No compatible RetroArch core is installed for ps2")).toBe(false);
  });

  it("does not offer Retry when no emulator is configured for the platform", () => {
    const presentation = getLaunchErrorPresentation(
      "No emulator configured for platform: snes",
      "Super Nintendo Entertainment System",
    );

    expect(presentation.message).toBe(
      "This game cannot start because no compatible emulator is installed for Super Nintendo Entertainment System.",
    );
    expect(presentation.retryable).toBe(false);
  });

  it("allows Retry for a failure that may succeed on another attempt", () => {
    expect(canRetryLaunch("The emulator closed before it could start")).toBe(true);
  });
});
