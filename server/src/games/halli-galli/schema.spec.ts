import { HalliGalliPlayer, HalliGalliState } from './schema';

describe('Halli Galli schema', () => {
  it('stores only public table state', () => {
    const state = new HalliGalliState();
    const player = new HalliGalliPlayer();
    player.sessionId = 'p1';
    player.nickname = '라임';
    player.deckCount = 13;
    player.topCard.id = 'lime-1';
    player.topCard.fruit = 'lime';
    player.topCard.count = 1;
    state.players.set(player.sessionId, player);
    state.boardRevision = 2;
    expect(state.players.get('p1')?.topCard.fruit).toBe('lime');
    expect(state.boardRevision).toBe(2);
    expect('decks' in state).toBe(false);
  });
});
