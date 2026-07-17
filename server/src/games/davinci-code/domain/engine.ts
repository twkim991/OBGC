import type { DavinciCodeTile } from './types';

export type GuessErrorCode = 'TILE_NOT_FOUND' | 'TILE_ALREADY_REVEALED';

export type DavinciGuessResult =
  | { ok: true; correct: boolean; code: DavinciCodeTile[]; tile: DavinciCodeTile }
  | { ok: false; code: GuessErrorCode };

export function resolveDavinciGuess(
  code: readonly DavinciCodeTile[],
  tileId: string,
  guessedNumber: number,
): DavinciGuessResult {
  const target = code.find((tile) => tile.id === tileId);
  if (!target) return { ok: false, code: 'TILE_NOT_FOUND' };
  if (target.revealed) return { ok: false, code: 'TILE_ALREADY_REVEALED' };
  if (target.number !== guessedNumber) {
    return { ok: true, correct: false, code: [...code], tile: target };
  }
  return {
    ok: true,
    correct: true,
    code: code.map((tile) =>
      tile.id === tileId ? { ...tile, revealed: true } : { ...tile },
    ),
    tile: target,
  };
}

export function getNextDavinciPlayerId(
  activePlayerIds: readonly string[],
  currentPlayerId: string,
) {
  if (activePlayerIds.length === 0) return '';
  const currentIndex = activePlayerIds.indexOf(currentPlayerId);
  return activePlayerIds[
    (currentIndex + 1 + activePlayerIds.length) % activePlayerIds.length
  ];
}

export function buildDavinciRankings(
  winnerSessionId: string,
  eliminationOrder: readonly string[],
) {
  return [winnerSessionId, ...[...eliminationOrder].reverse()].filter(Boolean);
}
