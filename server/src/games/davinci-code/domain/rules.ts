import type { DavinciCodeTile, DavinciTile } from './types';

export function compareDavinciTiles(
  first: DavinciTile,
  second: DavinciTile,
) {
  if (first.number !== second.number) return first.number - second.number;
  if (first.color === second.color) return first.id.localeCompare(second.id);
  return first.color === 'dark' ? -1 : 1;
}

export function sortDavinciCode(
  tiles: readonly DavinciCodeTile[],
): DavinciCodeTile[] {
  return [...tiles].sort(compareDavinciTiles);
}

export function insertDavinciTile(
  code: readonly DavinciCodeTile[],
  tile: DavinciTile,
  revealed: boolean,
) {
  return sortDavinciCode([...code, { ...tile, revealed }]);
}

export function isDavinciCodeExposed(code: readonly DavinciCodeTile[]) {
  return code.length > 0 && code.every((tile) => tile.revealed);
}
