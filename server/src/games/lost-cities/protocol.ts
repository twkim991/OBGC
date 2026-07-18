import { isRecord, readInteger, readString } from '../protocol';
import { LOST_CITIES_COLORS, type LostCitiesColor } from './domain/types';

export const LOST_CITIES_MESSAGES = {
  requestPrivateState: 'request_private_state',
  privateHand: 'private_hand',
  startGame: 'start_game',
  playCard: 'play_card',
  drawCard: 'draw_card',
  nextRound: 'next_round',
  returnToTable: 'return_to_table',
} as const;

const colors = new Set<string>(LOST_CITIES_COLORS);

export function parseLostCitiesPlayPayload(value: unknown): {
  cardId: string;
  destination: 'expedition' | 'discard';
  turnRevision: number;
} | null {
  if (!isRecord(value)) return null;
  const cardId = readString(value.cardId, { maxLength: 80 });
  const destination = readString(value.destination, { maxLength: 20 });
  const turnRevision = readInteger(value.turnRevision, { min: 0 });
  if (
    !cardId ||
    !['expedition', 'discard'].includes(destination ?? '') ||
    turnRevision === null
  )
    return null;
  return {
    cardId,
    destination: destination as 'expedition' | 'discard',
    turnRevision,
  };
}

export function parseLostCitiesDrawPayload(value: unknown): {
  source: 'deck' | 'discard';
  color: LostCitiesColor | '';
  turnRevision: number;
} | null {
  if (!isRecord(value)) return null;
  const source = readString(value.source, { maxLength: 20 });
  const color = readString(value.color, { maxLength: 20 }) ?? '';
  const turnRevision = readInteger(value.turnRevision, { min: 0 });
  if (!['deck', 'discard'].includes(source ?? '') || turnRevision === null)
    return null;
  if (source === 'discard' && !colors.has(color)) return null;
  if (source === 'deck' && color) return null;
  return {
    source: source as 'deck' | 'discard',
    color: color as LostCitiesColor | '',
    turnRevision,
  };
}
