import { LostCitiesPlayer, LostCitiesState } from './schema';

describe('lost cities public schema', () => {
  it('exposes counts and routes without leaking hands or deck order', () => {
    const state = new LostCitiesState() as LostCitiesState &
      Record<string, unknown>;
    const player = new LostCitiesPlayer() as LostCitiesPlayer &
      Record<string, unknown>;
    player.handCount = 8;
    state.deckCount = 44;
    expect(player.handCount).toBe(8);
    expect(player.expeditions.yellow.cards).toBeDefined();
    expect(player.hand).toBeUndefined();
    expect(state.deck).toBeUndefined();
    expect(state.hands).toBeUndefined();
  });
});
