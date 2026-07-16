import {
  readChatMessage,
  readInteger,
  readProtocolVersions,
  SlidingWindowRateLimiter,
} from './protocol';

describe('shared game protocol', () => {
  it('rejects malformed and oversized values', () => {
    expect(readChatMessage(null)).toBeNull();
    expect(readChatMessage(' '.repeat(10))).toBeNull();
    expect(readChatMessage('a'.repeat(301))).toBeNull();
    expect(readInteger(1.5, { min: 0, max: 2 })).toBeNull();
  });

  it('bounds protocol version entries', () => {
    const versions = Object.fromEntries(
      Array.from({ length: 60 }, (_, index) => [`game-${index}`, 1]),
    );
    expect(Object.keys(readProtocolVersions(versions))).toHaveLength(50);
  });

  it('limits repeated attempts inside a sliding window', () => {
    const limiter = new SlidingWindowRateLimiter(2, 1000);
    expect(limiter.allow('player', 1000)).toBe(true);
    expect(limiter.allow('player', 1100)).toBe(true);
    expect(limiter.allow('player', 1200)).toBe(false);
    expect(limiter.allow('player', 2101)).toBe(true);
  });
});
