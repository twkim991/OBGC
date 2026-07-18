import type { GameMetadata } from '../types';

export const LOST_CITIES_GAME = {
  id: 'lost-cities',
  label: '로스트시티',
  minPlayers: 2,
  maxPlayers: 2,
  protocolVersion: 1,
  enabled: true,
  rematchTitle: '로스트시티 리매치',
} as const satisfies GameMetadata;
