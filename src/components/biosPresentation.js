function platformIdFromEntry(entry) {
  if (Array.isArray(entry)) return entry[0]?.id;
  return entry?.id;
}

export function getBiosTotals(items) {
  const firmware = Array.isArray(items) ? items : [];
  const unavailable = firmware.filter((item) => item.missing_from_fs).length;
  const availableItems = firmware.filter((item) => !item.missing_from_fs);
  const downloaded = firmware.filter((item) => item.is_downloaded).length;

  return {
    listed: firmware.length,
    available: availableItems.length,
    downloaded,
    missing: availableItems.filter((item) => !item.is_downloaded).length,
    unavailable,
  };
}

export function getBiosGroupTotals(items) {
  return getBiosTotals(items);
}

export function orderBiosGroupsByLibraryRelevance(groups, libraryPlatforms = []) {
  const libraryOrder = new Map();
  libraryPlatforms.forEach((entry, index) => {
    const platform = Array.isArray(entry) ? entry[0] : entry;
    const platformId = platformIdFromEntry(entry);
    if (platformId) libraryOrder.set(platformId, index);
    if (platform?.name) libraryOrder.set(platform.name.toLowerCase(), index);
  });

  return [...groups].sort((left, right) => {
    const leftOrder = libraryOrder.get(left.slug) ?? libraryOrder.get(left.name?.toLowerCase());
    const rightOrder = libraryOrder.get(right.slug) ?? libraryOrder.get(right.name?.toLowerCase());
    const leftRank = leftOrder === undefined ? Number.POSITIVE_INFINITY : leftOrder;
    const rightRank = rightOrder === undefined ? Number.POSITIVE_INFINITY : rightOrder;

    return leftRank - rightRank || left.name.localeCompare(right.name);
  });
}
