import { SplendorState } from './schema';

describe('splendor public schema', () => {
  it('does not expose deck order or reserved card identities', () => {
    const state = new SplendorState() as SplendorState & Record<string, unknown>;
    expect(state.decks).toBeUndefined();
    expect(state.reservedCards).toBeUndefined();
    expect(state.tierOne).toBeDefined();
    expect(state.players).toBeDefined();
  });
});
