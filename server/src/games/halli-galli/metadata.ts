import type { GameMetadata } from '../types';

export const HALLI_GALLI_GAME = {
  id: 'halli-galli',
  label: '할리갈리',
  minPlayers: 2,
  maxPlayers: 6,
  protocolVersion: 1,
  enabled: true,
  rematchTitle: '할리갈리 리매치',
} as const satisfies GameMetadata;
