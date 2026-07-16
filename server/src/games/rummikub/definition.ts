import type { GameDefinition } from '../types';
import { RUMMIKUB_GAME } from './metadata';
import { RummikubRoom } from './room';

export const RUMMIKUB_DEFINITION = {
  ...RUMMIKUB_GAME,
  room: RummikubRoom,
} as const satisfies GameDefinition;

