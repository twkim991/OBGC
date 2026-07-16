import { MapleOneCardState, OneCardPlayer } from './schema';

describe('one-card public schema', () => {
  it('does not expose the deck or player hands', () => {
    const state = new MapleOneCardState();
    const player = new OneCardPlayer();

    expect('deck' in state).toBe(false);
    expect('hand' in player).toBe(false);
    expect('playerId' in player).toBe(false);
    expect(player.handCount).toBe(0);
  });
});
