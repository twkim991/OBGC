import { reactive } from 'vue';
import { ONECARD_PROTOCOL } from './games/onecard/protocol';
import { RUMMIKUB_PROTOCOL } from './games/rummikub/protocol';
import { YUTNORI_PROTOCOL } from './games/yutnori/protocol';

const LOCAL_GAME_VIEWS = Object.freeze([
  Object.freeze({
    id: 'yutnori',
    label: '초능력 윷놀이',
    shortLabel: '윷',
    protocolVersion: YUTNORI_PROTOCOL.version,
    quickFilter: true,
    accent: 'var(--color-warning)',
    surface: '#fff8ef',
    loadView: () => import('./games/yutnori/View.vue'),
  }),
  Object.freeze({
    id: 'onecard',
    label: '메이플 원카드',
    shortLabel: 'OC',
    protocolVersion: ONECARD_PROTOCOL.version,
    quickFilter: true,
    accent: 'var(--color-focus)',
    surface: '#f2f9ff',
    loadView: () => import('./games/onecard/View.vue'),
  }),
  Object.freeze({
    id: 'rummikub',
    label: '루미큐브',
    shortLabel: 'RM',
    protocolVersion: RUMMIKUB_PROTOCOL.version,
    quickFilter: true,
    accent: 'var(--color-success)',
    surface: '#f1faf5',
    loadView: () => import('./games/rummikub/View.vue'),
  }),
]);

const localGameById = new Map(LOCAL_GAME_VIEWS.map((game) => [game.id, game]));

export const CLIENT_PROTOCOL_VERSIONS = Object.freeze(
  Object.fromEntries(
    LOCAL_GAME_VIEWS.map((game) => [game.id, game.protocolVersion])
  )
);

// 서버 카탈로그를 불러오기 전에도 개발 환경에서 화면을 확인할 수 있도록 로컬 정의를 초기값으로 사용한다.
export const GAME_CATALOG = reactive(LOCAL_GAME_VIEWS.map((game) => ({ ...game })));
export const GAME_CATALOG_ISSUES = reactive([]);
export const DEFAULT_GAME_ID = LOCAL_GAME_VIEWS[0].id;

function isRemoteGame(value) {
  return (
    value &&
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    Number.isInteger(value.minPlayers) &&
    Number.isInteger(value.maxPlayers) &&
    value.minPlayers >= 1 &&
    value.maxPlayers >= value.minPlayers &&
    Number.isInteger(value.protocolVersion) &&
    value.protocolVersion >= 1 &&
    typeof value.enabled === 'boolean'
  );
}

export async function loadGameCatalog() {
  const endpoint = import.meta.env.DEV
    ? 'http://localhost:8002/api/games'
    : '/api/games';
  const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`게임 카탈로그 요청 실패 (${response.status})`);

  const payload = await response.json();
  if (!Array.isArray(payload) || !payload.every(isRemoteGame)) {
    throw new Error('게임 카탈로그 응답 형식이 올바르지 않습니다.');
  }

  const compatibleGames = payload.flatMap((remoteGame) => {
    const localGame = localGameById.get(remoteGame.id);
    if (
      !remoteGame.enabled ||
      !localGame ||
      localGame.protocolVersion !== remoteGame.protocolVersion
    ) {
      return [];
    }

    return [
      {
        ...localGame,
        label: remoteGame.label,
        minPlayers: remoteGame.minPlayers,
        maxPlayers: remoteGame.maxPlayers,
        protocolVersion: remoteGame.protocolVersion,
        enabled: remoteGame.enabled,
      },
    ];
  });

  const remoteGameById = new Map(payload.map((game) => [game.id, game]));
  const issues = [];

  payload.forEach((remoteGame) => {
    const localGame = localGameById.get(remoteGame.id);
    if (!remoteGame.enabled) {
      if (localGame) {
        issues.push({
          gameId: remoteGame.id,
          code: 'SERVER_DISABLED',
          message: `${remoteGame.label}은 현재 서버에서 비활성화되어 있습니다.`,
        });
      }
    } else if (!localGame) {
      issues.push({
        gameId: remoteGame.id,
        code: 'MISSING_CLIENT_VIEW',
        message: `${remoteGame.label} 화면이 이 클라이언트에 없습니다.`,
      });
    } else if (localGame.protocolVersion !== remoteGame.protocolVersion) {
      issues.push({
        gameId: remoteGame.id,
        code: 'PROTOCOL_MISMATCH',
        message: `${remoteGame.label}의 서버·클라이언트 버전이 맞지 않습니다.`,
      });
    }
  });

  LOCAL_GAME_VIEWS.forEach((localGame) => {
    if (!remoteGameById.has(localGame.id)) {
      issues.push({
        gameId: localGame.id,
        code: 'MISSING_SERVER_GAME',
        message: `${localGame.label}이 현재 서버 카탈로그에 없습니다.`,
      });
    }
  });

  if (compatibleGames.length === 0) {
    GAME_CATALOG.splice(0, GAME_CATALOG.length);
    GAME_CATALOG_ISSUES.splice(0, GAME_CATALOG_ISSUES.length, ...issues);
    throw new Error('현재 클라이언트와 호환되는 게임이 없습니다.');
  }

  GAME_CATALOG.splice(0, GAME_CATALOG.length, ...compatibleGames);
  GAME_CATALOG_ISSUES.splice(0, GAME_CATALOG_ISSUES.length, ...issues);
  return GAME_CATALOG;
}

export const getGame = (gameId) => GAME_CATALOG.find((game) => game.id === gameId);

export const isSupportedGame = (gameId) => Boolean(getGame(gameId));

export const gameLabel = (gameId) => getGame(gameId)?.label || '지원하지 않는 게임';

export const gameShortLabel = (gameId) => getGame(gameId)?.shortLabel || '?';

export const gameTone = (gameId) => {
  const game = getGame(gameId);

  return {
    '--game-color': game?.accent || 'var(--color-ink-soft)',
    '--game-surface': game?.surface || 'var(--color-surface-muted)',
  };
};
