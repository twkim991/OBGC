import {
  DAVINCI_COLORS,
  type DavinciCodeTile,
  type DavinciColor,
  type DavinciTile,
} from './types';

export const DAVINCI_TILE_COUNT = 24;

export function createDavinciDeck(): DavinciTile[] {
  const tiles: DavinciTile[] = [];
  let sequence = 0;
  for (const color of DAVINCI_COLORS) {
    for (let number = 0; number <= 11; number += 1) {
      tiles.push({ id: `dc_${sequence++}`, color, number });
    }
  }
  return tiles;
}

export function shuffleDavinciTiles<T>(
  values: readonly T[],
  random: () => number = Math.random,
): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function drawDavinciTile(
  pool: DavinciTile[],
  color: DavinciColor,
): DavinciTile | null {
  const index = pool.findIndex((tile) => tile.color === color);
  if (index < 0) return null;
  return pool.splice(index, 1)[0] ?? null;
}

export function drawDavinciCode(
  pool: DavinciTile[],
  colors: readonly DavinciColor[],
): DavinciCodeTile[] | null {
  const available = new Map<DavinciColor, number>();
  DAVINCI_COLORS.forEach((color) => {
    available.set(color, pool.filter((tile) => tile.color === color).length);
  });
  for (const color of colors) {
    const count = available.get(color) ?? 0;
    if (count <= 0) return null;
    available.set(color, count - 1);
  }

  return colors.map((color) => {
    const tile = drawDavinciTile(pool, color) as DavinciTile;
    return { ...tile, revealed: false };
  });
}
