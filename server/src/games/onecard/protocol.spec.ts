import { parsePlayCardPayload } from './protocol';

describe('one-card protocol', () => {
  it('accepts selectable colors only', () => {
    expect(parsePlayCardPayload({ cardId: 'card-1', chosenColor: 'blue' })).toEqual({
      cardId: 'card-1',
      chosenColor: 'blue',
    });
    expect(parsePlayCardPayload({ cardId: 'card-1', chosenColor: 'purple' })).toBeNull();
  });

  it('rejects missing or malformed card IDs', () => {
    expect(parsePlayCardPayload(null)).toBeNull();
    expect(parsePlayCardPayload({ cardId: '' })).toBeNull();
    expect(parsePlayCardPayload({ cardId: 1 })).toBeNull();
  });
});
