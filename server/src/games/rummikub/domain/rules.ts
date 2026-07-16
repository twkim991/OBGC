import type {
  MeldAnalysis,
  RummikubMeld,
  RummikubTile,
} from './types';

function analyzeGroup(tiles: readonly RummikubTile[]): MeldAnalysis | null {
  if (tiles.length < 3 || tiles.length > 4) return null;

  const numberedTiles = tiles.filter((tile) => !tile.isJoker);
  if (numberedTiles.length === 0) return null;

  const number = numberedTiles[0].number;
  if (numberedTiles.some((tile) => tile.number !== number)) return null;

  const colors = new Set(numberedTiles.map((tile) => tile.color));
  if (colors.size !== numberedTiles.length) return null;

  const jokerCount = tiles.length - numberedTiles.length;
  if (colors.size + jokerCount > 4) return null;

  return {
    kind: 'group',
    score: number * tiles.length,
    jokerValues: Array.from({ length: jokerCount }, () => number),
  };
}

function analyzeRun(tiles: readonly RummikubTile[]): MeldAnalysis | null {
  if (tiles.length < 3 || tiles.length > 13) return null;

  const firstNumberedIndex = tiles.findIndex((tile) => !tile.isJoker);
  if (firstNumberedIndex === -1) return null;

  const firstNumbered = tiles[firstNumberedIndex];
  const start = firstNumbered.number - firstNumberedIndex;
  const end = start + tiles.length - 1;
  if (start < 1 || end > 13) return null;

  const color = firstNumbered.color;
  const jokerValues: number[] = [];

  for (let index = 0; index < tiles.length; index++) {
    const tile = tiles[index];
    const expectedNumber = start + index;
    if (tile.isJoker) {
      jokerValues.push(expectedNumber);
      continue;
    }
    if (tile.color !== color || tile.number !== expectedNumber) return null;
  }

  return {
    kind: 'run',
    score: ((start + end) * tiles.length) / 2,
    jokerValues,
  };
}

export function analyzeMeld(
  tiles: readonly RummikubTile[],
): MeldAnalysis | null {
  return analyzeGroup(tiles) ?? analyzeRun(tiles);
}

export function analyzeMelds(melds: readonly RummikubMeld[]) {
  const analyses = melds.map((meld) => analyzeMeld(meld));
  if (analyses.some((analysis) => analysis === null)) return null;
  return analyses as MeldAnalysis[];
}

export function calculateMeldScore(melds: readonly RummikubMeld[]) {
  const analyses = analyzeMelds(melds);
  if (!analyses) return null;
  return analyses.reduce((total, analysis) => total + analysis.score, 0);
}

