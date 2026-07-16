export const GAME_CATALOG = Object.freeze([
  Object.freeze({
    id: 'yutnori',
    label: '초능력 윷놀이',
    shortLabel: '윷',
    quickFilter: true,
    accent: 'var(--color-warning)',
    surface: '#fff8ef',
    loadView: () => import('./components/games/YutnoriView.vue'),
  }),
  Object.freeze({
    id: 'onecard',
    label: '메이플 원카드',
    shortLabel: 'OC',
    quickFilter: true,
    accent: 'var(--color-focus)',
    surface: '#f2f9ff',
    loadView: () => import('./components/games/MapleOneCardView.vue'),
  }),
]);

export const DEFAULT_GAME_ID = GAME_CATALOG[0].id;

const gameById = new Map(GAME_CATALOG.map((game) => [game.id, game]));

export const getGame = (gameId) => gameById.get(gameId);

export const isSupportedGame = (gameId) => gameById.has(gameId);

export const gameLabel = (gameId) => getGame(gameId)?.label || '게임 미정';

export const gameShortLabel = (gameId) => getGame(gameId)?.shortLabel || '?';

export const gameTone = (gameId) => {
  const game = getGame(gameId);

  return {
    '--game-color': game?.accent || 'var(--color-ink-soft)',
    '--game-surface': game?.surface || 'var(--color-surface-muted)',
  };
};
