/** @param {string|number|null|undefined} value - Value used in an identity key. */
const normalizeGamePart = (value) =>
  String(value ?? "")
    .trim()
    .replaceAll(/\s+/gu, " ")
    .toLowerCase();

/** @param {{id?: number|string|null, name?: string|null, platform_id?: string|null}} game - Game to identify. */
const gameIdentity = (game) => {
  const name = normalizeGamePart(game?.name);
  if (name === "") {
    return game?.id === null || game?.id === undefined ? null : `id:${game.id}`;
  }

  return `name:${name}|platform:${normalizeGamePart(game?.platform_id)}`;
};

/**
 * @param {Array<{id?: number|string|null, name?: string|null, platform_id?: string|null}>} games - Games to deduplicate.
 */
export const dedupeGames = (games) => {
  const seenIds = new Set();
  const seen = new Set();

  return (Array.isArray(games) ? games : []).filter((game) => {
    const identity = gameIdentity(game);
    const id =
      game?.id === null || game?.id === undefined ? null : String(game.id);
    if (id !== null && seenIds.has(id)) {
      return false;
    }
    if (identity !== null && seen.has(identity)) {
      return false;
    }
    if (id !== null) {
      seenIds.add(id);
    }
    if (identity === null) {
      return true;
    }
    seen.add(identity);
    return true;
  });
};
