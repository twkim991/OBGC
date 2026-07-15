import type { Card } from './types';
import { canDefendAttack, getAttackValue } from './rules';

const card = (type: Card['type']): Card => ({
  id: type,
  color: type === 'ikart' ? 'purple' : 'red',
  type,
});

describe('maple one-card attack rules', () => {
  it('allows only Mihile or Ikart to defend an Oz attack', () => {
    expect(canDefendAttack(card('oz'), card('mihile'))).toBe(true);
    expect(canDefendAttack(card('oz'), card('ikart'))).toBe(true);
    expect(canDefendAttack(card('oz'), card('attack3'))).toBe(false);
  });

  it('rejects a weaker attack response', () => {
    expect(canDefendAttack(card('attack3'), card('attack2'))).toBe(false);
    expect(canDefendAttack(card('attack2'), card('attack3'))).toBe(true);
  });

  it('returns the configured attack values', () => {
    expect(getAttackValue(card('attack2'))).toBe(2);
    expect(getAttackValue(card('attack3'))).toBe(3);
    expect(getAttackValue(card('oz'))).toBe(5);
    expect(getAttackValue(card('number'))).toBe(0);
  });
});
