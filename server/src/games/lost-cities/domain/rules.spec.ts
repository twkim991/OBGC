import type { LostCitiesCard } from './types';
import {
  canPlayLostCitiesCard,
  createEmptyLostCitiesRoutes,
  scoreLostCitiesExpedition,
  scoreLostCitiesRoutes,
} from './rules';

const card = (
  id: string,
  value: number,
  kind: LostCitiesCard['kind'] = 'number',
): LostCitiesCard => ({ id, color: 'yellow', kind, value });

describe('lost cities rules', () => {
  it('allows wagers only before numbers and requires strictly increasing numbers', () => {
    const wager = card('w1', 0, 'wager');
    const five = card('5', 5);
    expect(canPlayLostCitiesCard(wager, [])).toBe(true);
    expect(canPlayLostCitiesCard(wager, [wager])).toBe(true);
    expect(canPlayLostCitiesCard(wager, [five])).toBe(false);
    expect(canPlayLostCitiesCard(card('6', 6), [wager, five])).toBe(true);
    expect(canPlayLostCitiesCard(card('5b', 5), [five])).toBe(false);
    expect(canPlayLostCitiesCard(card('4', 4), [five])).toBe(false);
  });

  it('applies the 20-point cost, wager multiplier, and eight-card bonus', () => {
    expect(
      scoreLostCitiesExpedition([
        card('w', 0, 'wager'),
        card('2', 2),
        card('3', 3),
      ]),
    ).toBe(-30);
    const longRoute = [
      card('w', 0, 'wager'),
      ...[2, 3, 4, 5, 6, 7, 8].map((value) => card(String(value), value)),
    ];
    expect(scoreLostCitiesExpedition(longRoute)).toBe(50);
  });

  it('sums the five expedition scores', () => {
    const routes = createEmptyLostCitiesRoutes();
    routes.yellow = [card('10', 10)];
    routes.blue = [
      { ...card('b10', 10), color: 'blue' },
      { ...card('b11', 11), color: 'blue' },
    ];
    expect(scoreLostCitiesRoutes(routes)).toBe(-9);
  });
});
