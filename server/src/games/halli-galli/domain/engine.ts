export function getNextHalliGalliPlayerId(
  orderedPlayerIds: readonly string[],
  currentPlayerId: string,
  canFlip: (playerId: string) => boolean,
) {
  if (orderedPlayerIds.length === 0) return '';
  const start = Math.max(0, orderedPlayerIds.indexOf(currentPlayerId));
  for (let offset = 1; offset <= orderedPlayerIds.length; offset += 1) {
    const candidate = orderedPlayerIds[(start + offset) % orderedPlayerIds.length];
    if (canFlip(candidate)) return candidate;
  }
  return '';
}

export function buildHalliGalliRankings(
  playerIds: readonly string[],
  cardCounts: ReadonlyMap<string, number>,
  preferredWinnerId = '',
) {
  return [...playerIds].sort((left, right) => {
    const countDifference =
      (cardCounts.get(right) ?? 0) - (cardCounts.get(left) ?? 0);
    if (countDifference !== 0) return countDifference;
    if (left === preferredWinnerId) return -1;
    if (right === preferredWinnerId) return 1;
    return playerIds.indexOf(left) - playerIds.indexOf(right);
  });
}
