import { RummikubPlayer, RummikubState } from './schema';

describe('rummikub public schema', () => {
  it('does not expose the pool order or private racks', () => {
    const state = new RummikubState();
    const player = new RummikubPlayer();
    expect('pool' in state).toBe(false);
    expect('hand' in player).toBe(false);
    expect('rack' in player).toBe(false);
    expect(player.handCount).toBe(0);
  });
});

