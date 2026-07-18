import { createLostCitiesDeck, dealLostCitiesHands } from './deck';
import { LOST_CITIES_COLORS } from './types';

describe('lost cities deck', () => {
  it('creates 60 unique cards with 3 wagers and numbers 2 through 10 per color', () => {
    const deck = createLostCitiesDeck();
    expect(deck).toHaveLength(60);
    expect(new Set(deck.map((card) => card.id)).size).toBe(60);
    LOST_CITIES_COLORS.forEach((color) => {
      const cards = deck.filter((card) => card.color === color);
      expect(cards).toHaveLength(12);
      expect(cards.filter((card) => card.kind === 'wager')).toHaveLength(3);
      expect(
        cards
          .filter((card) => card.kind === 'number')
          .map((card) => card.value),
      ).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
  });

  it('deals eight cards to each player and leaves 44 in the deck', () => {
    const result = dealLostCitiesHands(createLostCitiesDeck(), ['a', 'b']);
    expect(result.hands.get('a')).toHaveLength(8);
    expect(result.hands.get('b')).toHaveLength(8);
    expect(result.deck).toHaveLength(44);
  });
});
