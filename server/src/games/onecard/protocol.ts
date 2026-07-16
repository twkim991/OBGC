import { isRecord, readString } from '../protocol';

export const ONECARD_MESSAGES = {
  requestPrivateState: 'request_private_state',
  privateHand: 'private_hand',
  playCard: 'play_card',
  drawCard: 'draw_card',
  startGame: 'start_game',
  returnToTable: 'return_to_table',
} as const;

export interface PlayCardPayload {
  cardId: string;
  chosenColor?: string;
}

const selectableColors = new Set(['red', 'yellow', 'green', 'blue']);

export function parsePlayCardPayload(value: unknown): PlayCardPayload | null {
  if (!isRecord(value)) return null;

  const cardId = readString(value.cardId, { maxLength: 80 });
  const chosenColor =
    value.chosenColor === undefined
      ? undefined
      : readString(value.chosenColor, { maxLength: 10 });

  if (
    !cardId ||
    (value.chosenColor !== undefined &&
      (!chosenColor || !selectableColors.has(chosenColor)))
  ) {
    return null;
  }
  return { cardId, chosenColor };
}
