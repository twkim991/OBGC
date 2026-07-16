export const RUMMIKUB_COLORS = ['red', 'blue', 'yellow', 'black'] as const;

export type RummikubColor = (typeof RUMMIKUB_COLORS)[number];

export interface RummikubTile {
  id: string;
  color: RummikubColor | 'joker';
  number: number;
  isJoker: boolean;
}

export type RummikubMeld = RummikubTile[];

export type MeldKind = 'group' | 'run';

export interface MeldAnalysis {
  kind: MeldKind;
  score: number;
  jokerValues: number[];
}

