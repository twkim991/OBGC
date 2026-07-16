export type CardColor = 'red' | 'yellow' | 'green' | 'blue' | 'purple';

export type CardType =
  | 'number'
  | 'jump'
  | 'reverse'
  | 'plus1'
  | 'wild'
  | 'attack2'
  | 'attack3'
  | 'oz'
  | 'mihile'
  | 'hawkeye'
  | 'irina'
  | 'ikart';

export interface Card {
  id: string;
  color: CardColor;
  type: CardType;
  number?: number;
}
