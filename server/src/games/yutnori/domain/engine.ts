export function getNextPlayerId(
  playerIds: string[],
  currentPlayerId: string,
): string {
  if (playerIds.length === 0) return '';
  const currentIndex = playerIds.indexOf(currentPlayerId);
  return playerIds[currentIndex === -1 ? 0 : (currentIndex + 1) % playerIds.length];
}
