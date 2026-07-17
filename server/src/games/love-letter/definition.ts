import type { GameDefinition } from '../types';
import { LOVE_LETTER_GAME } from './metadata';
import { LoveLetterRoom } from './room';

export const LOVE_LETTER_DEFINITION = {
  ...LOVE_LETTER_GAME,
  room: LoveLetterRoom,
} as const satisfies GameDefinition;
