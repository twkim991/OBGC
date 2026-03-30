import { Card, PlayerState, GameState } from './types';

export function getTopVisibleCard(state: GameState): Card | null {
  if (!state.discardPile.length) return null;
  return state.discardPile[state.discardPile.length - 1];
}

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

export function canPlayCard(
  state: GameState,
  player: PlayerState,
  card: Card,
): boolean {
  const topCard = getTopVisibleCard(state);

  // 공격 진행 중이면 공격 대응 규칙 우선
  if (state.pendingAttack > 0) {
    if (!topCard) return false;
    return canDefendAttack(topCard, card);
  }

  // 이카르트는 언제든 가능
  if (card.type === 'ikart') return true;

  // 첫 카드면 대부분 허용
  if (!topCard) return true;

  // 현재 색상 일치
  if (card.color === state.currentColor) return true;

  // 숫자 카드끼리 숫자 일치
  if (
    card.type === 'number' &&
    topCard.type === 'number' &&
    card.number === topCard.number
  ) {
    return true;
  }

  // 특수카드/기사카드 포함 타입 일치 허용
  // 예: jump 위에 다른 색 jump, reverse 위에 다른 색 reverse
  if (card.type === topCard.type) return true;

  // 공격카드끼리는 일반 상황에서도
  // 색상 일치 또는 공격력 일치면 허용
  if (isAttackCard(card) && isAttackCard(topCard)) {
    return (
      card.color === state.currentColor ||
      getAttackValue(card) === getAttackValue(topCard)
    );
  }

  return false;
}
