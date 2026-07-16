import { isRecord, readInteger, readString } from '../protocol';
import {
  RUMMIKUB_MAX_MELDS,
  RUMMIKUB_MAX_TILES,
} from './domain/engine';

export const RUMMIKUB_MESSAGES = {
  requestPrivateState: 'request_private_state',
  privateRack: 'private_rack',
  startGame: 'start_game',
  commitTurn: 'commit_turn',
  drawTile: 'draw_tile',
  passTurn: 'pass_turn',
  returnToTable: 'return_to_table',
} as const;

export interface CommitTurnPayload {
  baseRevision: number;
  melds: Array<{ tileIds: string[] }>;
}

export function parseCommitTurnPayload(
  value: unknown,
): CommitTurnPayload | null {
  if (!isRecord(value) || !Array.isArray(value.melds)) return null;

  const baseRevision = readInteger(value.baseRevision, { min: 0 });
  if (
    baseRevision === null ||
    value.melds.length === 0 ||
    value.melds.length > RUMMIKUB_MAX_MELDS
  ) {
    return null;
  }

  let tileCount = 0;
  const melds: Array<{ tileIds: string[] }> = [];

  for (const rawMeld of value.melds) {
    if (!isRecord(rawMeld) || !Array.isArray(rawMeld.tileIds)) return null;
    if (rawMeld.tileIds.length < 3 || rawMeld.tileIds.length > 13) return null;

    const tileIds = rawMeld.tileIds.map((tileId) =>
      readString(tileId, { maxLength: 80 }),
    );
    if (tileIds.some((tileId) => tileId === null)) return null;

    tileCount += tileIds.length;
    if (tileCount > RUMMIKUB_MAX_TILES) return null;
    melds.push({ tileIds: tileIds as string[] });
  }

  return { baseRevision, melds };
}

