import { YutnoriState, YutPlayer } from './schema';

describe('yutnori public schema', () => {
  it('exposes only skill counts and no persistent player identity', () => {
    const state = new YutnoriState();
    const player = new YutPlayer();

    expect('skills' in player).toBe(false);
    expect('playerId' in player).toBe(false);
    expect(player.skillCount).toBe(0);
    expect(state.migrationReady).toBe(false);
  });
});
