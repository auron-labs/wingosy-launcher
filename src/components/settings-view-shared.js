export const SETTINGS_CARD_SX = {
  borderRadius: 3,
  boxSizing: "border-box",
  maxWidth: "100%",
  mb: 3,
  p: 3,
  width: "100%",
};
export const SETTINGS_CARD_GRADIENT_SX = {
  ...SETTINGS_CARD_SX,
  background: "linear-gradient(135deg, #1e1e26 0%, #252530 100%)",
};

export function formatLibretroDllLabel(dll) {
  if (!dll || typeof dll !== "string") {
    return "";
  }
  return dll.replace(/_libretro\.dll$/iu, "").replaceAll("_", " ");
}

export function formatSyncTimestamp(value) {
  if (!value) {
    return "Not reported";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not reported";
  }
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatSyncLibraryCount(value) {
  return Number.isFinite(value) ? `${value.toLocaleString()} games` : "Not reported";
}

export function formatDownloadLabel(progress) {
  if (!progress) {
    return "";
  }
  const { downloaded, total, percent } = progress;
  if (total != null && total > 0) {
    const pct = percent == null ? "" : `${percent}% · `;
    return `${pct}${downloaded} / ${total}`;
  }
  return String(downloaded ?? "");
}

export const UPDATE_PREFERENCE = { OFF: "off", CHECK_ONLY: "check", AUTOMATIC: "automatic" };
