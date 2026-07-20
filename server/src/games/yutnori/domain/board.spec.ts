import {
  canMoveYutPiece,
  isBackwardThrowNak,
  traceYutMove,
} from './board';
import { drawSkills } from './skills';
import { throwYut } from './throw';

describe('yutnori domain', () => {
  it('uses the shortcut when a piece starts on a branch node', () => {
    expect(traceYutMove(5, 2)).toEqual([20, 21]);
  });

  it('supports backward movement', () => {
    expect(traceYutMove(3, -2)).toEqual([2, 1]);
  });

  it('does not allow a backward throw from the start position', () => {
    expect(canMoveYutPiece(0, -1)).toBe(false);
    expect(traceYutMove(0, -1)).toEqual([]);
    expect(canMoveYutPiece(1, -1)).toBe(true);
  });

  it('treats a backward throw as nak when every unfinished piece is at start', () => {
    expect(
      isBackwardThrowNak(
        [{ position: 0 }, { position: 0 }, { position: 99 }, { position: 99 }],
        -1,
      ),
    ).toBe(true);
    expect(
      isBackwardThrowNak(
        [{ position: 0 }, { position: 3 }, { position: 99 }],
        -1,
      ),
    ).toBe(false);
    expect(isBackwardThrowNak([{ position: 0 }], 1)).toBe(false);
  });

  it('accepts deterministic random sources', () => {
    expect(throwYut(() => 0).name).toBe('개');
    expect(throwYut(() => 0.979).name).toBe('모');
    expect(throwYut(() => 0.98)).toMatchObject({ name: '낙', steps: 0 });
    expect(drawSkills(2, () => 0)).toHaveLength(2);
  });

  it('assigns exactly two percent of the throw range to nak', () => {
    const outcomes = Array.from({ length: 1000 }, (_, index) =>
      throwYut(() => index / 1000),
    );
    expect(outcomes.filter(({ name }) => name === '낙')).toHaveLength(20);
  });
});
