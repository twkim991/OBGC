import type { RummikubTile } from './types';

export function getRackValue(tiles: readonly RummikubTile[]) {
  return tiles.reduce(
    (total, tile) => total + (tile.isJoker ? 30 : tile.number),
    0,
  );
}

export interface RummikubScoreResult {
  winnerSessionId: string;
  scores: Map<string, number>;
  rankings: string[];
}

export function scoreCompletedGame(
  hands: ReadonlyMap<string, readonly RummikubTile[]>,
  winnerSessionId: string,
): RummikubScoreResult {
  const rackValues = new Map<string, number>(
    Array.from(
      hands,
      ([sessionId, tiles]): [string, number] => [sessionId, getRackValue(tiles)],
    ),
  );
  const loserTotal = Array.from(rackValues.entries()).reduce(
    (total, [sessionId, value]) =>
      sessionId === winnerSessionId ? total : total + value,
    0,
  );
  const scores = new Map<string, number>();
  rackValues.forEach((value, sessionId) => {
    scores.set(sessionId, sessionId === winnerSessionId ? loserTotal : -value);
  });

  const rankings = Array.from(rackValues.keys()).sort((first, second) => {
    if (first === winnerSessionId) return -1;
    if (second === winnerSessionId) return 1;
    return (rackValues.get(first) ?? 0) - (rackValues.get(second) ?? 0);
  });
  return { winnerSessionId, scores, rankings };
}

export function scoreStalemate(
  hands: ReadonlyMap<string, readonly RummikubTile[]>,
): RummikubScoreResult {
  const rackValues = new Map<string, number>(
    Array.from(
      hands,
      ([sessionId, tiles]): [string, number] => [sessionId, getRackValue(tiles)],
    ),
  );
  const rankings = Array.from(rackValues.keys()).sort(
    (first, second) =>
      (rackValues.get(first) ?? 0) - (rackValues.get(second) ?? 0),
  );
  const winnerSessionId = rankings[0] ?? '';
  const winnerValue = rackValues.get(winnerSessionId) ?? 0;
  const scores = new Map<string, number>();
  let winnerScore = 0;

  rackValues.forEach((value, sessionId) => {
    if (sessionId === winnerSessionId) return;
    const difference = value - winnerValue;
    scores.set(sessionId, -difference);
    winnerScore += difference;
  });
  if (winnerSessionId) scores.set(winnerSessionId, winnerScore);

  return { winnerSessionId, scores, rankings };
}
