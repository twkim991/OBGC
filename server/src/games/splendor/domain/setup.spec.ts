import { getSplendorGemCount, getSplendorNobleCount } from './setup';

describe('splendor setup', () => {
  it.each([[2, 4], [3, 5], [4, 7]])('uses %i-player gem supply', (players, count) => {
    expect(getSplendorGemCount(players)).toBe(count);
    expect(getSplendorNobleCount(players)).toBe(players + 1);
  });
});
