/** @param {string} section Section identifier. @returns {string} Shelf label. */
export const getShelfLabel = (section) => {
  switch (section) {
    case "favorites": {
      return "Favorites";
    }
    case "recent": {
      return "Recent";
    }
    default: {
      return "All games";
    }
  }
};
