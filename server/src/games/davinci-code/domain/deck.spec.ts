import {
  createDavinciDeck,
  DAVINCI_TILE_COUNT,
  drawDavinciCode,
  shuffleDavinciTiles,
} from './deck';

describe('davinci code deck', () => {
  it('creates one light and dark tile for every number', () => {
    const deck = createDavinciDeck();
    expect(deck).toHaveLength(DAVINCI_TILE_COUNT);
    expect(new Set(deck.map((tile) => tile.id)).size).toBe(DAVINCI_TILE_COUNT);
    expect(deck.filter((tile) => tile.color === 'dark')).toHaveLength(12);
    expect(deck.filter((tile) => tile.number === 7)).toHaveLength(2);
  });

  it('draws the requested initial color combination without exposing values', () => {
    const pool = shuffleDavinciTiles(createDavinciDeck(), () => 0.5);
    const code = drawDavinciCode(pool, ['dark', 'light', 'dark', 'light']);
    expect(code?.map((tile) => tile.color)).toEqual([
      'dark',
      'light',
      'dark',
      'light',
    ]);
    expect(code?.every((tile) => !tile.revealed)).toBe(true);
    expect(pool).toHaveLength(20);
  });
});
