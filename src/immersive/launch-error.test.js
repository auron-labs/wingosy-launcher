import { describe, expect, it } from "vitest";

import { canRetryLaunch, getLaunchErrorPresentation } from "./launch-error";

describe("immersive launch errors", () => {
  it("translates a missing core error into plain-language guidance", () => {
    const presentation = getLaunchErrorPresentation(
      "No compatible RetroArch core is installed for ps2",
      "PlayStation 2"
    );

    expect(presentation.message).toBe(
      "This game cannot start because no compatible emulator is installed for PlayStation 2."
    );
    expect(presentation.guidance).toContain("Settings → Emulators");
    expect(presentation.kind).toBe("missing-emulator");
    expect(presentation.retryable).toBeFalsy();
    expect(presentation.message).not.toMatch(/promised|certified|RetroArch/iu);
  });

  it("does not offer Retry for a deterministic missing-core failure", () => {
    expect(
      canRetryLaunch("No compatible RetroArch core is installed for ps2")
    ).toBeFalsy();
  });

  it("does not offer Retry when no emulator is configured for the platform", () => {
    const presentation = getLaunchErrorPresentation(
      "No emulator configured for platform: snes",
      "Super Nintendo Entertainment System"
    );

    expect(presentation.message).toBe(
      "This game cannot start because no compatible emulator is installed for Super Nintendo Entertainment System."
    );
    expect(presentation.retryable).toBeFalsy();
  });

  it("allows Retry for a failure that may succeed on another attempt", () => {
    expect(
      canRetryLaunch("The emulator closed before it could start")
    ).toBeTruthy();
  });

  it("classifies unrelated launch failures without relying on presentation copy", () => {
    expect(
      getLaunchErrorPresentation("The emulator closed before it could start")
        .kind
    ).toBe("other");
  });
});
