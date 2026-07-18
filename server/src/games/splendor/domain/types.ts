export const SPLENDOR_COLORS = ['white', 'blue', 'green', 'red', 'black'] as const;
export const SPLENDOR_TOKEN_COLORS = [...SPLENDOR_COLORS, 'gold'] as const;

export type SplendorColor = (typeof SPLENDOR_COLORS)[number];
export type SplendorTokenColor = (typeof SPLENDOR_TOKEN_COLORS)[number];
export type SplendorTier = 1 | 2 | 3;

export type SplendorGemCounts = Record<SplendorColor, number>;
export type SplendorTokenCounts = Record<SplendorTokenColor, number>;

export interface SplendorCard {
  id: string;
  tier: SplendorTier;
  bonus: SplendorColor;
  prestige: number;
  cost: SplendorGemCounts;
}

export interface SplendorNoble {
  id: string;
  prestige: number;
  requirement: SplendorGemCounts;
}
