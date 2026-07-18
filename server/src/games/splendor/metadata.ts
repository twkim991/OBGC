import type { GameMetadata } from '../types';

export const SPLENDOR_GAME = {
  id: 'splendor',
  label: '스플렌더',
  minPlayers: 2,
  maxPlayers: 4,
  protocolVersion: 1,
  enabled: true,
  rematchTitle: '스플렌더 리매치',
} as const satisfies GameMetadata;
