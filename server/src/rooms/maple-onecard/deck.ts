// server/src/rooms/maple-onecard/deck.ts
import { Card } from './types';

let seq = 0;
const makeId = () => `c_${seq++}`;

export function createDeck(): Card[] {
  const deck: Card[] = [];
  const colors = ['red', 'yellow', 'green', 'blue'] as const;

  for (const color of colors) {
    // 숫자 1~6
    for (let n = 1; n <= 6; n++) {
      deck.push({
        id: makeId(),
        color,
        type: 'number',
        number: n,
      });
    }

    // 특수카드 4종
    deck.push({ id: makeId(), color, type: 'jump' });
    deck.push({ id: makeId(), color, type: 'reverse' });
    deck.push({ id: makeId(), color, type: 'plus1' });
    deck.push({ id: makeId(), color, type: 'wild' });

    // 공격 2종
    deck.push({ id: makeId(), color, type: 'attack2' });
    deck.push({ id: makeId(), color, type: 'attack3' });
  }

  // 기사 카드
  deck.push({ id: makeId(), color: 'red', type: 'oz' });
  deck.push({ id: makeId(), color: 'yellow', type: 'mihile' });
  deck.push({ id: makeId(), color: 'blue', type: 'hawkeye' });
  deck.push({ id: makeId(), color: 'green', type: 'irina' });
  deck.push({ id: makeId(), color: 'purple', type: 'ikart' });

  return shuffle(deck);
}

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
