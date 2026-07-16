import type { Card } from './types';

let sequence = 0;
const makeId = () => `c_${sequence++}`;

export function createDeck(): Card[] {
  const deck: Card[] = [];
  const colors = ['red', 'yellow', 'green', 'blue'] as const;

  for (const color of colors) {
    for (let number = 1; number <= 6; number++) {
      deck.push({ id: makeId(), color, type: 'number', number });
    }

    deck.push({ id: makeId(), color, type: 'jump' });
    deck.push({ id: makeId(), color, type: 'reverse' });
    deck.push({ id: makeId(), color, type: 'plus1' });
    deck.push({ id: makeId(), color, type: 'wild' });
    deck.push({ id: makeId(), color, type: 'attack2' });
    deck.push({ id: makeId(), color, type: 'attack3' });
  }

  deck.push({ id: makeId(), color: 'red', type: 'oz' });
  deck.push({ id: makeId(), color: 'yellow', type: 'mihile' });
  deck.push({ id: makeId(), color: 'blue', type: 'hawkeye' });
  deck.push({ id: makeId(), color: 'green', type: 'irina' });
  deck.push({ id: makeId(), color: 'purple', type: 'ikart' });

  return shuffle(deck);
}

export function shuffle<T>(values: T[], random = Math.random): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}
