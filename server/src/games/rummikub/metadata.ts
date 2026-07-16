import type { GameMetadata } from '../types';

export const RUMMIKUB_GAME = {
  id: 'rummikub',
  label: '루미큐브',
  minPlayers: 2,
  maxPlayers: 4,
  protocolVersion: 1,
  enabled: true,
  rematchTitle: '루미큐브 리매치',
} as const satisfies GameMetadata;

