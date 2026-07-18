import type { GameMetadata } from '../types';

export const LOVE_LETTER_GAME = {
  id: 'love-letter',
  label: '러브레터',
  minPlayers: 2,
  maxPlayers: 6,
  protocolVersion: 2,
  enabled: true,
  rematchTitle: '러브레터 리매치',
} as const satisfies GameMetadata;
