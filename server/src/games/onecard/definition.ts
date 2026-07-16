import { MapleOneCardRoom } from './room';
import type { GameDefinition } from '../types';
import { MAPLE_ONE_CARD_GAME } from './metadata';

export const MAPLE_ONE_CARD_DEFINITION = {
  ...MAPLE_ONE_CARD_GAME,
  room: MapleOneCardRoom,
} as const satisfies GameDefinition;
