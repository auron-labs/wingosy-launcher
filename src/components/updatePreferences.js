export const UPDATE_PREFERENCE = Object.freeze({
  AUTOMATIC: "automatic",
  CHECK_ONLY: "check-only",
  OFF: "off",
});

export function getUpdatePreference(updater = {}) {
  if (updater.auto_update_enabled) {
    return UPDATE_PREFERENCE.AUTOMATIC;
  }
  if (updater.check_on_startup) {
    return UPDATE_PREFERENCE.CHECK_ONLY;
  }
  return UPDATE_PREFERENCE.OFF;
}

export function applyUpdatePreference(config, preference) {
  const nextPreference = Object.values(UPDATE_PREFERENCE).includes(preference)
    ? preference
    : UPDATE_PREFERENCE.OFF;

  return {
    ...config,
    updater: {
      ...(config && config.updater),
      auto_update_enabled: nextPreference === UPDATE_PREFERENCE.AUTOMATIC,
      check_on_startup: nextPreference !== UPDATE_PREFERENCE.OFF,
    },
  };
}
