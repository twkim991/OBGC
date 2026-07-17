import {
  LOVE_LETTER_CARD_COUNTS,
  LOVE_LETTER_CHARACTERS,
  type LoveLetterCard,
} from './types';

export function createLoveLetterDeck(): LoveLetterCard[] {
  return LOVE_LETTER_CHARACTERS.flatMap((character, value) =>
    Array.from({ length: LOVE_LETTER_CARD_COUNTS[character] }, (_, index) => ({
      id: `${character}-${index + 1}`,
      character,
      value,
    })),
  );
}

export function shuffleLoveLetterCards(cards: readonly LoveLetterCard[]) {
  const shuffled = cards.map((card) => ({ ...card }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}
