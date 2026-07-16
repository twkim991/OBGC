import { Room, Client, updateLobby } from 'colyseus';
import { Schema, MapSchema, type } from '@colyseus/schema';
import { DEFAULT_GAME, getGame } from '../games/registry';
import type { GameType } from '../games/registry';
import {
  readChatMessage,
  readProtocolVersions,
  readString,
  sendRoomError,
  SlidingWindowRateLimiter,
} from '../games/protocol';
import {
  createRoomMigration,
  isMigrationGroupReady,
  MIGRATION_ABORT_MS,
  MIGRATION_RETRY_MS,
  MIGRATION_SEAT_SECONDS,
  MigrationSeatRegistry,
  type MigrationParticipant,
} from '../games/migration';
import { logRoomError, logRoomEvent } from '../games/logging';

// 1. 플레이어 상태 정의
export class Player extends Schema {
  @type('string') sessionId: string = '';
  @type('string') nickname: string = '';
  @type('boolean') isHost: boolean = false;
}

// 2. 방 전체 상태 정의
export class TableState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type('boolean') migrationReady: boolean = false;
  @type('string') hostId: string = '';
  @type('string') roomName: string = '';
  @type('string') gameType: GameType = DEFAULT_GAME.id;
}

// 3. 테이블 룸(대기실) 클래스
export class TableRoom extends Room<TableState> {
  private isStarting = false;
  private isChangingGame = false;
  private readonly chatLimiter = new SlidingWindowRateLimiter(5, 5000);
  private readonly playerIds = new Map<string, string>();
  private readonly clientProtocols = new Map<string, Record<string, number>>();
  private migrationSeats = new MigrationSeatRegistry();

