export function formatStorageBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) {
    return "Unknown size";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 ** 2) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  if (value < 1024 ** 3) {
    return `${(value / 1024 ** 2).toFixed(1)} MB`;
  }
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}

export function formatOptionalStorageBytes(
  bytes,
  unknownLabel = "Not reported"
) {
  if (bytes === null || bytes === undefined) {
    return unknownLabel;
  }
  return formatStorageBytes(bytes);
}
