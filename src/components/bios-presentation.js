/** @typedef {import("./bios-types").BiosFirmware} BiosFirmware */
/** @typedef {import("./bios-types").BiosGroup} BiosGroup */
/** @typedef {import("./bios-types").LibraryPlatform} LibraryPlatform */
/** @typedef {import("./bios-types").LibraryPlatformEntry} LibraryPlatformEntry */
/** @typedef {import("./bios-types").BiosTotals} BiosTotals */

/** @param {LibraryPlatformEntry} entry Platform entry. @returns {entry is [LibraryPlatform, number]} Whether the entry is a platform tuple. */
const isPlatformTuple = (entry) => Array.isArray(entry) && entry.length === 2;

/** @param {LibraryPlatformEntry} entry Platform entry to inspect. */
const platformIdFromEntry = (entry) => {
  const platform = isPlatformTuple(entry) ? entry[0] : entry;
  return platform?.id;
};

/**
 * @param {Array<Pick<BiosFirmware, "is_downloaded"|"missing_from_fs">>} items Firmware entries to total.
 * @returns {BiosTotals} Calculated firmware totals.
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

/** @param {BiosFirmware[]} items Firmware entries to total. */
export const getBiosGroupTotals = (items) => getBiosTotals(items);

/**
 * @param {BiosGroup[]} groups Firmware groups to annotate.
 * @param {LibraryPlatformEntry[]} [libraryPlatforms] Available library platforms.
 */
export const orderBiosGroupsByLibraryRelevance = (
  groups,
  libraryPlatforms = []
) => {
  /** @type {Map<string|number, number>} */
  const libraryOrder = new Map();
  for (const [index, entry] of libraryPlatforms.entries()) {
    const platform = isPlatformTuple(entry) ? entry[0] : entry;
    const platformId = platformIdFromEntry(entry);
    if (platformId !== undefined && platformId !== null) {
      libraryOrder.set(platformId, index);
    }
    if (platform?.name !== undefined && platform.name !== "") {
      libraryOrder.set(platform.name.toLowerCase(), index);
    }
  }

  return groups.toSorted((left, right) => {
    const leftOrder =
      libraryOrder.get(left.slug) ?? libraryOrder.get(left.name.toLowerCase());
    const rightOrder =
      libraryOrder.get(right.slug) ??
      libraryOrder.get(right.name.toLowerCase());
    const leftRank = leftOrder ?? Number.POSITIVE_INFINITY;
    const rightRank = rightOrder ?? Number.POSITIVE_INFINITY;

    return leftRank - rightRank || left.name.localeCompare(right.name);
  });
};
