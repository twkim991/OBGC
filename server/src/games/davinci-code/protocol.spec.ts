import {
  parseDrawTilePayload,
  parseGuessTilePayload,
  parseInitialColorsPayload,
  parseStopGuessingPayload,
} from './protocol';

describe('davinci code protocol', () => {
  it('accepts bounded setup and turn payloads', () => {
    expect(parseInitialColorsPayload({ colors: ['dark', 'light', 'dark'] })).toEqual({
      colors: ['dark', 'light', 'dark'],
    });
    expect(parseDrawTilePayload({ color: 'light', turnRevision: 2 })).toEqual({
      color: 'light',
      turnRevision: 2,
    });
    expect(
      parseGuessTilePayload({
        targetSessionId: 'target',
        tileId: 'tile',
        guessedNumber: 11,
        turnRevision: 3,
      }),
    ).toEqual({
      targetSessionId: 'target',
      tileId: 'tile',
      guessedNumber: 11,
      turnRevision: 3,
    });
    expect(parseStopGuessingPayload({ turnRevision: 4 })).toEqual({ turnRevision: 4 });
  });

  it('rejects malformed colors, numbers and revisions', () => {
    expect(parseInitialColorsPayload({ colors: ['red', 'light', 'dark'] })).toBeNull();
    expect(parseDrawTilePayload({ color: 'dark', turnRevision: -1 })).toBeNull();
    expect(
      parseGuessTilePayload({
        targetSessionId: 'target',
        tileId: 'tile',
        guessedNumber: 12,
        turnRevision: 0,
      }),
    ).toBeNull();
  });
});
