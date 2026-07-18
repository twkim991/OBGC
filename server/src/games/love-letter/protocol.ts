import { isRecord, readInteger, readString } from '../protocol';
import { LOVE_LETTER_CHARACTERS, type LoveLetterCharacter } from './domain/types';

export const LOVE_LETTER_MESSAGES = {
  requestPrivateState: 'request_private_state',
  privateHand: 'private_hand',
  privateReveal: 'private_reveal',
  startGame: 'start_game',
  drawCard: 'draw_card',
  playCard: 'play_card',
  resolveChancellor: 'resolve_chancellor',
  nextRound: 'next_round',
  returnToTable: 'return_to_table',
} as const;

const characterSet = new Set<string>(LOVE_LETTER_CHARACTERS);

export function parseLoveLetterDrawPayload(value: unknown): { turnRevision: number } | null {
  if (!isRecord(value)) return null;
  const turnRevision = readInteger(value.turnRevision, { min: 0 });
  return turnRevision === null ? null : { turnRevision };
}

export function parseLoveLetterPlayPayload(value: unknown): {
  cardId: string;
  targetSessionId: string;
  guessedCharacter: LoveLetterCharacter | '';
  turnRevision: number;
} | null {
  if (!isRecord(value)) return null;
  const cardId = readString(value.cardId, { maxLength: 80 });
  const targetSessionId = readString(value.targetSessionId, { maxLength: 128 }) ?? '';
  const guessed = readString(value.guessedCharacter, { maxLength: 20 }) ?? '';
  const turnRevision = readInteger(value.turnRevision, { min: 0 });
  if (!cardId || turnRevision === null || (guessed && !characterSet.has(guessed))) return null;
  return { cardId, targetSessionId, guessedCharacter: guessed as LoveLetterCharacter | '', turnRevision };
}

export function parseChancellorPayload(value: unknown): {
  keepCardId: string;
  returnCardIds: string[];
  turnRevision: number;
} | null {
  if (!isRecord(value) || !Array.isArray(value.returnCardIds)) return null;
  const keepCardId = readString(value.keepCardId, { maxLength: 80 });
  const turnRevision = readInteger(value.turnRevision, { min: 0 });
  const returnCardIds = value.returnCardIds.map((id) => readString(id, { maxLength: 80 }));
  if (!keepCardId || turnRevision === null || returnCardIds.some((id) => !id)) return null;
  if (returnCardIds.length < 1 || returnCardIds.length > 2) return null;
  return { keepCardId, returnCardIds: returnCardIds as string[], turnRevision };
}
