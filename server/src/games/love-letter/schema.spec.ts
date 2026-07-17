import { LoveLetterState } from './schema';

describe('love letter public schema', () => {
  it('does not expose hands or cumulative played-card history', () => {
    const state = new LoveLetterState() as LoveLetterState & Record<string, unknown>;
    expect(state.hands).toBeUndefined();
    expect(state.playedCards).toBeUndefined();
    expect(state.discardPiles).toBeUndefined();
    expect(state.lastPlayedCard).toBeDefined();
  });
});
