import { analyzeMeld, calculateMeldScore } from './rules';
import type { RummikubColor, RummikubTile } from './types';

const tile = (id: string, color: RummikubColor, number: number): RummikubTile => ({
  id,
  color,
  number,
  isJoker: false,
});
const joker = (id: string): RummikubTile => ({
  id,
  color: 'joker',
  number: 0,
  isJoker: true,
});

describe('rummikub meld rules', () => {
  it('accepts groups with unique colors', () => {
    expect(
      analyzeMeld([tile('a', 'red', 8), tile('b', 'blue', 8), tile('c', 'black', 8)]),
    ).toMatchObject({ kind: 'group', score: 24 });
    expect(
      analyzeMeld([tile('a', 'red', 8), tile('b', 'red', 8), tile('c', 'black', 8)]),
    ).toBeNull();
  });

  it('accepts ordered runs and resolves joker values', () => {
    expect(
      analyzeMeld([joker('j'), tile('a', 'yellow', 11), tile('b', 'yellow', 12)]),
    ).toMatchObject({ kind: 'run', score: 33, jokerValues: [10] });
    expect(
      analyzeMeld([tile('a', 'yellow', 12), tile('b', 'yellow', 13), tile('c', 'yellow', 1)]),
    ).toBeNull();
  });

  it('calculates multiple meld scores including jokers', () => {
    expect(
      calculateMeldScore([
        [tile('a', 'red', 10), tile('b', 'blue', 10), joker('j')],
        [tile('c', 'black', 1), tile('d', 'black', 2), tile('e', 'black', 3)],
      ]),
    ).toBe(36);
  });
});

