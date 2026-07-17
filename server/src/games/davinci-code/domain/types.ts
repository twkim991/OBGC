export const DAVINCI_COLORS = ['light', 'dark'] as const;

export type DavinciColor = (typeof DAVINCI_COLORS)[number];

export interface DavinciTile {
  id: string;
  color: DavinciColor;
  number: number;
}

export interface DavinciCodeTile extends DavinciTile {
  revealed: boolean;
}
