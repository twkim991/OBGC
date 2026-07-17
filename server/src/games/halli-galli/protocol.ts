import { isRecord, readInteger } from '../protocol';

export const HALLI_GALLI_MESSAGES = {
  startGame: 'start_game',
  flipCard: 'flip_card',
  ringBell: 'ring_bell',
  returnToTable: 'return_to_table',
} as const;

export function parseHalliGalliRevisionPayload(
  value: unknown,
): { boardRevision: number } | null {
  if (!isRecord(value)) return null;
  const boardRevision = readInteger(value.boardRevision, { min: 0 });
  return boardRevision === null ? null : { boardRevision };
}
