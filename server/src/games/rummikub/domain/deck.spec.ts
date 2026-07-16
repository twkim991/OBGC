import {
  createRummikubDeck,
  dealRummikubGame,
  RUMMIKUB_TILE_COUNT,
} from './deck';

describe('rummikub deck', () => {
  it('creates 104 numbered tiles and two unique jokers', () => {
    const deck = createRummikubDeck();
    expect(deck).toHaveLength(RUMMIKUB_TILE_COUNT);
    expect(new Set(deck.map((tile) => tile.id)).size).toBe(RUMMIKUB_TILE_COUNT);
    expect(deck.filter((tile) => tile.isJoker)).toHaveLength(2);
    expect(
      deck.filter((tile) => tile.color === 'red' && tile.number === 7),
    ).toHaveLength(2);
  });

  it('deals fourteen private tiles to every player', () => {
    const deal = dealRummikubGame(createRummikubDeck(), ['a', 'b']);
    expect(deal.hands.get('a')).toHaveLength(14);
    expect(deal.hands.get('b')).toHaveLength(14);
    expect(deal.pool).toHaveLength(78);
  });
});
