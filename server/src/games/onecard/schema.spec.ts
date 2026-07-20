import {
  MapleOneCardState,
  OneCardPlayer,
  toOneCardSchemaCard,
} from './schema';

describe('one-card public schema', () => {
  it('does not expose the deck or player hands', () => {
    const state = new MapleOneCardState();
    const player = new OneCardPlayer();

    expect('deck' in state).toBe(false);
    expect('hand' in player).toBe(false);
    expect('playerId' in player).toBe(false);
    expect(player.handCount).toBe(0);
  });

  it('creates a fresh public schema instance whenever a card is published', () => {
    const source = {
      id: 'green-jump',
      color: 'green' as const,
      type: 'jump' as const,
    };

    const first = toOneCardSchemaCard(source);
    const second = toOneCardSchemaCard(source);

    expect(first).not.toBe(second);
    expect(first.toJSON()).toEqual({
      id: 'green-jump',
      color: 'green',
      type: 'jump',
      number: 0,
    });
    expect(second.toJSON()).toEqual(first.toJSON());
  });
});
