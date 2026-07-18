import type { GameDefinition } from '../types';
import { SPLENDOR_GAME } from './metadata';
import { SplendorRoom } from './room';

export const SPLENDOR_DEFINITION = {
  ...SPLENDOR_GAME,
  room: SplendorRoom,
} as const satisfies GameDefinition;
