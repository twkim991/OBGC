import type { LoveLetterCard, LoveLetterCharacter } from './types';

export const FAVOR_TARGETS: Record<number, number> = {
  2: 6,
  3: 5,
  4: 4,
  5: 3,
  6: 3,
};

export function getLoveLetterFavorTarget(playerCount: number) {
  return FAVOR_TARGETS[playerCount] ?? 3;
}

export function mustPlayCountess(hand: readonly LoveLetterCard[]) {
  const characters = new Set(hand.map((card) => card.character));
  return characters.has('countess') &&
    (characters.has('king') || characters.has('prince'));
}

export function canChooseLoveLetterTarget(
  actorId: string,
  targetId: string,
  character: LoveLetterCharacter,
  activeIds: readonly string[],
  protectedIds: ReadonlySet<string>,
) {
  if (!activeIds.includes(targetId)) return false;
  if (character === 'prince' && targetId === actorId) return true;
  if (targetId === actorId || protectedIds.has(targetId)) return false;
  return ['guard', 'priest', 'baron', 'prince', 'king'].includes(character);
}

export function getLoveLetterRoundWinners(
  activeIds: readonly string[],
  hands: ReadonlyMap<string, readonly LoveLetterCard[]>,
) {
  const highest = Math.max(
    ...activeIds.map((id) => hands.get(id)?.[0]?.value ?? -1),
  );
  return activeIds.filter((id) => (hands.get(id)?.[0]?.value ?? -1) === highest);
}

export function getSpyBonusRecipients(
  activeIds: readonly string[],
  spyUsers: ReadonlySet<string>,
) {
  const survivors = activeIds.filter((id) => spyUsers.has(id));
  return survivors.length === 1 ? survivors : [];
}
