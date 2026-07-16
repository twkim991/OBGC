import { traceYutMove } from './board';
import { drawSkills } from './skills';
import { throwYut } from './throw';

describe('yutnori domain', () => {
  it('uses the shortcut when a piece starts on a branch node', () => {
    expect(traceYutMove(5, 2)).toEqual([20, 21]);
  });

  it('supports backward movement', () => {
    expect(traceYutMove(3, -2)).toEqual([2, 1]);
  });

  it('accepts deterministic random sources', () => {
    expect(throwYut(() => 0).name).toBe('개');
    expect(drawSkills(2, () => 0)).toHaveLength(2);
  });
});
