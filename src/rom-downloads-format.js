/** @typedef {{downloaded?: number|null, total?: number|null, percent?: number|null}|null|undefined} DownloadProgress */

/** @param {number|null|undefined} value Bytes to format. */
const formatBytes = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/** @param {DownloadProgress} progress Download progress. @returns {string} Formatted download progress. */
export const formatDownloadLabel = (progress) => {
  if (progress === null || progress === undefined) {
    return "";
  }
  const { downloaded, total, percent } = progress;
  if (total !== null && total !== undefined && total > 0) {
    const pct =
      percent === null || percent === undefined ? "" : `${percent}% · `;
    return `${pct}${formatBytes(downloaded)} / ${formatBytes(total)}`;
  }
  return formatBytes(downloaded);
};
