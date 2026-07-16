import { getAttackValue } from './rules';
import type { Card, CardColor } from './types';

export type OneCardSpecialEffect = 'none' | 'draw_others' | 'irina';

export interface OneCardEffect {
  currentColor?: string;
  pendingAttack?: number;
  directionMultiplier: 1 | -1;
  activateShield: boolean;
  turnStep: number;
  special: OneCardSpecialEffect;
  drawOtherCount: number;
  actionLabel: string;
}

export interface ResolveCardEffectInput {
  card: Card;
  chosenColor?: string;
  pendingAttack: number;
  alivePlayerCount: number;
  currentColor: string;
  topCardBefore: Card | null;
}

export function normalizePlayableColor(color?: string): CardColor {
  return color === 'red' ||
    color === 'yellow' ||
    color === 'green' ||
    color === 'blue'
    ? color
    : 'red';
}

export function resolveCardEffect({
  card,
  chosenColor,
  pendingAttack,
  alivePlayerCount,
  currentColor,
  topCardBefore,
}: ResolveCardEffectInput): OneCardEffect {
  const base: OneCardEffect = {
    directionMultiplier: 1,
    activateShield: false,
    turnStep: 1,
    special: 'none',
    drawOtherCount: 0,
    actionLabel: card.type,
  };

  switch (card.type) {
    case 'number':
      return { ...base, currentColor: card.color, actionLabel: '숫자 카드' };
    case 'jump':
      return {
        ...base,
        currentColor: card.color,
        turnStep: alivePlayerCount === 2 ? 0 : 2,
        actionLabel: '점프',
      };
    case 'reverse':
      return {
        ...base,
        currentColor: card.color,
        directionMultiplier: -1,
        actionLabel: '리버스',
      };
    case 'plus1':
      return { ...base, currentColor: card.color, turnStep: 0, actionLabel: '+1' };
    case 'wild':
      return {
        ...base,
        currentColor: normalizePlayableColor(chosenColor),
        actionLabel: '색상 변경',
      };
    case 'attack2':
    case 'attack3':
      return {
        ...base,
        currentColor: card.color,
        pendingAttack: pendingAttack + getAttackValue(card),
        actionLabel: card.type === 'attack2' ? '+2 공격' : '+3 공격',
      };
    case 'oz':
      return {
        ...base,
        currentColor: card.color,
        pendingAttack: pendingAttack + 5,
        actionLabel: '오즈 공격',
      };
    case 'mihile':
      return {
        ...base,
        currentColor: card.color,
        pendingAttack: 0,
        activateShield: true,
        actionLabel: '미하일 방어',
      };
    case 'hawkeye':
      return {
        ...base,
        currentColor: card.color,
        special: 'draw_others',
        drawOtherCount: 2,
        actionLabel: '호크아이',
      };
    case 'irina': {
      const color = normalizePlayableColor(chosenColor);
      return {
        ...base,
        currentColor: color === 'green' ? 'red' : color,
        special: 'irina',
        turnStep: 0,
        actionLabel: '이리나',
      };
    }
    case 'ikart':
      return {
        ...base,
        currentColor:
          currentColor ||
          (topCardBefore?.color !== 'purple' ? topCardBefore?.color : undefined),
        actionLabel: '이카르트',
      };
    default:
      return base;
  }
}

export function removeColorFromHands<T extends Card>(
  hands: Map<string, T[]>,
  color: CardColor,
): { hands: Map<string, T[]>; removedCards: T[] } {
  const nextHands = new Map<string, T[]>();
  const removedCards: T[] = [];

  hands.forEach((hand, playerId) => {
    const kept: T[] = [];
    hand.forEach((card) => {
      if (card.color === color) removedCards.push(card);
      else kept.push(card);
    });
    nextHands.set(playerId, kept);
  });

  return { hands: nextHands, removedCards };
}

export function prepareDiscardRefill<T>(
  discardPile: T[],
  reshuffle: (cards: T[]) => T[],
): { topCard: T | null; refillCards: T[] } {
  if (discardPile.length <= 1) {
    return { topCard: discardPile[0] ?? null, refillCards: [] };
  }
  return {
    topCard: discardPile[discardPile.length - 1],
    refillCards: reshuffle(discardPile.slice(0, -1)),
  };
}

export function isBankruptHand(handCount: number, maximum = 17): boolean {
  return handCount > maximum;
}
