import type { Server } from 'colyseus';
import type { GameDefinition, PublicGameMetadata } from './types';
import { MAPLE_ONE_CARD_DEFINITION } from './onecard/definition';
import { RUMMIKUB_DEFINITION } from './rummikub/definition';
import { YUTNORI_DEFINITION } from './yutnori/definition';

// 새 게임은 룸 파일에서 정의를 내보낸 뒤 이 목록에 한 번만 연결합니다.
export const GAME_DEFINITIONS = [
  YUTNORI_DEFINITION,
  MAPLE_ONE_CARD_DEFINITION,
  RUMMIKUB_DEFINITION,
] as const;

export type RegisteredGame = (typeof GAME_DEFINITIONS)[number];
export type GameType = RegisteredGame['id'];

export const DEFAULT_GAME =
  GAME_DEFINITIONS.find((game) => game.enabled) ?? GAME_DEFINITIONS[0];

export function validateGameDefinitions(
  definitions: readonly GameDefinition[],
) {
  const ids = new Set(definitions.map((game) => game.id));
  if (ids.size !== definitions.length) {
    throw new Error('게임 레지스트리에 중복된 ID가 있습니다.');
  }
  if (!definitions.some((game) => game.enabled)) {
    throw new Error('활성화된 게임이 하나 이상 필요합니다.');
  }

  definitions.forEach((game) => {
    if (game.minPlayers < 1 || game.maxPlayers < game.minPlayers) {
      throw new Error(`${game.id}의 플레이어 인원 설정이 올바르지 않습니다.`);
    }
    if (!Number.isInteger(game.protocolVersion) || game.protocolVersion < 1) {
      throw new Error(`${game.id}의 프로토콜 버전이 올바르지 않습니다.`);
    }
  });
}

validateGameDefinitions(GAME_DEFINITIONS);

const gameById = new Map<string, RegisteredGame>(
  GAME_DEFINITIONS.map((game) => [game.id, game] as const),
);

export function getGame(value: unknown): RegisteredGame | null {
  if (typeof value !== 'string') return null;
  const game = gameById.get(value) ?? null;
  return game?.enabled ? game : null;
}

export function getPublicGameCatalog(): PublicGameMetadata[] {
  return GAME_DEFINITIONS.map(
    ({ id, label, minPlayers, maxPlayers, protocolVersion, enabled }) => ({
      id,
      label,
      minPlayers,
      maxPlayers,
      protocolVersion,
      enabled,
    }),
  );
}

export function registerGameRooms(server: Server) {
  GAME_DEFINITIONS.forEach((game) => {
    if (game.enabled) server.define(game.id, game.room);
  });
}
