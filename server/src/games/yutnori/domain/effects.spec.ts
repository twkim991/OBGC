import {
  getEmptyTitanNodes,
  hasFinishedAllPieces,
  resolveCaptures,
  resolveSkillActivation,
  resolveTitanCollision,
  resolveYutThrow,
  selectRandomNode,
} from './effects';

describe('yutnori effects', () => {
  it('duplicates and reverses throws through skills', () => {
    const original = { name: '걸', steps: 3, weight: 345 };
    expect(resolveYutThrow(original, 'BACK_GEAR').throws).toEqual([-3]);
    expect(resolveYutThrow(original, 'DOUBLE_CAST').throws).toEqual([3, 3]);
  });

  it('ends a nak throw without creating a movement result', () => {
    const nak = { name: '낙', steps: 0, weight: 20 };
    expect(resolveYutThrow(nak)).toMatchObject({
      throws: [],
      keepsThrowing: false,
    });
    expect(resolveYutThrow(nak, 'DOUBLE_CAST')).toMatchObject({
      throws: [],
      consumeSkill: true,
    });
    expect(resolveYutThrow(nak, 'MO_MAGNET').result.name).toBe('모');
  });

  it('resolves titan collisions without mutating state', () => {
    expect(resolveTitanCollision([2, 3, 4], [3], false)).toEqual({
      endPosition: 0,
      eaten: true,
      consumedTitanIndex: 0,
      passedTitanCount: 0,
    });
    expect(resolveTitanCollision([2, 3, 4], [3], true).endPosition).toBe(4);
  });

  it('finds available titan nodes', () => {
    const result = getEmptyTitanNodes([1, 2], [3]);
    expect(result).not.toContain(1);
    expect(result).not.toContain(3);
    expect(result).toContain(4);
  });

  it('captures visible opponents but preserves stealth pieces', () => {
    const result = resolveCaptures(
      [
        { sessionId: 'me', pieces: [{ position: 5, isStealth: false }] },
        {
          sessionId: 'other',
          pieces: [
            { position: 5, isStealth: false },
            { position: 5, isStealth: true },
          ],
        },
      ],
      'me',
      5,
    );
    expect(result.captured).toEqual([{ sessionId: 'other', pieceIndex: 0 }]);
    expect(result.stealthOverlapCount).toBe(1);
    expect(hasFinishedAllPieces([{ position: 99 }, { position: 99 }])).toBe(true);
  });

  it('classifies immediate and armed skill activation', () => {
    const base = { availableSkills: ['EARTHQUAKE', 'STEALTH_MODE'], activeSkill: '', usedSkillThisTurn: false };
    expect(resolveSkillActivation({ ...base, skillId: 'EARTHQUAKE' }).kind).toBe('earthquake');
    expect(resolveSkillActivation({ ...base, skillId: 'STEALTH_MODE' }).kind).toBe('arm');
  });

  it('selects titan nodes with an injectable random source', () => {
    expect(selectRandomNode([], () => 0.5)).toBeNull();
    expect(selectRandomNode([3, 7, 11], () => 0)).toBe(3);
    expect(selectRandomNode([3, 7, 11], () => 0.99)).toBe(11);
  });
});
