import { createHalliGalliDeck, dealHalliGalliCards } from './deck';

describe('Halli Galli deck', () => {
  it('creates the 56-card classic deck', () => {
    const deck = createHalliGalliDeck();
    expect(deck).toHaveLength(56);
    expect(new Set(deck.map((card) => card.id)).size).toBe(56);
    expect(deck.filter((card) => card.fruit === 'banana')).toHaveLength(14);
    expect(deck.filter((card) => card.fruit === 'banana' && card.count === 5)).toHaveLength(1);
  });

  it('deals every card as evenly as possible', () => {
    const decks = dealHalliGalliCards(createHalliGalliDeck(), ['a', 'b', 'c']);
    expect([...decks.values()].flat()).toHaveLength(56);
    expect([...decks.values()].map((deck) => deck.length).sort()).toEqual([18, 19, 19]);
  });
});
