import { analyzeMelds, calculateMeldScore } from './rules';
import type { RummikubMeld, RummikubTile } from './types';

export const RUMMIKUB_MAX_MELDS = 36;
export const RUMMIKUB_MAX_TILES = 106;

export type CommitErrorCode =
  | 'STALE_BOARD_REVISION'
  | 'MOVE_TOO_LARGE'
  | 'DUPLICATE_TILE'
  | 'TILE_NOT_OWNED'
  | 'BOARD_TILE_MISSING'
  | 'NO_TILE_PLAYED'
  | 'INVALID_MELD'
  | 'INITIAL_MELD_REQUIRED'
  | 'INITIAL_MELD_TOO_LOW';

export type CommitValidationResult =
  | {
      ok: true;
      melds: RummikubMeld[];
      hand: RummikubTile[];
      addedTileIds: string[];
      initialMeldScore: number;
    }
  | { ok: false; code: CommitErrorCode };

export interface ValidateCommitInput {
  previousMelds: readonly RummikubMeld[];
  hand: readonly RummikubTile[];
  candidateMeldTileIds: readonly (readonly string[])[];
  hasInitialMeld: boolean;
  currentRevision: number;
  baseRevision: number;
}

function sameTileOrder(
  tiles: readonly RummikubTile[],
  tileIds: readonly string[],
) {
  return (
    tiles.length === tileIds.length &&
    tiles.every((tile, index) => tile.id === tileIds[index])
  );
}

export function validateRummikubCommit({
  previousMelds,
  hand,
  candidateMeldTileIds,
  hasInitialMeld,
  currentRevision,
  baseRevision,
}: ValidateCommitInput): CommitValidationResult {
  if (baseRevision !== currentRevision) {
    return { ok: false, code: 'STALE_BOARD_REVISION' };
  }

  const candidateCount = candidateMeldTileIds.reduce(
    (total, meld) => total + meld.length,
    0,
  );
  if (
    candidateMeldTileIds.length === 0 ||
    candidateMeldTileIds.length > RUMMIKUB_MAX_MELDS ||
    candidateCount > RUMMIKUB_MAX_TILES ||
    candidateMeldTileIds.some((meld) => meld.length < 3 || meld.length > 13)
  ) {
    return { ok: false, code: 'MOVE_TOO_LARGE' };
  }

  const candidateIds = candidateMeldTileIds.flatMap((meld) => [...meld]);
  if (new Set(candidateIds).size !== candidateIds.length) {
    return { ok: false, code: 'DUPLICATE_TILE' };
  }

  const previousBoardTiles = previousMelds.flatMap((meld) => [...meld]);
  const boardIds = new Set(previousBoardTiles.map((tile) => tile.id));
  const handIds = new Set(hand.map((tile) => tile.id));
  const availableTiles = new Map(
    [...previousBoardTiles, ...hand].map((tile) => [tile.id, tile] as const),
  );

  if (candidateIds.some((tileId) => !availableTiles.has(tileId))) {
    return { ok: false, code: 'TILE_NOT_OWNED' };
  }
  if (previousBoardTiles.some((tile) => !candidateIds.includes(tile.id))) {
    return { ok: false, code: 'BOARD_TILE_MISSING' };
  }

  const addedTileIds = candidateIds.filter((tileId) => !boardIds.has(tileId));
  if (addedTileIds.length === 0) {
    return { ok: false, code: 'NO_TILE_PLAYED' };
  }
  if (addedTileIds.some((tileId) => !handIds.has(tileId))) {
    return { ok: false, code: 'TILE_NOT_OWNED' };
  }

  const candidateMelds = candidateMeldTileIds.map((meld) =>
    meld.map((tileId) => availableTiles.get(tileId) as RummikubTile),
  );
  if (!analyzeMelds(candidateMelds)) {
    return { ok: false, code: 'INVALID_MELD' };
  }

  let initialMeldScore = 0;
  if (!hasInitialMeld) {
    const preservesBoard = previousMelds.every((meld, index) =>
      sameTileOrder(meld, candidateMeldTileIds[index] ?? []),
    );
    if (!preservesBoard) {
      return { ok: false, code: 'INITIAL_MELD_REQUIRED' };
    }

    const newMelds = candidateMelds.slice(previousMelds.length);
    if (
      newMelds.length === 0 ||
      newMelds.some((meld) => meld.some((tile) => boardIds.has(tile.id)))
    ) {
      return { ok: false, code: 'INITIAL_MELD_REQUIRED' };
    }

    initialMeldScore = calculateMeldScore(newMelds) ?? 0;
    if (initialMeldScore < 30) {
      return { ok: false, code: 'INITIAL_MELD_TOO_LOW' };
    }
  }

  const addedIdSet = new Set(addedTileIds);
  return {
    ok: true,
    melds: candidateMelds,
    hand: hand.filter((tile) => !addedIdSet.has(tile.id)),
    addedTileIds,
    initialMeldScore,
  };
}

export function getNextRummikubPlayerId(
  playerIds: readonly string[],
  currentPlayerId: string,
) {
  if (playerIds.length === 0) return '';
  const currentIndex = playerIds.indexOf(currentPlayerId);
  return playerIds[(currentIndex + 1 + playerIds.length) % playerIds.length];
}

