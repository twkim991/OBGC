export interface LostCitiesScoreEntry {
  sessionId: string;
  roundScore: number;
  totalScore: number;
}

export function getNextLostCitiesPlayerId(
  playerIds: string[],
  currentId: string,
) {
  if (playerIds.length < 2) return playerIds[0] ?? '';
  const currentIndex = playerIds.indexOf(currentId);
  return playerIds[(currentIndex + 1 + playerIds.length) % playerIds.length];
}

export function selectLostCitiesRoundStarter(
  entries: LostCitiesScoreEntry[],
  previousStarterId: string,
) {
  const sorted = [...entries].sort(
    (left, right) => right.roundScore - left.roundScore,
  );
  if (sorted.length < 2 || sorted[0].roundScore !== sorted[1].roundScore) {
    return sorted[0]?.sessionId ?? '';
  }
  return (
    entries.find((entry) => entry.sessionId !== previousStarterId)?.sessionId ??
    entries[0]?.sessionId ??
    ''
  );
}

export function buildLostCitiesRankings(entries: LostCitiesScoreEntry[]) {
  return [...entries]
    .sort((left, right) => right.totalScore - left.totalScore)
    .map((entry) => entry.sessionId);
}

export function getLostCitiesWinnerIds(entries: LostCitiesScoreEntry[]) {
  const best = Math.max(...entries.map((entry) => entry.totalScore));
  return entries
    .filter((entry) => entry.totalScore === best)
    .map((entry) => entry.sessionId);
}
