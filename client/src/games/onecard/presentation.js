export function colorKoreanName(color) {
  const names = { red: '빨강', yellow: '노랑', green: '초록', blue: '파랑', purple: '보라' };
  return names[color] || '없음';
}

function getCardType(card) {
  return typeof card?.type === 'string' ? card.type.trim() : '';
}

export function cardTypeLabel(card) {
  const type = getCardType(card);
  if (!type) return 'CARD';
  if (type === 'number') return 'NUMBER';
  if (['attack2', 'attack3'].includes(type)) return 'ATTACK';
  return type.toUpperCase();
}

export function cardFace(card) {
  if (!card) return '–';
  const type = getCardType(card);
  if (!type) return '?';
  if (type === 'number') return card.number ?? '?';
  const faces = {
    attack2: '+2', attack3: '+3', plus1: '+1', oz: '+5',
    jump: 'J', reverse: 'R', wild: 'W', ikart: 'W',
  };
  return faces[type] || type.slice(0, 2).toUpperCase();
}

export function formatCard(card) {
  if (!card) return '카드 없음';
  const type = getCardType(card);
  const color = colorKoreanName(card.color);
  if (!type) return `${color} 카드`;
  return type === 'number' ? `${color} ${card.number ?? '?'}` : `${color} ${cardTypeLabel(card)}`;
}
