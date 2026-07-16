const NEXT_NODE: Record<number, number> = {
  0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9,
  9: 10, 10: 11, 11: 12, 12: 13, 13: 14, 14: 15, 15: 16,
  16: 17, 17: 18, 18: 19, 19: 99, 20: 21, 21: 22, 23: 24,
  24: 15, 25: 26, 26: 22, 22: 27, 27: 28, 28: 99,
};

const FAST_NODE: Record<number, number> = { 5: 20, 10: 25, 22: 27 };

const PREVIOUS_NODE: Record<number, number> = {
  1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8,
  10: 9, 11: 10, 12: 11, 13: 12, 14: 13, 15: 14, 16: 15,
  17: 16, 18: 17, 19: 18, 0: 19, 20: 5, 21: 20, 25: 10,
  26: 25, 22: 21, 27: 22, 28: 27, 23: 22, 24: 23,
};

export function traceYutMove(startPosition: number, steps: number): number[] {
  const path: number[] = [];
  let current = startPosition;
  let previous = startPosition;

  if (steps < 0) {
    for (let index = 0; index < Math.abs(steps); index++) {
      current = PREVIOUS_NODE[current] ?? current;
      path.push(current);
      if (current === 0) break;
    }
    return path;
  }

  for (let index = 0; index < steps; index++) {
    let next: number;
    if (index === 0 && FAST_NODE[current] !== undefined) {
      next = FAST_NODE[current];
    } else if (current === 22 && previous === 21) {
      next = 23;
    } else {
      next = NEXT_NODE[current] ?? 99;
    }

    previous = current;
    current = next;
    path.push(current);
    if (current === 99) break;
  }

  return path;
}
