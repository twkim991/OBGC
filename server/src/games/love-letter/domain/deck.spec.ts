import { createLoveLetterDeck } from './deck';
import { LOVE_LETTER_CARD_COUNTS } from './types';

describe('love letter deck', () => {
  it('creates the 21-card latest-edition deck', () => {
    const deck = createLoveLetterDeck();
    expect(deck).toHaveLength(21);
    Object.entries(LOVE_LETTER_CARD_COUNTS).forEach(([character, count]) => {
      expect(deck.filter((card) => card.character === character)).toHaveLength(count);
    });
    expect(new Set(deck.map((card) => card.id)).size).toBe(21);
  });
});
