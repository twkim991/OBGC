import {
  GAME_DEFINITIONS,
  getPublicGameCatalog,
  validateGameDefinitions,
} from './registry';

describe('game registry', () => {
  it('contains unique game IDs with valid protocol versions', () => {
    const ids = GAME_DEFINITIONS.map((game) => game.id);
    expect(new Set(ids).size).toBe(ids.length);
    GAME_DEFINITIONS.forEach((game) => expect(game.protocolVersion).toBeGreaterThan(0));
  });

  it('does not expose server-only rematch metadata', () => {
    getPublicGameCatalog().forEach((game) => {
      expect(game).not.toHaveProperty('room');
      expect(game).not.toHaveProperty('rematchTitle');
    });
  });

  it('rejects duplicate IDs and invalid player limits', () => {
    const first = GAME_DEFINITIONS[0];
    expect(() => validateGameDefinitions([first, { ...first }])).toThrow(
      '중복된 ID',
    );
    expect(() =>
      validateGameDefinitions([{ ...first, minPlayers: 5, maxPlayers: 4 }]),
    ).toThrow('인원 설정');
  });

  it('requires at least one enabled game and positive protocol versions', () => {
    const first = GAME_DEFINITIONS[0];
    expect(() => validateGameDefinitions([{ ...first, enabled: false }])).toThrow(
      '활성화된 게임',
    );
    expect(() =>
      validateGameDefinitions([{ ...first, protocolVersion: 0 }]),
    ).toThrow('프로토콜 버전');
  });
});
