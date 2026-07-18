import {
  parseSplendorPurchasePayload,
  parseSplendorReservePayload,
  parseSplendorTakePayload,
} from './protocol';

describe('splendor protocol', () => {
  it('parses bounded token selections', () => {
    expect(parseSplendorTakePayload({ selection: { white: 1, blue: 1, green: 1 }, turnRevision: 2 })).toEqual({
      selection: { white: 1, blue: 1, green: 1, red: 0, black: 0 }, turnRevision: 2,
    });
    expect(parseSplendorTakePayload({ selection: { white: 3 }, turnRevision: 2 })).toEqual({
      selection: { white: 0, blue: 0, green: 0, red: 0, black: 0 }, turnRevision: 2,
    });
  });

  it('requires a card id for market reservations but not blind draws', () => {
    expect(parseSplendorReservePayload({ source: 'deck', tier: 2, turnRevision: 3 })).toEqual({ source: 'deck', cardId: '', tier: 2, turnRevision: 3 });
    expect(parseSplendorReservePayload({ source: 'market', tier: 2, turnRevision: 3 })).toBeNull();
  });

  it('accepts only market or reserved purchases', () => {
    expect(parseSplendorPurchasePayload({ source: 'reserved', cardId: 'x', turnRevision: 1 })).toEqual({ source: 'reserved', cardId: 'x', turnRevision: 1 });
    expect(parseSplendorPurchasePayload({ source: 'deck', cardId: 'x', turnRevision: 1 })).toBeNull();
  });
});
