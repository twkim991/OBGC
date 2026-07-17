import type { GameDefinition } from '../types';
import { DAVINCI_CODE_GAME } from './metadata';
import { DavinciCodeRoom } from './room';

export const DAVINCI_CODE_DEFINITION = {
  ...DAVINCI_CODE_GAME,
  room: DavinciCodeRoom,
} as const satisfies GameDefinition;
