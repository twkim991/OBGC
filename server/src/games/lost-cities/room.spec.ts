import type { Client } from '@colyseus/core';
import { createEmptyLostCitiesRoutes } from './domain/rules';
import type { LostCitiesCard, LostCitiesRoutes } from './domain/types';
import { LostCitiesRoom } from './room';
import { LostCitiesPlayer, LostCitiesState } from './schema';

describe('LostCitiesRoom turn flow', () => {
  it('requires play before draw and blocks taking the card just discarded', () => {
    const warning = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const room = new LostCitiesRoom();
    room.setPatchRate(null);
    room.autoDispose = false;
    (
      room as unknown as { resetAutoDisposeTimeout(): void }
    ).resetAutoDisposeTimeout();
    room.setState(new LostCitiesState());
    ['p1', 'p2'].forEach((sessionId) => {
      const player = new LostCitiesPlayer();
      player.sessionId = sessionId;
      player.nickname = sessionId;
      room.state.players.set(sessionId, player);
    });
    room.state.gamePhase = 'playing';
    room.state.actionPhase = 'play';
    room.state.currentTurnId = 'p1';
    room.state.turnRevision = 2;
    room.state.deckCount = 2;

    const yellowTwo: LostCitiesCard = {
      id: 'yellow-2',
      color: 'yellow',
      kind: 'number',
      value: 2,
    };
    const deckCards: LostCitiesCard[] = [
      { id: 'red-4', color: 'red', kind: 'number', value: 4 },
      { id: 'blue-3', color: 'blue', kind: 'number', value: 3 },
    ];
    const privateRoom = room as unknown as {
      deck: LostCitiesCard[];
      hands: Map<string, LostCitiesCard[]>;
      routes: Map<string, LostCitiesRoutes>;
      discardPiles: Record<string, LostCitiesCard[]>;
      handlePlayCard(client: Client, payload: unknown): void;
      handleDrawCard(client: Client, payload: unknown): void;
    };
    privateRoom.deck = deckCards;
    privateRoom.hands = new Map([
      ['p1', [yellowTwo]],
      ['p2', []],
    ]);
    privateRoom.routes = new Map([
      ['p1', createEmptyLostCitiesRoutes()],
      ['p2', createEmptyLostCitiesRoutes()],
    ]);
    const client = { sessionId: 'p1', send: jest.fn() } as unknown as Client;

    privateRoom.handlePlayCard(client, {
      cardId: yellowTwo.id,
      destination: 'discard',
      turnRevision: 2,
    });
    expect(room.state.actionPhase).toBe('draw');
    expect(room.state.blockedDiscardColor).toBe('yellow');
    expect(privateRoom.hands.get('p1')).toHaveLength(0);

    privateRoom.handleDrawCard(client, {
      source: 'discard',
      color: 'yellow',
      turnRevision: 3,
    });
    expect(privateRoom.hands.get('p1')).toHaveLength(0);
    expect(client.send).toHaveBeenCalledWith(
      'room_error',
      expect.objectContaining({ code: 'BLOCKED_DISCARD' }),
    );

    privateRoom.handleDrawCard(client, { source: 'deck', turnRevision: 3 });
    expect(privateRoom.hands.get('p1')).toHaveLength(1);
    expect(room.state.currentTurnId).toBe('p2');
    expect(room.state.actionPhase).toBe('play');
    expect(room.state.deckCount).toBe(1);
    warning.mockRestore();
    room.clock.clear();
  });
});
