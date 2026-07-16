import { parseMovePiecePayload, parseSkillId } from './protocol';

describe('yutnori protocol', () => {
  it('accepts bounded piece and throw indexes', () => {
    expect(parseMovePiecePayload({ pieceIndex: 3, throwIndex: 0 })).toEqual({
      pieceIndex: 3,
      throwIndex: 0,
    });
    expect(parseMovePiecePayload({ pieceIndex: 4, throwIndex: 0 })).toBeNull();
    expect(parseMovePiecePayload({ pieceIndex: 0, throwIndex: -1 })).toBeNull();
  });

  it('accepts registered skills only', () => {
    expect(parseSkillId('STEALTH_MODE')).toBe('STEALTH_MODE');
    expect(parseSkillId('UNKNOWN_SKILL')).toBeNull();
    expect(parseSkillId(null)).toBeNull();
  });
});
