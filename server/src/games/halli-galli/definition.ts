import type { GameDefinition } from '../types';
import { HALLI_GALLI_GAME } from './metadata';
import { HalliGalliRoom } from './room';

export const HALLI_GALLI_DEFINITION = {
  ...HALLI_GALLI_GAME,
  room: HalliGalliRoom,
} as const satisfies GameDefinition;
