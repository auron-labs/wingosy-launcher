import { afterEach, describe, expect, it, vi } from "vitest";

import { isTauri, mousedownTargetElement } from "./isTauri";

describe("Tauri runtime markers and drag targets", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("recognizes either IPC marker and normalizes titlebar text nodes", () => {
    vi.stubGlobal("__TAURI__", null);
    vi.stubGlobal("__TAURI_INTERNALS__", null);
    vi.stubGlobal("isTauri", false);
    expect(isTauri()).toBeFalsy();

    vi.stubGlobal("__TAURI_INTERNALS__", {});
    expect(isTauri()).toBeTruthy();

    vi.stubGlobal("__TAURI_INTERNALS__", null);
    vi.stubGlobal("__TAURI__", {});
    expect(isTauri()).toBeTruthy();

    const title = document.createElement("span");
    title.textContent = "Wingosy";
    expect(mousedownTargetElement(title.firstChild)).toBe(title);
    expect(mousedownTargetElement(null)).toBeNull();
  });
});
