import type { LoveLetterCard } from './types';
import {
  canChooseLoveLetterTarget,
  getLoveLetterFavorTarget,
  getLoveLetterRoundWinners,
  getSpyBonusRecipients,
  mustPlayCountess,
} from './rules';

const card = (character: LoveLetterCard['character'], value: number): LoveLetterCard => ({ id: character, character, value });

describe('love letter rules', () => {
  it.each([[2, 6], [3, 5], [4, 4], [5, 3], [6, 3]])('uses the %i-player favor target', (players, target) => {
    expect(getLoveLetterFavorTarget(players)).toBe(target);
  });

  it('forces Countess with King or Prince', () => {
    expect(mustPlayCountess([card('countess', 8), card('king', 7)])).toBe(true);
    expect(mustPlayCountess([card('countess', 8), card('priest', 2)])).toBe(false);
  });

  it('lets Prince target self but blocks protected opponents', () => {
    const active = ['a', 'b'];
    expect(canChooseLoveLetterTarget('a', 'a', 'prince', active, new Set(['b']))).toBe(true);
    expect(canChooseLoveLetterTarget('a', 'b', 'prince', active, new Set(['b']))).toBe(false);
    expect(canChooseLoveLetterTarget('a', 'a', 'guard', active, new Set())).toBe(false);
  });

  it('awards tied highest hands and only a unique surviving Spy user', () => {
    const hands = new Map([
      ['a', [card('king', 7)]],
      ['b', [card('king', 7)]],
      ['c', [card('guard', 1)]],
    ]);
    expect(getLoveLetterRoundWinners(['a', 'b', 'c'], hands)).toEqual(['a', 'b']);
    expect(getSpyBonusRecipients(['a', 'b'], new Set(['a']))).toEqual(['a']);
    expect(getSpyBonusRecipients(['a', 'b'], new Set(['a', 'b']))).toEqual([]);
  });
});
