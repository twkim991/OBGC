import {
  buildDavinciRankings,
  getNextDavinciPlayerId,
  resolveDavinciGuess,
} from './engine';

const code = [
  { id: 'a', color: 'dark' as const, number: 2, revealed: false },
  { id: 'b', color: 'light' as const, number: 7, revealed: false },
];

describe('davinci code engine', () => {
  it('reveals only the correctly guessed tile', () => {
    const result = resolveDavinciGuess(code, 'b', 7);
    expect(result).toMatchObject({ ok: true, correct: true });
    if (result.ok) expect(result.code.map((tile) => tile.revealed)).toEqual([false, true]);
  });

  it('keeps the code unchanged after a wrong guess', () => {
    const result = resolveDavinciGuess(code, 'a', 5);
    expect(result).toMatchObject({ ok: true, correct: false, code });
  });

  it('rejects invalid and already revealed targets', () => {
    expect(resolveDavinciGuess(code, 'missing', 1)).toEqual({
      ok: false,
      code: 'TILE_NOT_FOUND',
    });
    expect(
      resolveDavinciGuess([{ ...code[0], revealed: true }], 'a', 2),
    ).toEqual({ ok: false, code: 'TILE_ALREADY_REVEALED' });
  });

  it('advances active turns and ranks the last survivor first', () => {
    expect(getNextDavinciPlayerId(['a', 'c'], 'a')).toBe('c');
    expect(buildDavinciRankings('c', ['b', 'a'])).toEqual(['c', 'a', 'b']);
  });
});
