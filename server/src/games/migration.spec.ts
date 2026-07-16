import { isMigrationGroupReady, MigrationSeatRegistry } from './migration';

describe('migration seat registry', () => {
  const options = {
    migrationSeats: [
      {
        token: 'single-use-token',
        sourceSessionId: 'source-session',
        playerId: 'player-id',
        nickname: '플레이어',
        isHost: true,
        protocolVersions: { onecard: 1 },
      },
    ],
  };

  it('authorizes and consumes a seat only once', () => {
    const registry = new MigrationSeatRegistry(options);
    const request = { migrationToken: 'single-use-token' };

    expect(registry.authorize(request)).toBe(true);
    expect(registry.claim(request)?.isHost).toBe(true);
    expect(registry.claim(request)).toBeNull();
    expect(registry.isComplete).toBe(true);
    expect(registry.authorize(request)).toBe(true);
  });

  it('rejects an unknown token while seats are pending', () => {
    const registry = new MigrationSeatRegistry(options);
    expect(registry.authorize({ migrationToken: 'unknown' })).toBe(false);
  });

  it('invalidates unclaimed seats when migration expires', () => {
    const registry = new MigrationSeatRegistry(options);
    registry.expire();
    expect(registry.claim({ migrationToken: 'single-use-token' })).toBeNull();
  });

  it('becomes ready only when every claimed seat is still connected', () => {
    const registry = new MigrationSeatRegistry(options);
    registry.claim({ migrationToken: 'single-use-token' });
    expect(isMigrationGroupReady(registry, 0)).toBe(false);
    expect(isMigrationGroupReady(registry, 1)).toBe(true);
  });
});
