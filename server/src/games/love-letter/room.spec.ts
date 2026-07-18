import type { Client } from '@colyseus/core';
import { LoveLetterRoom } from './room';
import { LoveLetterPlayer, LoveLetterState } from './schema';

describe('LoveLetterRoom draw phase', () => {
  it('waits for the active player to request a draw before adding the second card', () => {
    const room = new LoveLetterRoom();
    room.setPatchRate(null);
    room.autoDispose = false;
    (room as unknown as { resetAutoDisposeTimeout(): void }).resetAutoDisposeTimeout();
    room.setState(new LoveLetterState());
    const player = new LoveLetterPlayer();
    player.sessionId = 'player-1';
    player.nickname = '테스터';
    room.state.players.set(player.sessionId, player);
    room.state.gamePhase = 'playing';
    room.state.currentTurnId = player.sessionId;

    const privateRoom = room as unknown as {
      deck: Array<{ id: string; character: 'guard'; value: number }>;
      hands: Map<string, Array<{ id: string; character: 'priest' | 'guard'; value: number }>>;
      startTurn(): void;
      handleDrawCard(client: Client, payload: unknown): void;
    };
    privateRoom.deck = [{ id: 'guard-1', character: 'guard', value: 1 }];
    privateRoom.hands = new Map([[player.sessionId, [{ id: 'priest-1', character: 'priest', value: 2 }]]]);

    privateRoom.startTurn();
    expect(room.state.actionPhase).toBe('draw');
    expect(privateRoom.hands.get(player.sessionId)).toHaveLength(1);
    expect(room.state.deckCount).toBe(1);

    privateRoom.handleDrawCard({ sessionId: player.sessionId, send: jest.fn() } as unknown as Client, { turnRevision: room.state.turnRevision });
    expect(room.state.actionPhase).toBe('choose');
    expect(privateRoom.hands.get(player.sessionId)).toHaveLength(2);
    expect(room.state.deckCount).toBe(0);
    room.clock.clear();
  });
});
