/** @typedef {import("./bios-types").BiosFirmware} BiosFirmware */
/** @typedef {import("./bios-types").BiosGroup} BiosGroup */
/** @typedef {import("./bios-types").LibraryPlatform} LibraryPlatform */
/** @typedef {import("./bios-types").LibraryPlatformEntry} LibraryPlatformEntry */
/** @typedef {import("./bios-types").BiosTotals} BiosTotals */

/** @param {LibraryPlatformEntry} entry */
const platformIdFromEntry = (entry) => {
  const platform = Array.isArray(entry) ? entry[0] : entry;
  return platform?.id;
};

/**
 * @param {BiosFirmware[]} items
 * @returns {BiosTotals}
 */
export const getBiosTotals = (items) => {
  const firmware = Array.isArray(items) ? items : [];
  const unavailable = firmware.filter((item) => item.missing_from_fs).length;
  const availableItems = firmware.filter((item) => !item.missing_from_fs);
  const downloaded = firmware.filter((item) => item.is_downloaded).length;

  return {
    available: availableItems.length,
    downloaded,
    listed: firmware.length,
    missing: availableItems.filter((item) => !item.is_downloaded).length,
    unavailable,
  };
};

/** @param {BiosFirmware[]} items */
export const getBiosGroupTotals = (items) => getBiosTotals(items);

/**
 * @param {BiosGroup[]} groups
 * @param {LibraryPlatformEntry[]} [libraryPlatforms]
 */
export const orderBiosGroupsByLibraryRelevance = (
  groups,
  libraryPlatforms = []
) => {
  const libraryOrder = new Map();
  for (const [index, entry] of libraryPlatforms.entries()) {
    const platform = Array.isArray(entry) ? entry[0] : entry;
    const platformId = platformIdFromEntry(entry);
    if (platformId !== undefined && platformId !== null) {
      libraryOrder.set(platformId, index);
    }
    if (platform?.name) {
      libraryOrder.set(platform.name.toLowerCase(), index);
    }
  }

  return groups.toSorted((left, right) => {
    const leftOrder =
      libraryOrder.get(left.slug) ?? libraryOrder.get(left.name.toLowerCase());
    const rightOrder =
      libraryOrder.get(right.slug) ??
      libraryOrder.get(right.name.toLowerCase());
    const leftRank =
      leftOrder === undefined ? Number.POSITIVE_INFINITY : leftOrder;
    const rightRank =
      rightOrder === undefined ? Number.POSITIVE_INFINITY : rightOrder;

    return leftRank - rightRank || left.name.localeCompare(right.name);
  });
};
