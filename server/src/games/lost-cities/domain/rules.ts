import {
  LOST_CITIES_COLORS,
  type LostCitiesCard,
  type LostCitiesRoutes,
} from './types';

export function createEmptyLostCitiesRoutes(): LostCitiesRoutes {
  return Object.fromEntries(
    LOST_CITIES_COLORS.map((color) => [color, []]),
  ) as LostCitiesRoutes;
}

export function canPlayLostCitiesCard(
  card: LostCitiesCard,
  expedition: LostCitiesCard[],
) {
  if (expedition.length === 0) return true;
  if (card.kind === 'wager')
    return expedition.every((candidate) => candidate.kind === 'wager');
  const lastNumber = [...expedition]
    .reverse()
    .find((candidate) => candidate.kind === 'number');
  return !lastNumber || card.value > lastNumber.value;
}

export function scoreLostCitiesExpedition(expedition: LostCitiesCard[]) {
  if (expedition.length === 0) return 0;
  const wagerCount = expedition.filter((card) => card.kind === 'wager').length;
  const numberSum = expedition.reduce((sum, card) => sum + card.value, 0);
  const routeScore = (numberSum - 20) * (wagerCount + 1);
  return routeScore + (expedition.length >= 8 ? 20 : 0);
}

export function scoreLostCitiesRoutes(routes: LostCitiesRoutes) {
  return LOST_CITIES_COLORS.reduce(
    (total, color) => total + scoreLostCitiesExpedition(routes[color]),
    0,
  );
}
