import type { Card } from './types';
import { canPlayCard } from './rules';

const card = (type: Card['type'], color: Card['color'] = 'red', number?: number): Card => ({
  id: `${type}-${color}-${number ?? 0}`,
  type,
  color,
  number,
});

describe('one-card play rules', () => {
  it('allows matching colors and matching numbers', () => {
    const topCard = card('number', 'red', 3);
    expect(
      canPlayCard({ card: card('number', 'red', 1), topCard, currentColor: 'red', pendingAttack: 0 }),
    ).toBe(true);
    expect(
      canPlayCard({ card: card('number', 'blue', 3), topCard, currentColor: 'red', pendingAttack: 0 }),
    ).toBe(true);
  });

  it('uses attack defense rules while an attack is pending', () => {
    expect(
      canPlayCard({
        card: card('attack2'),
        topCard: card('attack3'),
        currentColor: 'red',
        pendingAttack: 3,
      }),
    ).toBe(false);
  });
});
