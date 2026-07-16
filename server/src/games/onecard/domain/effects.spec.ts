import { resolveCardEffect } from './effects';
import type { Card } from './types';

const card = (type: Card['type'], color: Card['color'] = 'red'): Card => ({
  id: type,
  type,
  color,
});

describe('one-card effects', () => {
  it('keeps the turn for plus1 and two-player jump', () => {
    expect(
      resolveCardEffect({
        card: card('plus1'),
        pendingAttack: 0,
        alivePlayerCount: 3,
        currentColor: 'red',
        topCardBefore: null,
      }).turnStep,
    ).toBe(0);
    expect(
      resolveCardEffect({
        card: card('jump'),
        pendingAttack: 0,
        alivePlayerCount: 2,
        currentColor: 'red',
        topCardBefore: null,
      }).turnStep,
    ).toBe(0);
  });

  it('normalizes green Irina choices to red', () => {
    expect(
      resolveCardEffect({
        card: card('irina', 'green'),
        chosenColor: 'green',
        pendingAttack: 0,
        alivePlayerCount: 3,
        currentColor: 'green',
        topCardBefore: null,
      }).currentColor,
    ).toBe('red');
  });
});
