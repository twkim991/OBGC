import {
  SPLENDOR_COLORS,
  type SplendorCard,
  type SplendorColor,
  type SplendorGemCounts,
  type SplendorNoble,
  type SplendorTokenCounts,
} from './types';

export const SPLENDOR_MAX_TOKENS = 10;
export const SPLENDOR_MAX_RESERVED = 3;
export const SPLENDOR_WIN_PRESTIGE = 15;

export function getSplendorTokenTotal(tokens: SplendorTokenCounts) {
  return Object.values(tokens).reduce((sum, count) => sum + count, 0);
}

export function validateSplendorGemTake(
  selection: Partial<SplendorGemCounts>,
  bank: SplendorTokenCounts,
) {
  const chosen = SPLENDOR_COLORS.filter((color) => (selection[color] ?? 0) > 0);
  const total = chosen.reduce((sum, color) => sum + (selection[color] ?? 0), 0);
  const different = chosen.length === 3 && total === 3 && chosen.every((color) => selection[color] === 1 && bank[color] >= 1);
  const same = chosen.length === 1 && total === 2 && selection[chosen[0]] === 2 && bank[chosen[0]] >= 4;
  return different || same;
}

export function getSplendorPayment(
  card: SplendorCard,
  tokens: SplendorTokenCounts,
  bonuses: SplendorGemCounts,
): SplendorTokenCounts | null {
  const payment: SplendorTokenCounts = { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
  let availableGold = tokens.gold;
  for (const color of SPLENDOR_COLORS) {
    let required = Math.max(0, card.cost[color] - bonuses[color]);
    payment[color] = Math.min(tokens[color], required);
    required -= payment[color];
    const gold = Math.min(availableGold, required);
    payment.gold += gold;
    availableGold -= gold;
    required -= gold;
    if (required > 0) return null;
  }
  return payment;
}

export function getEligibleSplendorNobles(
  nobles: readonly SplendorNoble[],
  bonuses: SplendorGemCounts,
) {
  return nobles.filter((noble) =>
    SPLENDOR_COLORS.every((color) => bonuses[color] >= noble.requirement[color]),
  );
}

export function canReturnSplendorTokens(
  tokens: SplendorTokenCounts,
  returned: Partial<SplendorTokenCounts>,
) {
  const returnTotal = Object.values(returned).reduce((sum, count) => sum + (count ?? 0), 0);
  if (returnTotal !== Math.max(0, getSplendorTokenTotal(tokens) - SPLENDOR_MAX_TOKENS)) return false;
  return [...SPLENDOR_COLORS, 'gold' as const].every((color) => {
    const count = returned[color] ?? 0;
    return Number.isInteger(count) && count >= 0 && count <= tokens[color];
  });
}

export function getSplendorRankings<T extends { id: string; prestige: number; developmentCount: number }>(players: readonly T[]) {
  return [...players].sort((left, right) =>
    right.prestige - left.prestige ||
    left.developmentCount - right.developmentCount ||
    players.indexOf(left) - players.indexOf(right),
  );
}

export function getSplendorWinnerIds<T extends { id: string; prestige: number; developmentCount: number }>(players: readonly T[]) {
  const ranked = getSplendorRankings(players);
  const first = ranked[0];
  return first ? ranked.filter((player) => player.prestige === first.prestige && player.developmentCount === first.developmentCount).map((player) => player.id) : [];
}

export function addGemCounts(target: SplendorGemCounts, color: SplendorColor, amount: number) {
  target[color] += amount;
}
