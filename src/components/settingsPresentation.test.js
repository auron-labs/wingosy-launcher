import { describe, expect, it } from "vitest";

import {
  formatOptionalStorageBytes,
  formatStorageBytes,
} from "./settingsPresentation";

describe("settings presentation", () => {
  it("formats storage sizes with readable units", () => {
    expect(formatStorageBytes(0)).toBe("0 B");
    expect(formatStorageBytes(1024 ** 2)).toBe("1.0 MB");
    expect(formatStorageBytes(1024 ** 3)).toBe("1.00 GB");
  });

  it("does not turn unavailable metadata into a misleading zero", () => {
    expect(formatOptionalStorageBytes(null)).toBe("Not reported");
    expect(formatOptionalStorageBytes(undefined, "Size unavailable")).toBe(
      "Size unavailable"
    );
  });
});
