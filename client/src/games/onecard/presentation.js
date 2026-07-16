export function colorKoreanName(color) {
  const names = { red: '빨강', yellow: '노랑', green: '초록', blue: '파랑', purple: '보라' };
  return names[color] || '없음';
}

export function cardTypeLabel(card) {
  if (!card) return 'CARD';
  if (card.type === 'number') return 'NUMBER';
  if (['attack2', 'attack3'].includes(card.type)) return 'ATTACK';
  return card.type.toUpperCase();
}

export function cardFace(card) {
  if (!card) return '–';
  if (card.type === 'number') return card.number;
  const faces = {
    attack2: '+2', attack3: '+3', plus1: '+1', oz: '+5',
    jump: 'J', reverse: 'R', wild: 'W', ikart: 'W',
  };
  return faces[card.type] || card.type.slice(0, 2).toUpperCase();
}

export function formatCard(card) {
  if (!card) return '카드 없음';
  const color = colorKoreanName(card.color);
  return card.type === 'number' ? `${color} ${card.number}` : `${color} ${cardTypeLabel(card)}`;
}
