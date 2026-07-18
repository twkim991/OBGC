import { createSplendorCards, createSplendorNobles } from './cards';

describe('splendor content', () => {
  it('contains the complete 40/30/20 development deck', () => {
    const cards = createSplendorCards();
    expect(cards).toHaveLength(90);
    expect(cards.filter((card) => card.tier === 1)).toHaveLength(40);
    expect(cards.filter((card) => card.tier === 2)).toHaveLength(30);
    expect(cards.filter((card) => card.tier === 3)).toHaveLength(20);
    expect(new Set(cards.map((card) => card.id)).size).toBe(90);
  });

  it('contains ten unique three-point nobles', () => {
    const nobles = createSplendorNobles();
    expect(nobles).toHaveLength(10);
    expect(nobles.every((noble) => noble.prestige === 3)).toBe(true);
    expect(new Set(nobles.map((noble) => noble.id)).size).toBe(10);
  });
});
