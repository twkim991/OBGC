import { getExactFiveFruit, getVisibleFruitTotals, hasExactFive } from './rules';

describe('Halli Galli rules', () => {
  it('sums only the supplied top cards and detects exactly five', () => {
    const cards = [
      { id: 'a', fruit: 'strawberry' as const, count: 2 },
      { id: 'b', fruit: 'strawberry' as const, count: 3 },
      { id: 'c', fruit: 'lime' as const, count: 5 },
    ];
    const totals = getVisibleFruitTotals(cards);
    expect(totals).toEqual({ strawberry: 5, banana: 0, lime: 5, plum: 0 });
    expect(getExactFiveFruit(totals)).toBe('strawberry');
    expect(hasExactFive(cards)).toBe(true);
  });

  it('does not accept more than five', () => {
    expect(
      hasExactFive([
        { id: 'a', fruit: 'plum', count: 3 },
        { id: 'b', fruit: 'plum', count: 3 },
      ]),
    ).toBe(false);
  });
});
