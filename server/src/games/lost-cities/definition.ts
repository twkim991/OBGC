import type { GameDefinition } from '../types';
import { LOST_CITIES_GAME } from './metadata';
import { LostCitiesRoom } from './room';

export const LOST_CITIES_DEFINITION = {
  ...LOST_CITIES_GAME,
  room: LostCitiesRoom,
} as const satisfies GameDefinition;
