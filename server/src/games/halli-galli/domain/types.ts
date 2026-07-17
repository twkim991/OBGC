export const HALLI_GALLI_FRUITS = [
  'strawberry',
  'banana',
  'lime',
  'plum',
] as const;

export type HalliGalliFruit = (typeof HALLI_GALLI_FRUITS)[number];

export interface HalliGalliCard {
  id: string;
  fruit: HalliGalliFruit;
  count: number;
}

export type FruitTotals = Record<HalliGalliFruit, number>;
