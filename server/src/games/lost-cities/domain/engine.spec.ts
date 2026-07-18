import {
  buildLostCitiesRankings,
  getLostCitiesWinnerIds,
  getNextLostCitiesPlayerId,
  selectLostCitiesRoundStarter,
} from './engine';

describe('lost cities engine', () => {
  const entries = [
    { sessionId: 'a', roundScore: 12, totalScore: 40 },
    { sessionId: 'b', roundScore: 7, totalScore: 55 },
  ];

  it('alternates turns and lets the round leader start next', () => {
    expect(getNextLostCitiesPlayerId(['a', 'b'], 'a')).toBe('b');
    expect(getNextLostCitiesPlayerId(['a', 'b'], 'b')).toBe('a');
    expect(selectLostCitiesRoundStarter(entries, 'b')).toBe('a');
  });

  it('alternates the starter when round scores tie', () => {
    const tied = entries.map((entry) => ({ ...entry, roundScore: 8 }));
    expect(selectLostCitiesRoundStarter(tied, 'a')).toBe('b');
    expect(selectLostCitiesRoundStarter(tied, 'b')).toBe('a');
  });

  it('ranks totals and preserves tied winners', () => {
    expect(buildLostCitiesRankings(entries)).toEqual(['b', 'a']);
    expect(getLostCitiesWinnerIds(entries)).toEqual(['b']);
    expect(
      getLostCitiesWinnerIds(
        entries.map((entry) => ({ ...entry, totalScore: 50 })),
      ),
    ).toEqual(['a', 'b']);
  });
});
