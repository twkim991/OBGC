import { HALLI_GALLI_FRUITS, type HalliGalliCard } from './types';

// 클래식 덱은 과일마다 1×5, 2×3, 3×3, 4×2, 5×1장으로 구성된다.
const COUNTS_PER_FRUIT = [1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 5];

export function createHalliGalliDeck(): HalliGalliCard[] {
  return HALLI_GALLI_FRUITS.flatMap((fruit) =>
    COUNTS_PER_FRUIT.map((count, index) => ({
      id: `${fruit}-${count}-${index}`,
      fruit,
      count,
    })),
  );
}

export function shuffleHalliGalliCards(
  cards: readonly HalliGalliCard[],
  random: () => number = Math.random,
) {
  const shuffled = cards.map((card) => ({ ...card }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

export function dealHalliGalliCards(
  cards: readonly HalliGalliCard[],
  playerIds: readonly string[],
) {
  const decks = new Map<string, HalliGalliCard[]>(
    playerIds.map((playerId) => [playerId, []]),
  );
  cards.forEach((card, index) => {
    decks.get(playerIds[index % playerIds.length])?.push({ ...card });
  });
  return decks;
}