  async onCreate(options: any) {
    this.setState(new TableState());
    this.setSeatReservationTime(MIGRATION_SEAT_SECONDS);
    this.migrationSeats = new MigrationSeatRegistry(options);
    this.state.migrationReady = this.migrationSeats.total === 0;

    // 유저가 입력한 방 제목
    const title =
      readString(options?.roomName, { maxLength: 60 }) ??
      '즐거운 보드게임 한 판';
    const game = getGame(options?.gameType);
    if (!game) {
      logRoomEvent('warn', 'table.create_rejected', {
        roomId: this.roomId,
        code: 'UNSUPPORTED_GAME',
      });
      throw new Error('지원하지 않는 게임입니다.');
    }

    this.state.roomName = title;
    this.state.gameType = game.id;
    this.maxClients = game.maxPlayers;

    if (this.migrationSeats.total > 0) {
      await this.setPrivate(true);
      this.clock.setTimeout(async () => {
        if (this.state.migrationReady) return;
        this.migrationSeats.expire();
        logRoomEvent('warn', 'table.migration_aborted', {
          roomId: this.roomId,
          gameId: this.state.gameType,
          code: 'MIGRATION_TIMEOUT',
        });
        this.broadcast('migration_aborted', {
          message: '모든 참가자가 제한 시간 안에 이동하지 못했습니다.',
        });
        await this.disconnect();
      }, MIGRATION_ABORT_MS);
    }

    // 로비 목록에 방 제목과 선택 게임을 함께 노출합니다.
    await this.setMetadata({ roomName: title, gameType: game.id });

    this.onMessage('chat', (client, message) => {
      const normalized = readChatMessage(message);
      if (!normalized) {
        this.logRejectedMessage('INVALID_CHAT');
        sendRoomError(client, 'INVALID_CHAT', '채팅은 1~300자로 입력해주세요.');
        return;
      }
      if (!this.chatLimiter.allow(client.sessionId)) {
        this.logRejectedMessage('CHAT_RATE_LIMIT');
        sendRoomError(client, 'CHAT_RATE_LIMIT', '채팅을 너무 빠르게 보내고 있습니다.');
        return;
      }

      const player = this.state.players.get(client.sessionId);
      this.broadcast('chat', {
        clientId: player?.nickname || client.sessionId,
        message: normalized,
      });
    });

    this.onMessage('change_game', async (client, requestedGame) => {
      if (client.sessionId !== this.state.hostId || this.isStarting || this.isChangingGame) return;

      const nextGame = getGame(requestedGame);
      if (!nextGame) {
        this.logRejectedMessage('UNSUPPORTED_GAME');
        sendRoomError(client, 'UNSUPPORTED_GAME', '지원하지 않는 게임입니다.');
        return;
      }
      if (nextGame.id === this.state.gameType) return;

      if (this.state.players.size > nextGame.maxPlayers) {
        this.logRejectedMessage('TOO_MANY_PLAYERS', nextGame.id);
        sendRoomError(
          client,
          'TOO_MANY_PLAYERS',
          `${nextGame.label}은 최대 ${nextGame.maxPlayers}명까지 플레이할 수 있습니다.`,
        );
        return;
      }

      this.isChangingGame = true;

      try {
        this.maxClients = nextGame.maxPlayers;
        this.listing.maxClients = nextGame.maxPlayers;
        await this.setMetadata({ roomName: this.state.roomName, gameType: nextGame.id });
        this.state.gameType = nextGame.id;

        if (this.clients.length >= nextGame.maxPlayers && !this.locked) {
          await this.lock();
        } else if (this.clients.length < nextGame.maxPlayers && this.locked) {
          await this.unlock();
        }

        updateLobby(this);

        this.broadcast('chat', {
          clientId: 'System',
          message: `방장이 게임을 ${nextGame.label}로 변경했습니다.`,
        });
      } catch (error) {
        logRoomError('table.change_game_failed', error, {
          roomId: this.roomId,
          gameId: nextGame.id,
        });
      } finally {
        this.isChangingGame = false;
      }
    });

    // 방 생성 또는 대기실에서 확정된 서버 상태의 게임을 시작합니다.
    this.onMessage('start_game', async (client) => {
      if (client.sessionId !== this.state.hostId || this.isStarting || this.isChangingGame) return;

      const selectedGame = getGame(this.state.gameType);
      if (!selectedGame) return;

      if (this.state.players.size < selectedGame.minPlayers) {
        this.logRejectedMessage('NOT_ENOUGH_PLAYERS', selectedGame.id);
        sendRoomError(
          client,
          'NOT_ENOUGH_PLAYERS',
          `${selectedGame.label}는 ${selectedGame.minPlayers}명 이상 모여야 시작할 수 있습니다.`,
        );
        return;
      }

      const incompatiblePlayers = Array.from(this.state.players.values()).filter(
        (player) =>
          this.clientProtocols.get(player.sessionId)?.[selectedGame.id] !==
          selectedGame.protocolVersion,
      );
      if (incompatiblePlayers.length > 0) {
        this.logRejectedMessage('PROTOCOL_MISMATCH', selectedGame.id);
        sendRoomError(
          client,
          'PROTOCOL_MISMATCH',
          `${incompatiblePlayers.map((player) => player.nickname).join(', ')}님의 클라이언트가 ${selectedGame.label}과 호환되지 않습니다.`,
        );
        return;
      }

      this.isStarting = true;

      try {
        const participants: MigrationParticipant[] = Array.from(
          this.state.players.entries(),
        ).map(([sourceSessionId, player]) => ({
          sourceSessionId,
          playerId: this.playerIds.get(sourceSessionId) ?? sourceSessionId,
          nickname: player.nickname,
          isHost: sourceSessionId === this.state.hostId,
          protocolVersions: this.clientProtocols.get(sourceSessionId) ?? {},
        }));

        const migration = await createRoomMigration(
          selectedGame.id,
          {},
          participants,
        );

        this.clients.forEach((participantClient) => {
          const reservation = migration.reservations.get(
            participantClient.sessionId,
          );
          if (!reservation) return;

          participantClient.send('move_room', {
            reservation,
            gameType: selectedGame.id,
          });
        });
        this.clock.setTimeout(() => {
          this.isStarting = false;
        }, MIGRATION_RETRY_MS);
      } catch (e) {
        logRoomError('table.game_migration_failed', e, {
          roomId: this.roomId,
          gameId: selectedGame.id,
        });
        sendRoomError(
          client,
          'GAME_START_FAILED',
          `${selectedGame.label} 게임방을 만들지 못했습니다. 잠시 후 다시 시도해주세요.`,
        );
        this.isStarting = false;
      }
    });
  }

