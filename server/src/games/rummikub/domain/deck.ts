import { RUMMIKUB_COLORS, type RummikubTile } from './types';

export const RUMMIKUB_TILE_COUNT = 106;
export const RUMMIKUB_INITIAL_HAND_SIZE = 14;

export function createRummikubDeck(): RummikubTile[] {
  const tiles: RummikubTile[] = [];
  let sequence = 0;

  for (let copy = 0; copy < 2; copy++) {
    for (const color of RUMMIKUB_COLORS) {
      for (let number = 1; number <= 13; number++) {
        tiles.push({
          id: `r_${sequence++}`,
          color,
          number,
          isJoker: false,
        });
      }
    }
  }

  for (let joker = 0; joker < 2; joker++) {
    tiles.push({
      id: `r_${sequence++}`,
      color: 'joker',
      number: 0,
      isJoker: true,
    });
  }

  return tiles;
}

export function shuffleRummikubTiles<T>(
  values: readonly T[],
  random: () => number = Math.random,
): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

export function dealRummikubGame(
  tiles: readonly RummikubTile[],
  playerIds: readonly string[],
  handSize = RUMMIKUB_INITIAL_HAND_SIZE,
) {
  const pool = [...tiles];
  const hands = new Map<string, RummikubTile[]>();

  playerIds.forEach((playerId) => {
    hands.set(playerId, pool.splice(0, handSize));
  });

  return { hands, pool };
}

