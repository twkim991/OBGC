import { SPLENDOR_COLORS, type SplendorCard, type SplendorTier } from './types';

export const SPLENDOR_GOLD_COUNT = 5;

export function getSplendorGemCount(playerCount: number) {
  if (playerCount === 2) return 4;
  if (playerCount === 3) return 5;
  return 7;
}

export function getSplendorNobleCount(playerCount: number) {
  return playerCount + 1;
}

export function createEmptyGemCounts() {
  return Object.fromEntries(SPLENDOR_COLORS.map((color) => [color, 0])) as Record<(typeof SPLENDOR_COLORS)[number], number>;
}

export function createEmptyTokenCounts() {
  return { ...createEmptyGemCounts(), gold: 0 };
}

export function shuffleSplendorItems<T>(items: readonly T[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function splitSplendorDecks(cards: readonly SplendorCard[]) {
  return new Map<SplendorTier, SplendorCard[]>(
    ([1, 2, 3] as SplendorTier[]).map((tier) => [
      tier,
      shuffleSplendorItems(cards.filter((card) => card.tier === tier)),
    ]),
  );
}
