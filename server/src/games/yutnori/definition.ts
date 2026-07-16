import { YutnoriRoom } from './room';
import type { GameDefinition } from '../types';
import { YUTNORI_GAME } from './metadata';

export const YUTNORI_DEFINITION = {
  ...YUTNORI_GAME,
  room: YutnoriRoom,
} as const satisfies GameDefinition;
