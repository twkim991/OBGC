import { buildHalliGalliRankings, getNextHalliGalliPlayerId } from './engine';

describe('Halli Galli engine helpers', () => {
  it('skips players who cannot flip', () => {
    expect(
      getNextHalliGalliPlayerId(['a', 'b', 'c'], 'a', (id) => id === 'c'),
    ).toBe('c');
  });

  it('ranks by owned card count and uses the bell winner for ties', () => {
    const counts = new Map([['a', 12], ['b', 20], ['c', 20]]);
    expect(buildHalliGalliRankings(['a', 'b', 'c'], counts, 'c')).toEqual(['c', 'b', 'a']);
  });
});
