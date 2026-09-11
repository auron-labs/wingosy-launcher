import { afterEach, describe, expect, it, vi } from "vitest";

import {
  debugLog,
  installNativeConsoleForwarding,
  isVerboseDebugEnabled,
} from "./debugLog";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe(debugLog, () => {
  it("is disabled unless the debug development mode is set", () => {
    vi.stubEnv("VITE_WINGOSY_DEBUG", "0");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    expect(isVerboseDebugEnabled()).toBeFalsy();
    debugLog("controller", "idle");

    expect(info).not.toHaveBeenCalled();
  });

  it("emits a scoped, structured console message when enabled", () => {
    vi.stubEnv("VITE_WINGOSY_DEBUG", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const details = { index: 1, mapping: "standard" };

    expect(isVerboseDebugEnabled()).toBeTruthy();
    debugLog("controller", "controller connected", details);

    expect(info).toHaveBeenCalledWith(
      "[Wingosy][debug][controller] controller connected",
      details
    );
  });

  it("forwards console output to native logging while preserving browser output", () => {
    const nativeInvoke = vi.fn(async () => Promise.resolve());
    const originalConsole = Object.fromEntries(
      ["log", "info", "debug", "warn", "error"].map((level) => [
        level,
        console[level],
      ])
    );
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    try {
      installNativeConsoleForwarding(nativeInvoke);
      console.info("controller connected", { token: "not-forwarded" });

      expect(info).toHaveBeenCalledWith("controller connected", {
        token: "not-forwarded",
      });
      expect(nativeInvoke).toHaveBeenCalledWith("log_frontend", {
        level: "info",
        message: 'controller connected {"token":"[redacted]"}',
      });
    } finally {
      for (const [level, method] of Object.entries(originalConsole)) {
        console[level] = method;
      }
    }
  });
});
