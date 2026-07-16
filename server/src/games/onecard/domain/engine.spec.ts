import { dealOneCardGame, getNextTurnId, rankPlayers } from './engine';

describe('one-card engine', () => {
  it('moves in both directions and supports skipped players', () => {
    const playerIds = ['a', 'b', 'c'];
    expect(getNextTurnId({ playerIds, currentTurnId: 'a', direction: 1 })).toBe('b');
    expect(getNextTurnId({ playerIds, currentTurnId: 'a', direction: -1, step: 2 })).toBe('b');
  });

  it('ranks the winner first and bankrupt players last', () => {
    expect(
      rankPlayers(
        [
          { sessionId: 'a', bankrupt: false, handCount: 3 },
          { sessionId: 'b', bankrupt: false, handCount: 0 },
          { sessionId: 'c', bankrupt: true, handCount: 1 },
        ],
        'b',
        { a: 0, b: 1, c: 2 },
      ),
    ).toEqual(['b', 'a', 'c']);
  });

  it('deals private hands and never opens Ikart as the first card', () => {
    const cards = [
      { id: '1', type: 'number' }, { id: '2', type: 'number' },
      { id: '3', type: 'ikart' }, { id: '4', type: 'number' },
    ];
    const dealt = dealOneCardGame(cards, ['a'], 2, (values) => [...values].reverse());
    expect(dealt.hands.get('a')?.map((card) => card.id)).toEqual(['1', '2']);
    expect(dealt.firstCard?.type).not.toBe('ikart');
  });
});
