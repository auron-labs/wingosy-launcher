export const SETTINGS_CARD_SX = {
  borderRadius: 3,
  boxSizing: "border-box",
  maxWidth: "100%",
  mb: 3,
  p: 3,
  width: "100%",
};
/** @param {string|null|undefined} dll - Libretro DLL filename. */
export const formatLibretroDllLabel = (dll) => {
  if (dll === null || dll === undefined || dll === "") {
    return "";
  }
  return dll.replace(/_libretro\.dll$/iu, "").replaceAll("_", " ");
};

/** @param {string|number|Date|null|undefined} value - Timestamp to format. */
export const formatSyncTimestamp = (value) => {
  if (value === null || value === undefined || value === "") {
    return "Not reported";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not reported";
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

/** @param {number|null|undefined} value - Game count to format. */
export const formatSyncLibraryCount = (value) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Not reported";
  }
  return `${value.toLocaleString()} games`;
};

/** @param {{downloaded: number, total: number|null, percent: number|null}|null|undefined} progress - Download progress. */
export const formatDownloadLabel = (progress) => {
  if (progress === null || progress === undefined) {
    return "";
  }
  const { downloaded, total, percent } = progress;
  if (total !== null && total > 0) {
    const pct = percent === null ? "" : `${percent}% · `;
    return `${pct}${downloaded} / ${total}`;
  }
  return String(downloaded ?? "");
};

export const UPDATE_PREFERENCE = {
  AUTOMATIC: "automatic",
  CHECK_ONLY: "check",
  OFF: "off",
};
