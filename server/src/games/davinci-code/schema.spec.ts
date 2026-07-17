import { DavinciCodeState, DavinciPlayer } from './schema';

describe('davinci code public schema', () => {
  it('does not expose the pool order, pending tile or private numbers', () => {
    const state = new DavinciCodeState();
    const player = new DavinciPlayer();
    expect('pool' in state).toBe(false);
    expect('pendingDraw' in state).toBe(false);
    expect('privateCode' in player).toBe(false);
    expect(player.code).toHaveLength(0);
  });
});
