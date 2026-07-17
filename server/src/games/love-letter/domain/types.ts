export const LOVE_LETTER_CHARACTERS = [
  'spy',
  'guard',
  'priest',
  'baron',
  'handmaid',
  'prince',
  'chancellor',
  'king',
  'countess',
  'princess',
] as const;

export type LoveLetterCharacter = (typeof LOVE_LETTER_CHARACTERS)[number];

export interface LoveLetterCard {
  id: string;
  character: LoveLetterCharacter;
  value: number;
}

export const LOVE_LETTER_CARD_COUNTS: Record<LoveLetterCharacter, number> = {
  spy: 2,
  guard: 6,
  priest: 2,
  baron: 2,
  handmaid: 2,
  prince: 2,
  chancellor: 2,
  king: 1,
  countess: 1,
  princess: 1,
};
