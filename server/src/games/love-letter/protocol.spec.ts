import { parseChancellorPayload, parseLoveLetterPlayPayload } from './protocol';

describe('love letter protocol', () => {
  it('parses a guarded card play and rejects unknown guesses', () => {
    expect(parseLoveLetterPlayPayload({ cardId: 'guard-1', targetSessionId: 'b', guessedCharacter: 'princess', turnRevision: 3 })).toEqual({
      cardId: 'guard-1', targetSessionId: 'b', guessedCharacter: 'princess', turnRevision: 3,
    });
    expect(parseLoveLetterPlayPayload({ cardId: 'guard-1', guessedCharacter: 'wizard', turnRevision: 3 })).toBeNull();
  });

  it('keeps Chancellor bottom order explicit', () => {
    expect(parseChancellorPayload({ keepCardId: 'a', returnCardIds: ['b', 'c'], turnRevision: 4 })).toEqual({ keepCardId: 'a', returnCardIds: ['b', 'c'], turnRevision: 4 });
    expect(parseChancellorPayload({ keepCardId: 'a', returnCardIds: [], turnRevision: 4 })).toBeNull();
  });
});
