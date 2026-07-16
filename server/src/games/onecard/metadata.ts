import type { GameMetadata } from '../types';

export const MAPLE_ONE_CARD_GAME = {
  id: 'onecard',
  label: '메이플 원카드',
  minPlayers: 2,
  maxPlayers: 4,
  protocolVersion: 1,
  enabled: true,
  rematchTitle: '메이플 원카드 리매치',
} as const satisfies GameMetadata;
