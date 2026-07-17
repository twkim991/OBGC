import type { GameMetadata } from '../types';

export const DAVINCI_CODE_GAME = {
  id: 'davinci-code',
  label: '다빈치 코드',
  minPlayers: 2,
  maxPlayers: 4,
  protocolVersion: 1,
  enabled: true,
  rematchTitle: '다빈치 코드 리매치',
} as const satisfies GameMetadata;
