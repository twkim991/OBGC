import { isRecord, readInteger, readString } from '../protocol';
import { DAVINCI_COLORS, type DavinciColor } from './domain/types';

export const DAVINCI_CODE_MESSAGES = {
  requestPrivateState: 'request_private_state',
  privateCode: 'private_code',
  startGame: 'start_game',
  chooseInitialColors: 'choose_initial_colors',
  drawTile: 'draw_tile',
  guessTile: 'guess_tile',
  stopGuessing: 'stop_guessing',
  returnToTable: 'return_to_table',
} as const;

const colorSet = new Set<string>(DAVINCI_COLORS);

export function parseInitialColorsPayload(
  value: unknown,
): { colors: DavinciColor[] } | null {
  if (!isRecord(value) || !Array.isArray(value.colors)) return null;
  if (value.colors.length < 3 || value.colors.length > 4) return null;
  const colors = value.colors.map((color) => readString(color, { maxLength: 10 }));
  if (colors.some((color) => !color || !colorSet.has(color))) return null;
  return { colors: colors as DavinciColor[] };
}

export function parseDrawTilePayload(
  value: unknown,
): { color: DavinciColor; turnRevision: number } | null {
  if (!isRecord(value)) return null;
  const color = readString(value.color, { maxLength: 10 });
  const turnRevision = readInteger(value.turnRevision, { min: 0 });
  if (!color || !colorSet.has(color) || turnRevision === null) return null;
  return { color: color as DavinciColor, turnRevision };
}

export function parseGuessTilePayload(value: unknown): {
  targetSessionId: string;
  tileId: string;
  guessedNumber: number;
  turnRevision: number;
} | null {
  if (!isRecord(value)) return null;
  const targetSessionId = readString(value.targetSessionId, { maxLength: 128 });
  const tileId = readString(value.tileId, { maxLength: 80 });
  const guessedNumber = readInteger(value.guessedNumber, { min: 0, max: 11 });
  const turnRevision = readInteger(value.turnRevision, { min: 0 });
  if (!targetSessionId || !tileId || guessedNumber === null || turnRevision === null) {
    return null;
  }
  return { targetSessionId, tileId, guessedNumber, turnRevision };
}

export function parseStopGuessingPayload(
  value: unknown,
): { turnRevision: number } | null {
  if (!isRecord(value)) return null;
  const turnRevision = readInteger(value.turnRevision, { min: 0 });
  return turnRevision === null ? null : { turnRevision };
}
