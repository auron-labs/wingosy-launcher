export const UPDATE_PREFERENCE = Object.freeze({
  AUTOMATIC: "automatic",
  CHECK_ONLY: "check-only",
  OFF: "off",
});

/** @typedef {{auto_update_enabled?: boolean, check_on_startup?: boolean, channel?: "stable"|"beta"|"nightly"}} UpdaterConfig */
/** @typedef {"automatic"|"check-only"|"off"} UpdatePreference */

/** @param {UpdaterConfig} updater - Persisted updater settings. */
export const getUpdatePreference = (updater = {}) => {
  if (updater.auto_update_enabled === true) {
    return UPDATE_PREFERENCE.AUTOMATIC;
  }
  if (updater.check_on_startup === true) {
    return UPDATE_PREFERENCE.CHECK_ONLY;
  }
  return UPDATE_PREFERENCE.OFF;
};

/** @param {{updater?: UpdaterConfig}} config - Application configuration. @param {UpdatePreference} preference - Requested preference. */
export const applyUpdatePreference = (config, preference) => {
  const nextPreference =
    preference === UPDATE_PREFERENCE.AUTOMATIC ||
    preference === UPDATE_PREFERENCE.CHECK_ONLY ||
    preference === UPDATE_PREFERENCE.OFF
      ? preference
      : UPDATE_PREFERENCE.OFF;

  return {
    ...config,
    updater: {
      ...config.updater,
      auto_update_enabled: nextPreference === UPDATE_PREFERENCE.AUTOMATIC,
      check_on_startup: nextPreference !== UPDATE_PREFERENCE.OFF,
    },
  };
};
