export function getNextLoveLetterPlayerId(
  orderedIds: readonly string[],
  currentId: string,
  activeIds: ReadonlySet<string>,
) {
  if (orderedIds.length === 0) return '';
  const start = Math.max(orderedIds.indexOf(currentId), 0);
  for (let offset = 1; offset <= orderedIds.length; offset += 1) {
    const candidate = orderedIds[(start + offset) % orderedIds.length];
    if (activeIds.has(candidate)) return candidate;
  }
  return '';
}

export function buildLoveLetterRankings(
  playerIds: readonly string[],
  favors: ReadonlyMap<string, number>,
) {
  return [...playerIds].sort(
    (left, right) =>
      (favors.get(right) ?? 0) - (favors.get(left) ?? 0) ||
      playerIds.indexOf(left) - playerIds.indexOf(right),
  );
}
