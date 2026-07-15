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
  // 오즈 공격은 일반 공격으로 막을 수 없음
  if (incoming.type === 'oz') {
    return response.type === 'mihile' || response.type === 'ikart';
  }

  // 일반 공격에 대해
  if (response.type === 'mihile') return true;
  if (response.type === 'ikart') return true;

  if (!isAttackCard(response)) return false;

  // 낮은 공격력으로는 못 넘김
  return getAttackValue(response) >= getAttackValue(incoming);
}
