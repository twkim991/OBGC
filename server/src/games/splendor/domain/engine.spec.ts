import { getNextSplendorPlayerId, shouldFinishSplendorGame } from './engine';

describe('splendor engine', () => {
  it('skips disconnected players in table order', () => {
    expect(getNextSplendorPlayerId(['a', 'b', 'c'], 'a', new Set(['a', 'c']))).toBe('c');
  });

  it('ends the final round when play returns to the first player', () => {
    expect(shouldFinishSplendorGame('a', 'a', true)).toBe(true);
    expect(shouldFinishSplendorGame('b', 'a', true)).toBe(false);
  });
});
