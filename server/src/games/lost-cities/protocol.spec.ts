import {
  parseLostCitiesDrawPayload,
  parseLostCitiesPlayPayload,
} from './protocol';

describe('lost cities protocol', () => {
  it('accepts valid play and draw actions', () => {
    expect(
      parseLostCitiesPlayPayload({
        cardId: 'yellow-5',
        destination: 'expedition',
        turnRevision: 3,
      }),
    ).toEqual({
      cardId: 'yellow-5',
      destination: 'expedition',
      turnRevision: 3,
    });
    expect(
      parseLostCitiesDrawPayload({ source: 'deck', turnRevision: 4 }),
    ).toEqual({ source: 'deck', color: '', turnRevision: 4 });
    expect(
      parseLostCitiesDrawPayload({
        source: 'discard',
        color: 'green',
        turnRevision: 4,
      }),
    ).toEqual({ source: 'discard', color: 'green', turnRevision: 4 });
  });

  it('rejects malformed destinations, revisions, and discard colors', () => {
    expect(
      parseLostCitiesPlayPayload({
        cardId: 'x',
        destination: 'deck',
        turnRevision: 1,
      }),
    ).toBeNull();
    expect(
      parseLostCitiesPlayPayload({
        cardId: 'x',
        destination: 'discard',
        turnRevision: -1,
      }),
    ).toBeNull();
    expect(
      parseLostCitiesDrawPayload({
        source: 'deck',
        color: 'red',
        turnRevision: 1,
      }),
    ).toBeNull();
    expect(
      parseLostCitiesDrawPayload({
        source: 'discard',
        color: 'purple',
        turnRevision: 1,
      }),
    ).toBeNull();
  });
});
