import { isRecord, readInteger, readString } from '../protocol';
import { SPLENDOR_COLORS, SPLENDOR_TOKEN_COLORS, type SplendorTier } from './domain/types';

export const SPLENDOR_MESSAGES = {
  requestPrivateState: 'request_private_state',
  privateReservations: 'private_reservations',
  startGame: 'start_game',
  takeGems: 'take_gems',
  reserveCard: 'reserve_card',
  purchaseCard: 'purchase_card',
  returnTokens: 'return_tokens',
  chooseNoble: 'choose_noble',
  returnToTable: 'return_to_table',
} as const;

function readRevision(value: Record<string, unknown>) {
  return readInteger(value.turnRevision, { min: 0 });
}

export function parseSplendorTakePayload(value: unknown) {
  if (!isRecord(value) || !isRecord(value.selection)) return null;
  const turnRevision = readRevision(value);
  if (turnRevision === null) return null;
  const selection = Object.fromEntries(SPLENDOR_COLORS.map((color) => [
    color,
    readInteger(value.selection[color], { min: 0, max: 2 }) ?? 0,
  ]));
  return { selection, turnRevision };
}

export function parseSplendorReservePayload(value: unknown): {
  source: 'market' | 'deck'; cardId: string; tier: SplendorTier; turnRevision: number;
} | null {
  if (!isRecord(value)) return null;
  const source = readString(value.source, { maxLength: 10 });
  const cardId = readString(value.cardId, { maxLength: 80 }) ?? '';
  const tier = readInteger(value.tier, { min: 1, max: 3 });
  const turnRevision = readRevision(value);
  if ((source !== 'market' && source !== 'deck') || tier === null || turnRevision === null) return null;
  if (source === 'market' && !cardId) return null;
  return { source, cardId, tier: tier as SplendorTier, turnRevision };
}

export function parseSplendorPurchasePayload(value: unknown): {
  source: 'market' | 'reserved'; cardId: string; turnRevision: number;
} | null {
  if (!isRecord(value)) return null;
  const source = readString(value.source, { maxLength: 10 });
  const cardId = readString(value.cardId, { maxLength: 80 });
  const turnRevision = readRevision(value);
  if ((source !== 'market' && source !== 'reserved') || !cardId || turnRevision === null) return null;
  return { source, cardId, turnRevision };
}

export function parseSplendorReturnPayload(value: unknown) {
  if (!isRecord(value) || !isRecord(value.returned)) return null;
  const turnRevision = readRevision(value);
  if (turnRevision === null) return null;
  const returned = Object.fromEntries(SPLENDOR_TOKEN_COLORS.map((color) => [
    color,
    readInteger(value.returned[color], { min: 0, max: 10 }) ?? 0,
  ]));
  return { returned, turnRevision };
}

export function parseSplendorNoblePayload(value: unknown) {
  if (!isRecord(value)) return null;
  const nobleId = readString(value.nobleId, { maxLength: 80 });
  const turnRevision = readRevision(value);
  return nobleId && turnRevision !== null ? { nobleId, turnRevision } : null;
}
