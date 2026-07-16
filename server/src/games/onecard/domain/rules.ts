import type { Card } from './types';

export function isAttackCard(card: Card): boolean {
  return ['attack2', 'attack3', 'oz'].includes(card.type);
}

export function getAttackValue(card: Card): number {
  switch (card.type) {
    case 'attack2':
      return 2;
    case 'attack3':
      return 3;
    case 'oz':
      return 5;
    default:
      return 0;
  }
}

export function canDefendAttack(incoming: Card, response: Card): boolean {
  if (incoming.type === 'oz') {
    return response.type === 'mihile' || response.type === 'ikart';
  }

  if (response.type === 'mihile' || response.type === 'ikart') return true;
  if (!isAttackCard(response)) return false;
  return getAttackValue(response) >= getAttackValue(incoming);
}

const SPECIAL_CARD_TYPES = new Set([
  'jump',
  'reverse',
  'plus1',
  'wild',
  'attack2',
  'attack3',
  'oz',
  'mihile',
  'hawkeye',
  'irina',
  'ikart',
]);

export interface CardPlayContext {
  card: Card;
  topCard: Card | null;
  currentColor: string;
  pendingAttack: number;
}

export function canPlayCard({
  card,
  topCard,
  currentColor,
  pendingAttack,
}: CardPlayContext): boolean {
  if (pendingAttack > 0) {
    return topCard !== null && canDefendAttack(topCard, card);
  }

  if (card.type === 'ikart' || !topCard) return true;
  if (card.color === currentColor) return true;

  if (
    card.type === 'number' &&
    topCard.type === 'number' &&
    card.number === topCard.number
  ) {
    return true;
  }

  if (
    SPECIAL_CARD_TYPES.has(card.type) &&
    SPECIAL_CARD_TYPES.has(topCard.type) &&
    card.type === topCard.type
  ) {
    return true;
  }

  return (
    isAttackCard(card) &&
    isAttackCard(topCard) &&
    (card.color === currentColor ||
      getAttackValue(card) === getAttackValue(topCard))
  );
}
