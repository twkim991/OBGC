import {
  HALLI_GALLI_FRUITS,
  type FruitTotals,
  type HalliGalliCard,
  type HalliGalliFruit,
} from './types';

export function getVisibleFruitTotals(
  cards: readonly (HalliGalliCard | null | undefined)[],
): FruitTotals {
  const totals = Object.fromEntries(
    HALLI_GALLI_FRUITS.map((fruit) => [fruit, 0]),
  ) as FruitTotals;
  cards.forEach((card) => {
    if (card) totals[card.fruit] += card.count;
  });
  return totals;
}

export function getExactFiveFruit(
  totals: FruitTotals,
): HalliGalliFruit | null {
  return HALLI_GALLI_FRUITS.find((fruit) => totals[fruit] === 5) ?? null;
}

export function hasExactFive(
  cards: readonly (HalliGalliCard | null | undefined)[],
) {
  return getExactFiveFruit(getVisibleFruitTotals(cards)) !== null;
}
