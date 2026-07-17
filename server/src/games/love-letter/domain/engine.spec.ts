import { buildLoveLetterRankings, getNextLoveLetterPlayerId } from './engine';

describe('love letter engine', () => {
  it('skips eliminated players in table order', () => {
    expect(getNextLoveLetterPlayerId(['a', 'b', 'c'], 'a', new Set(['a', 'c']))).toBe('c');
    expect(getNextLoveLetterPlayerId(['a', 'b', 'c'], 'c', new Set(['a', 'c']))).toBe('a');
  });

  it('ranks by favor while preserving seats on ties', () => {
    expect(buildLoveLetterRankings(['a', 'b', 'c'], new Map([['a', 2], ['b', 4], ['c', 2]]))).toEqual(['b', 'a', 'c']);
  });
});
