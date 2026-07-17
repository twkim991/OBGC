import { insertDavinciTile, isDavinciCodeExposed, sortDavinciCode } from './rules';
import type { DavinciCodeTile } from './types';

const tile = (
  id: string,
  color: 'light' | 'dark',
  number: number,
  revealed = false,
): DavinciCodeTile => ({ id, color, number, revealed });

describe('davinci code rules', () => {
  it('sorts by number with dark before light on ties', () => {
    expect(
      sortDavinciCode([
        tile('l5', 'light', 5),
        tile('d7', 'dark', 7),
        tile('d5', 'dark', 5),
        tile('l1', 'light', 1),
      ]).map((item) => item.id),
    ).toEqual(['l1', 'd5', 'l5', 'd7']);
  });

  it('inserts a drawn tile at its deterministic position', () => {
    const result = insertDavinciTile(
      [tile('d2', 'dark', 2), tile('l8', 'light', 8)],
      { id: 'l2', color: 'light', number: 2 },
      true,
    );
    expect(result.map((item) => item.id)).toEqual(['d2', 'l2', 'l8']);
    expect(result[1].revealed).toBe(true);
  });

  it('detects a fully exposed code', () => {
    expect(isDavinciCodeExposed([tile('a', 'dark', 1, true)])).toBe(true);
    expect(isDavinciCodeExposed([tile('a', 'dark', 1, false)])).toBe(false);
  });
});