  onAuth(client: Client, options: unknown) {
    const authorized =
      this.migrationSeats.total === 0 ||
      this.state.migrationReady ||
      (!this.migrationSeats.isComplete &&
        this.migrationSeats.authorize(options));
    if (!authorized) this.logRejectedMessage('INVALID_MIGRATION_SEAT');
    return authorized;
  }

  async onJoin(client: Client, options: any) {
    const migrationSeat = this.migrationSeats.claim(options);
    const player = new Player();
    player.sessionId = client.sessionId;
    const playerId =
      migrationSeat?.playerId ??
      readString(options?.playerId, { maxLength: 128 }) ??
      client.sessionId;
    this.playerIds.set(client.sessionId, playerId);
    player.nickname =
      migrationSeat?.nickname ??
      readString(options?.nickname, { maxLength: 40 }) ??
      `플레이어 ${playerId.slice(0, 4).toUpperCase()}`;
    this.clientProtocols.set(
      client.sessionId,
      migrationSeat?.protocolVersions ?? readProtocolVersions(options?.protocolVersions),
    );

    if (migrationSeat?.isHost) {
      this.state.players.forEach((existingPlayer) => {
        existingPlayer.isHost = false;
      });
      player.isHost = true;
      this.state.hostId = client.sessionId;
    } else if (this.migrationSeats.total === 0 && this.state.players.size === 0) {
      player.isHost = true;
      this.state.hostId = client.sessionId;
    }

    this.state.players.set(client.sessionId, player);

    this.broadcast('chat', {
      clientId: 'System',
      message: `${player.nickname} 님이 테이블에 앉았습니다.`,
    });

    await this.finalizeMigrationIfReady();
  }

  async onLeave(client: Client, consented: boolean) {
    if (!consented) {
      try {
        await this.allowReconnection(client, 20);
        await this.finalizeMigrationIfReady();
        return;
      } catch {
        // 재연결 제한 시간이 지나면 아래의 일반 퇴장 처리를 수행한다.
      }
    }

    this.chatLimiter.clear(client.sessionId);
    this.clientProtocols.delete(client.sessionId);
    this.playerIds.delete(client.sessionId);
    const leavingPlayer = this.state.players.get(client.sessionId);
    const wasHost = this.state.hostId === client.sessionId;

    this.state.players.delete(client.sessionId);

    this.broadcast('chat', {
      clientId: 'System',
      message: `${leavingPlayer?.nickname || client.sessionId} 님이 떠났습니다.`,
    });

    if (wasHost) this.transferHost();
  }

  private async finalizeMigrationIfReady() {
    if (
      this.state.migrationReady ||
      !isMigrationGroupReady(this.migrationSeats, this.clients.length)
    ) {
      return;
    }

    this.state.migrationReady = true;
    if (!this.state.hostId) this.transferHost();
    await this.setPrivate(false);
    if (this.locked && this.clients.length < this.maxClients) {
      await this.unlock();
    }
    updateLobby(this);
    this.broadcast('migration_ready');
  }

  private logRejectedMessage(code: string, gameId = this.state.gameType) {
    logRoomEvent('warn', 'table.request_rejected', {
      roomId: this.roomId,
      gameId,
      code,
    });
  }

  private transferHost() {
    this.state.players.forEach((player) => {
      player.isHost = false;
    });

    const nextEntry = Array.from(this.state.players.entries())[0];
    if (!nextEntry) {
      this.state.hostId = '';
      return;
    }

    const [nextSessionId, nextPlayer] = nextEntry;
    nextPlayer.isHost = true;
    this.state.hostId = nextSessionId;

    this.broadcast('chat', {
      clientId: 'System',
      message: `${nextPlayer.nickname} 님이 새 방장이 되었습니다.`,
    });
  }

}
