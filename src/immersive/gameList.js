function normalizeGamePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function gameIdentity(game) {
  const name = normalizeGamePart(game?.name);
  if (!name) return game?.id == null ? null : `id:${game.id}`;

  return `name:${name}|platform:${normalizeGamePart(game?.platform_id)}`;
}

export function dedupeGames(games) {
  const seenIds = new Set();
  const seen = new Set();

  return (Array.isArray(games) ? games : []).filter((game) => {
    const identity = gameIdentity(game);
    const id = game?.id == null ? null : String(game.id);
    if (id && seenIds.has(id)) return false;
    if (identity && seen.has(identity)) return false;
    if (id) seenIds.add(id);
    if (!identity) return true;
    seen.add(identity);
    return true;
  });
}
