import { validateRummikubCommit } from './engine';
import type { RummikubColor, RummikubTile } from './types';

const tile = (id: string, color: RummikubColor, number: number): RummikubTile => ({
  id,
  color,
  number,
  isJoker: false,
});

describe('rummikub turn engine', () => {
  const board = [[tile('r5', 'red', 5), tile('b5', 'blue', 5), tile('y5', 'yellow', 5)]];

  it('accepts a 30-point initial meld without changing the previous board', () => {
    const hand = [tile('r10', 'red', 10), tile('b10', 'blue', 10), tile('y10', 'yellow', 10)];
    const result = validateRummikubCommit({
      previousMelds: board,
      hand,
      candidateMeldTileIds: [board[0].map((item) => item.id), hand.map((item) => item.id)],
      hasInitialMeld: false,
      currentRevision: 2,
      baseRevision: 2,
    });
    expect(result).toMatchObject({ ok: true, initialMeldScore: 30, hand: [] });
  });

  it('rejects a changed board before the initial meld', () => {
    const hand = [tile('k5', 'black', 5), tile('r10', 'red', 10), tile('b10', 'blue', 10), tile('y10', 'yellow', 10)];
    expect(
      validateRummikubCommit({
        previousMelds: board,
        hand,
        candidateMeldTileIds: [
          [...board[0].map((item) => item.id), 'k5'],
          ['r10', 'b10', 'y10'],
        ],
        hasInitialMeld: false,
        currentRevision: 1,
        baseRevision: 1,
      }),
    ).toEqual({ ok: false, code: 'INITIAL_MELD_REQUIRED' });
  });

  it('rejects stale revisions and missing public tiles', () => {
    const hand = [tile('k5', 'black', 5)];
    expect(
      validateRummikubCommit({
        previousMelds: board,
        hand,
        candidateMeldTileIds: [[...board[0].map((item) => item.id), 'k5']],
        hasInitialMeld: true,
        currentRevision: 3,
        baseRevision: 2,
      }),
    ).toEqual({ ok: false, code: 'STALE_BOARD_REVISION' });

    expect(
      validateRummikubCommit({
        previousMelds: board,
        hand,
        candidateMeldTileIds: [['r5', 'b5', 'k5']],
        hasInitialMeld: true,
        currentRevision: 3,
        baseRevision: 3,
      }),
    ).toEqual({ ok: false, code: 'BOARD_TILE_MISSING' });
  });
});

