import { createEmptyGemCounts, createEmptyTokenCounts } from './setup';
import type { SplendorCard } from './types';
import {
  canReturnSplendorTokens,
  getSplendorPayment,
  getSplendorWinnerIds,
  validateSplendorGemTake,
} from './rules';

const card: SplendorCard = {
  id: 'test', tier: 1, bonus: 'white', prestige: 0,
  cost: { white: 2, blue: 3, green: 0, red: 0, black: 0 },
};

describe('splendor rules', () => {
  it('validates three different gems and a double from a pile of four', () => {
    const bank = { ...createEmptyTokenCounts(), white: 4, blue: 3, green: 1 };
    expect(validateSplendorGemTake({ white: 1, blue: 1, green: 1 }, bank)).toBe(true);
    expect(validateSplendorGemTake({ white: 2 }, bank)).toBe(true);
    expect(validateSplendorGemTake({ blue: 2 }, bank)).toBe(false);
  });

  it('uses permanent bonuses, colored tokens, then gold', () => {
    const tokens = { ...createEmptyTokenCounts(), white: 1, blue: 1, gold: 1 };
    const bonuses = { ...createEmptyGemCounts(), white: 1, blue: 1 };
    expect(getSplendorPayment(card, tokens, bonuses)).toEqual({ white: 1, blue: 1, green: 0, red: 0, black: 0, gold: 1 });
  });

  it('requires exactly the excess tokens to be returned', () => {
    const tokens = { ...createEmptyTokenCounts(), white: 4, blue: 4, green: 3 };
    expect(canReturnSplendorTokens(tokens, { green: 1 })).toBe(true);
    expect(canReturnSplendorTokens(tokens, { green: 2 })).toBe(false);
  });

  it('shares victory only when prestige and development count both tie', () => {
    expect(getSplendorWinnerIds([
      { id: 'a', prestige: 16, developmentCount: 12 },
      { id: 'b', prestige: 16, developmentCount: 10 },
      { id: 'c', prestige: 16, developmentCount: 10 },
    ])).toEqual(['b', 'c']);
  });
});
