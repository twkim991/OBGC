import { scoreCompletedGame, scoreStalemate } from './scoring';
import type { RummikubTile } from './types';

const numberTile = (id: string, number: number): RummikubTile => ({
  id,
  color: 'red',
  number,
  isJoker: false,
});
const joker: RummikubTile = { id: 'joker', color: 'joker', number: 0, isJoker: true };

describe('rummikub scoring', () => {
  it('awards the winner all loser penalties', () => {
    const result = scoreCompletedGame(
      new Map([
        ['a', []],
        ['b', [numberTile('b', 8)]],
        ['c', [joker]],
      ]),
      'a',
    );
    expect(result.scores).toEqual(new Map([['a', 38], ['b', -8], ['c', -30]]));
  });

  it('uses the lowest rack value when the pool is exhausted', () => {
    const result = scoreStalemate(
      new Map([
        ['a', [numberTile('a', 4)]],
        ['b', [numberTile('b', 9)]],
      ]),
    );
    expect(result.winnerSessionId).toBe('a');
    expect(result.scores).toEqual(new Map([['b', -5], ['a', 5]]));
  });
});

