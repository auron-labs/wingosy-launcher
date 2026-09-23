import { convertFileSrc } from "@tauri-apps/api/core";

/** @typedef {import("./game-details-types").GameDetailsStatus} GameDetailsStatus */

const LOCAL_PATH_PATTERN = /^[a-zA-Z]:/u;
const RETRYABLE_SAVE_ERROR =
  /(?:(?:^|:\s)(?:error sending request|request or response body error|error decoding response body)\b|\bHTTP(?: status [^(]+)?\s*\(?(?:408|429|5\d{2})\b|\breturned\s+(?:408|429|5\d{2})\b)/iu;
const SAVE_CONFLICT_ERROR =
  /(?:409 Conflict|newer save since your last sync|save conflict|newer save after this play session)/iu;

/** @param {string|null|undefined} path File path or URL to inspect. */
export const isLocalPath = (path) =>
  path !== null &&
  path !== undefined &&
  (LOCAL_PATH_PATTERN.test(path) ||
    path.startsWith("\\") ||
    path.startsWith("/"));

/** @param {string|null|undefined} path Cover path or URL to convert. */
export const getCoverSrc = (path) => {
  if (path === null || path === undefined || path === "") {
    return null;
  }
  return isLocalPath(path) ? convertFileSrc(path) : path;
};

/** @param {string|null|undefined} url Media path or URL to convert. */
export const getMediaSrc = (url) => {
  if (url === null || url === undefined || url === "") {
    return null;
  }
  return isLocalPath(url) ? convertFileSrc(url) : url;
};

/** @param {unknown} error Error value to format for display. */
export const getErrorMessage = (error) => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

/**
 * @param {unknown} error Error value from save synchronization.
 * @param {(() => Promise<void>)} [retry] Retry callback for transient failures.
 * @returns {GameDetailsStatus} User-facing save synchronization status.
 */
export const getSaveSyncErrorStatus = (error, retry) => {
  const message = getErrorMessage(error);
  if (SAVE_CONFLICT_ERROR.test(message)) {
    return {
      conflict: true,
      message:
        "The local and cloud saves have both changed. Choose which copy to keep active; Wingosy can preserve the other as a backup.",
      type: "error",
    };
  }
  return {
    message,
    retry: retry && RETRYABLE_SAVE_ERROR.test(message) ? retry : undefined,
    type: "error",
  };
};

/** @param {string|Date|null|undefined} value Last-played timestamp to format. */
export const formatLastPlayed = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

/** @typedef {import("./game-details-types").GameDetailsSwitchContentStatus} GameDetailsSwitchContentStatus */

/** @param {GameDetailsSwitchContentStatus|null|undefined} status Read-only Switch content status. @returns {string|null} User-facing status label, or null when unknown. */
export const getSwitchContentStatusLabel = (status) => {
  if (status?.status === "current") {
    return null;
  }
  if (status?.status === "missing") {
    return "Wingosy update & DLC files are missing";
  }
  if (status?.status === "changed") {
    return "Update & DLC files need re-syncing";
  }
  return null;
};

/** @param {string|undefined} stage Launch progress stage. */
export const launchStageLabel = (stage) => {
  /** @type {Record<string, string>} */
  const labels = {
    bios_preparation: "Preparing BIOS...",
    completion: "Launch complete",
    downloading: "Downloading ROM...",
    failure: "Launch failed",
    finalizing: "Finalizing local copy...",
    launching: "Launching emulator...",
    resolving: "Resolving RomM session...",
    running: "Emulator running",
    save_sync: "Synchronizing saves...",
    validating: "Validating ROM...",
  };
  return stage !== undefined && labels[stage] !== undefined
    ? labels[stage]
    : "Preparing game...";
};
