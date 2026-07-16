import { parseCommitTurnPayload } from './protocol';

describe('rummikub protocol', () => {
  it('accepts a bounded board submission', () => {
    expect(
      parseCommitTurnPayload({
        baseRevision: 3,
        melds: [{ tileIds: ['a', 'b', 'c'] }],
      }),
    ).toEqual({ baseRevision: 3, melds: [{ tileIds: ['a', 'b', 'c'] }] });
  });

  it('rejects malformed and undersized melds', () => {
    expect(parseCommitTurnPayload(null)).toBeNull();
    expect(parseCommitTurnPayload({ baseRevision: -1, melds: [] })).toBeNull();
    expect(
      parseCommitTurnPayload({ baseRevision: 0, melds: [{ tileIds: ['a', 'b'] }] }),
    ).toBeNull();
  });
});

