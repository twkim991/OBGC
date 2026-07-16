import type { GameMetadata } from '../types';

export const YUTNORI_GAME = {
  id: 'yutnori',
  label: '초능력 윷놀이',
  minPlayers: 2,
  maxPlayers: 4,
  protocolVersion: 1,
  enabled: true,
  rematchTitle: '초능력 윷놀이 리매치',
} as const satisfies GameMetadata;
