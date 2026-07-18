export const LOST_CITIES_COLORS = [
  'yellow',
  'blue',
  'white',
  'green',
  'red',
] as const;

export type LostCitiesColor = (typeof LOST_CITIES_COLORS)[number];
export type LostCitiesCardKind = 'wager' | 'number';

export interface LostCitiesCard {
  id: string;
  color: LostCitiesColor;
  kind: LostCitiesCardKind;
  value: number;
}

export type LostCitiesRoutes = Record<LostCitiesColor, LostCitiesCard[]>;
