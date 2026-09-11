import { describe, expect, it } from "vitest";

import {
  UPDATE_PREFERENCE,
  applyUpdatePreference,
  getUpdatePreference,
} from "./updatePreferences";

describe("update preference compatibility", () => {
  it.each([
    [
      { auto_update_enabled: true, check_on_startup: false },
      UPDATE_PREFERENCE.AUTOMATIC,
    ],
    [
      { auto_update_enabled: false, check_on_startup: true },
      UPDATE_PREFERENCE.CHECK_ONLY,
    ],
    [
      { auto_update_enabled: false, check_on_startup: false },
      UPDATE_PREFERENCE.OFF,
    ],
    [{}, UPDATE_PREFERENCE.OFF],
  ])("derives %s as %s", (updater, expected) => {
    expect(getUpdatePreference(updater)).toBe(expected);
  });

  it("gives automatic updates precedence when both legacy flags are enabled", () => {
    expect(
      getUpdatePreference({ auto_update_enabled: true, check_on_startup: true })
    ).toBe(UPDATE_PREFERENCE.AUTOMATIC);
  });

  it.each([
    [
      UPDATE_PREFERENCE.OFF,
      { auto_update_enabled: false, check_on_startup: false },
    ],
    [
      UPDATE_PREFERENCE.CHECK_ONLY,
      { auto_update_enabled: false, check_on_startup: true },
    ],
    [
      UPDATE_PREFERENCE.AUTOMATIC,
      { auto_update_enabled: true, check_on_startup: true },
    ],
  ])(
    "persists %s without dropping other updater settings",
    (preference, flags) => {
      const config = { updater: { channel: "beta", ...flags } };
      const nextConfig = applyUpdatePreference(config, preference);

      expect(nextConfig).toStrictEqual(config);
      expect(nextConfig).not.toBe(config);
      expect(nextConfig.updater).not.toBe(config.updater);

      const changed = applyUpdatePreference(
        { updater: { channel: "nightly" } },
        preference
      );
      expect(changed.updater).toStrictEqual({ channel: "nightly", ...flags });
    }
  );
});
