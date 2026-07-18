import {
  SPLENDOR_COLORS,
  type SplendorCard,
  type SplendorNoble,
  type SplendorTier,
} from './types';

const TIER_ROWS: Record<SplendorTier, string> = {
  1: `
0,0,1,1,1,1,0
0,0,1,2,1,1,0
0,0,2,2,0,1,0
0,0,0,0,1,3,1
0,0,0,0,2,1,0
0,0,2,0,2,0,0
0,0,0,0,3,0,0
0,1,0,4,0,0,0
1,0,1,0,1,1,1
1,0,1,0,1,2,1
1,0,1,0,2,2,0
1,0,0,1,3,1,0
1,0,1,0,0,0,2
1,0,0,0,2,0,2
1,0,0,0,0,0,3
1,1,0,0,0,4,0
2,0,0,1,1,1,1
2,0,0,1,2,1,1
2,0,0,2,2,0,1
2,0,3,1,0,0,1
2,0,0,0,0,2,1
2,0,0,2,0,0,2
2,0,0,3,0,0,0
2,1,0,0,4,0,0
3,0,1,1,0,1,1
3,0,1,1,0,1,2
3,0,0,1,0,2,2
3,0,1,3,1,0,0
3,0,2,1,0,0,0
3,0,0,2,0,2,0
3,0,0,0,0,3,0
3,1,0,0,0,0,4
4,0,1,1,1,0,1
4,0,2,1,1,0,1
4,0,2,0,1,0,2
4,0,1,0,0,1,3
4,0,0,2,1,0,0
4,0,2,0,0,2,0
4,0,3,0,0,0,0
4,1,4,0,0,0,0`,
  2: `
0,1,3,2,2,0,0
0,1,3,0,3,0,2
0,2,0,1,4,2,0
0,2,0,0,5,3,0
0,2,5,0,0,0,0
0,3,0,0,0,0,6
1,1,0,2,2,3,0
1,1,0,2,3,0,3
1,2,5,3,0,0,0
1,2,2,0,0,1,4
1,2,0,5,0,0,0
1,3,0,6,0,0,0
2,1,0,0,3,2,2
2,1,2,3,0,3,0
2,2,0,0,1,4,2
2,2,0,0,0,5,3
2,2,0,0,0,5,0
2,3,6,0,0,0,0
3,1,3,0,2,3,0
3,1,2,3,0,0,2
3,2,4,2,0,0,1
3,2,0,5,3,0,0
3,2,0,0,5,0,0
3,3,0,0,6,0,0
4,1,2,0,0,2,3
4,1,0,3,0,2,3
4,2,1,4,2,0,0
4,2,3,0,0,0,5
4,2,0,0,0,0,5
4,3,0,0,0,6,0`,
  3: `
0,3,3,3,5,3,0
0,4,0,0,0,7,0
0,4,0,0,3,6,3
0,5,0,0,0,7,3
1,3,3,0,3,3,5
1,4,7,0,0,0,0
1,4,6,3,0,0,3
1,5,7,3,0,0,0
2,3,0,3,3,5,3
2,4,0,0,0,0,7
2,4,3,0,0,3,6
2,5,3,0,0,0,7
3,3,5,3,0,3,3
3,4,0,7,0,0,0
3,4,3,6,3,0,0
3,5,0,7,3,0,0
4,3,3,5,3,0,3
4,4,0,0,7,0,0
4,4,0,3,6,3,0
4,5,0,0,7,3,0`,
};

const NOBLE_ROWS = `
3,0,0,3,3,3
3,3,3,3,0,0
3,3,3,0,0,3
3,0,3,3,3,0
3,3,0,0,3,3
3,4,4,0,0,0
3,0,4,4,0,0
3,0,0,4,4,0
3,4,0,0,0,4
3,0,0,0,4,4`;

const toGemCounts = (values: number[]) => Object.fromEntries(
  SPLENDOR_COLORS.map((color, index) => [color, values[index] ?? 0]),
) as Record<(typeof SPLENDOR_COLORS)[number], number>;

export function createSplendorCards(): SplendorCard[] {
  return ([1, 2, 3] as SplendorTier[]).flatMap((tier) =>
    TIER_ROWS[tier].trim().split('\n').map((row, index) => {
      const [suit, prestige, ...cost] = row.split(',').map(Number);
      return {
        id: `splendor-${tier}-${String(index + 1).padStart(2, '0')}`,
        tier,
        bonus: SPLENDOR_COLORS[suit],
        prestige,
        cost: toGemCounts(cost),
      };
    }),
  );
}

export function createSplendorNobles(): SplendorNoble[] {
  return NOBLE_ROWS.trim().split('\n').map((row, index) => {
    const [prestige, ...requirement] = row.split(',').map(Number);
    return {
      id: `splendor-noble-${String(index + 1).padStart(2, '0')}`,
      prestige,
      requirement: toGemCounts(requirement),
    };
  });
}
