import { LOST_CITIES_COLORS, type LostCitiesCard } from './types';

export function createLostCitiesDeck(): LostCitiesCard[] {
  return LOST_CITIES_COLORS.flatMap((color) => [
    ...Array.from({ length: 3 }, (_, index) => ({
      id: `${color}-wager-${index + 1}`,
      color,
      kind: 'wager' as const,
      value: 0,
    })),
    ...Array.from({ length: 9 }, (_, index) => ({
      id: `${color}-${index + 2}`,
      color,
      kind: 'number' as const,
      value: index + 2,
    })),
  ]);
}

export function shuffleLostCitiesDeck(
  cards: LostCitiesCard[],
  random: () => number = Math.random,
): LostCitiesCard[] {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

export function dealLostCitiesHands(
  deck: LostCitiesCard[],
  playerIds: string[],
  handSize = 8,
) {
  const remainingDeck = [...deck];
  const hands = new Map<string, LostCitiesCard[]>(
    playerIds.map((id) => [id, []]),
  );
  for (let cardIndex = 0; cardIndex < handSize; cardIndex += 1) {
    playerIds.forEach((playerId) => {
      const card = remainingDeck.pop();
      if (card) hands.get(playerId)?.push(card);
    });
  }
  return { deck: remainingDeck, hands };
}
