export const UPDATE_PREFERENCE = Object.freeze({
  OFF: "off",
  CHECK_ONLY: "check-only",
  AUTOMATIC: "automatic",
});

export function getUpdatePreference(updater = {}) {
  if (updater.auto_update_enabled) return UPDATE_PREFERENCE.AUTOMATIC;
  if (updater.check_on_startup) return UPDATE_PREFERENCE.CHECK_ONLY;
  return UPDATE_PREFERENCE.OFF;
}

export function applyUpdatePreference(config, preference) {
  const nextPreference = Object.values(UPDATE_PREFERENCE).includes(preference)
    ? preference
    : UPDATE_PREFERENCE.OFF;

  return {
    ...(config || {}),
    updater: {
      ...((config && config.updater) || {}),
      check_on_startup: nextPreference !== UPDATE_PREFERENCE.OFF,
      auto_update_enabled: nextPreference === UPDATE_PREFERENCE.AUTOMATIC,
    },
  };
}
