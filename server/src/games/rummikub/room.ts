import { Client, Room } from '@colyseus/core';
import { logRoomError, logRoomEvent } from '../logging';
import {
  isMigrationGroupReady,
  MIGRATION_ABORT_MS,
  MIGRATION_RETRY_MS,
  MIGRATION_SEAT_SECONDS,
  MigrationSeatRegistry,
  type MigrationParticipant,
} from '../migration';
import {
  readChatMessage,
  sendRoomError,
  SlidingWindowRateLimiter,
} from '../protocol';
import { createRematchTable } from '../rematch';
import {
  createRummikubDeck,
  dealRummikubGame,
  shuffleRummikubTiles,
} from './domain/deck';
import {
  getNextRummikubPlayerId,
  validateRummikubCommit,
  type CommitErrorCode,
} from './domain/engine';
import {
  scoreCompletedGame,
  scoreStalemate,
  type RummikubScoreResult,
} from './domain/scoring';
import type { RummikubMeld, RummikubTile } from './domain/types';
import { RUMMIKUB_GAME } from './metadata';
import {
  parseCommitTurnPayload,
  RUMMIKUB_MESSAGES,
} from './protocol';
import {
  RummikubPlayer,
  RummikubPublicMeld,
  RummikubPublicTile,
  RummikubState,
} from './schema';

const COMMIT_ERROR_MESSAGES: Record<CommitErrorCode, string> = {
  STALE_BOARD_REVISION: '보드가 갱신되었습니다. 최신 상태에서 다시 시도해주세요.',
  MOVE_TOO_LARGE: '제출한 조합의 크기가 허용 범위를 벗어났습니다.',
  DUPLICATE_TILE: '같은 타일이 두 번 이상 포함되어 있습니다.',
  TILE_NOT_OWNED: '사용할 수 없는 타일이 포함되어 있습니다.',
  BOARD_TILE_MISSING: '기존 보드의 타일을 패로 가져갈 수 없습니다.',
  NO_TILE_PLAYED: '내 패에서 타일을 한 개 이상 내려놓아야 합니다.',
  INVALID_MELD: '유효하지 않은 그룹 또는 런이 있습니다.',
  INITIAL_MELD_REQUIRED: '첫 등록 전에는 기존 보드를 변경할 수 없습니다.',
  INITIAL_MELD_TOO_LOW: '첫 등록 조합의 합은 30점 이상이어야 합니다.',
};

function toPublicTile(source: RummikubTile) {
  const tile = new RummikubPublicTile();
  tile.id = source.id;
  tile.color = source.color;
  tile.number = source.number;
  tile.isJoker = source.isJoker;
  return tile;
}

export class RummikubRoom extends Room<RummikubState> {
  private pool: RummikubTile[] = [];
  private readonly hands = new Map<string, RummikubTile[]>();
  private readonly playerIds = new Map<string, string>();
  private readonly clientProtocols = new Map<string, Record<string, number>>();
  private readonly chatLimiter = new SlidingWindowRateLimiter(5, 5000);
  private migrationSeats = new MigrationSeatRegistry();
  private isReturning = false;

  onCreate(options: unknown) {
    this.setState(new RummikubState());
    this.setSeatReservationTime(MIGRATION_SEAT_SECONDS);
    this.migrationSeats = new MigrationSeatRegistry(options);
    this.maxClients = this.migrationSeats.total || RUMMIKUB_GAME.maxPlayers;

    this.clock.setTimeout(async () => {
      if (this.state.migrationReady) return;
      this.migrationSeats.expire();
      this.logRejectedRequest('MIGRATION_TIMEOUT', 'rummikub.migration_aborted');
      this.broadcast('migration_aborted', {
        message: '모든 참가자가 제한 시간 안에 루미큐브 방으로 이동하지 못했습니다.',
      });
      await this.disconnect();
    }, MIGRATION_ABORT_MS);

    this.onMessage(RUMMIKUB_MESSAGES.requestPrivateState, (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) this.syncPrivateRack(player);
    });

    this.onMessage('chat', (client, message) => {
      const normalized = readChatMessage(message);
      if (!normalized) {
        this.rejectRequest(client, 'INVALID_CHAT', '채팅은 1~300자로 입력해주세요.');
        return;
      }
      if (!this.chatLimiter.allow(client.sessionId)) {
        this.rejectRequest(client, 'CHAT_RATE_LIMIT', '채팅을 너무 빠르게 보내고 있습니다.');
        return;
      }
      const player = this.state.players.get(client.sessionId);
      this.broadcast('chat', {
        clientId: player?.nickname ?? client.sessionId,
        message: `[루미큐브] ${normalized}`,
      });
    });

    this.onMessage(RUMMIKUB_MESSAGES.startGame, (client) => {
      const player = this.state.players.get(client.sessionId);
      if (this.state.gamePhase !== 'waiting') {
        this.rejectRequest(client, 'GAME_ALREADY_STARTED', '이미 게임이 시작되었습니다.');
        return;
      }
      if (!player?.isHost) {
        this.rejectRequest(client, 'NOT_HOST', '방장만 게임을 시작할 수 있습니다.');
        return;
      }
      if (this.state.players.size < RUMMIKUB_GAME.minPlayers) {
        this.rejectRequest(
          client,
          'NOT_ENOUGH_PLAYERS',
          `${RUMMIKUB_GAME.label}는 ${RUMMIKUB_GAME.minPlayers}명 이상 모여야 시작할 수 있습니다.`,
        );
        return;
      }
      try {
        this.startGame();
      } catch (error) {
        logRoomError('rummikub.start_failed', error, {
          roomId: this.roomId,
          gameId: RUMMIKUB_GAME.id,
        });
        this.rejectRequest(
          client,
          'GAME_START_FAILED',
          '게임을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.',
        );
      }
    });

    this.onMessage(RUMMIKUB_MESSAGES.commitTurn, (client, payload: unknown) => {
      if (!this.canAct(client)) return;
      const parsed = parseCommitTurnPayload(payload);
      if (!parsed) {
        this.rejectRequest(client, 'INVALID_PAYLOAD', '턴 정보가 올바르지 않습니다.');
        return;
      }

      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const result = validateRummikubCommit({
        previousMelds: this.getPublicBoard(),
        hand: this.getHand(client.sessionId),
        candidateMeldTileIds: parsed.melds.map((meld) => meld.tileIds),
        hasInitialMeld: player.hasInitialMeld,
        currentRevision: this.state.boardRevision,
        baseRevision: parsed.baseRevision,
      });

      if (result.ok === false) {
        this.rejectRequest(client, result.code, COMMIT_ERROR_MESSAGES[result.code]);
        return;
      }

      this.replacePublicBoard(result.melds);
      this.hands.set(client.sessionId, result.hand);
      player.hasInitialMeld = true;
      this.state.boardRevision += 1;
      this.state.consecutivePasses = 0;
      this.state.lastAction = `${player.nickname}: 타일 ${result.addedTileIds.length}개 제출`;
      this.broadcast('chat', {
        clientId: 'System',
        message: `${player.nickname}님이 타일 ${result.addedTileIds.length}개를 내려놓았습니다.`,
      });
      this.syncPrivateRack(player);

      if (result.hand.length === 0) {
        this.finishGame(scoreCompletedGame(this.hands, client.sessionId));
        return;
      }
      this.passTurn();
    });

    this.onMessage(RUMMIKUB_MESSAGES.drawTile, (client) => {
      if (!this.canAct(client)) return;
      if (this.pool.length === 0) {
        this.rejectRequest(client, 'POOL_EMPTY', '풀이 비었습니다. 패스로 턴을 넘겨주세요.');
        return;
      }

      const tile = this.pool.shift();
      if (!tile) return;
      const hand = this.getHand(client.sessionId);
      hand.push(tile);
      this.state.poolCount = this.pool.length;
      this.state.consecutivePasses = 0;
      const player = this.state.players.get(client.sessionId);
      if (player) {
        this.state.lastAction = `${player.nickname}: 타일 1개 가져오기`;
        this.syncPrivateRack(player);
        this.broadcast('chat', {
          clientId: 'System',
          message: `${player.nickname}님이 타일 1개를 가져갔습니다.`,
        });
      }
      this.passTurn();
    });

    this.onMessage(RUMMIKUB_MESSAGES.passTurn, (client) => {
      if (!this.canAct(client)) return;
      if (this.pool.length > 0) {
        this.rejectRequest(client, 'POOL_NOT_EMPTY', '풀이 남아 있을 때는 타일을 가져가야 합니다.');
        return;
      }

      const player = this.state.players.get(client.sessionId);
      this.state.consecutivePasses += 1;
      this.state.lastAction = `${player?.nickname ?? client.sessionId}: 패스`;
      if (this.state.consecutivePasses >= this.getActivePlayerIds().length) {
        this.finishGame(scoreStalemate(this.hands));
        return;
      }
      this.passTurn();
    });

    this.onMessage(RUMMIKUB_MESSAGES.returnToTable, async (client) => {
      if (this.isReturning) return;
      const requestingPlayer = this.state.players.get(client.sessionId);
      if (!requestingPlayer) return;
      this.isReturning = true;

      try {
        const participants = this.clients.reduce<MigrationParticipant[]>(
          (result, participantClient) => {
            const player = this.state.players.get(participantClient.sessionId);
            if (!player) return result;
            result.push({
              sourceSessionId: participantClient.sessionId,
              playerId:
                this.playerIds.get(participantClient.sessionId) ??
                participantClient.sessionId,
              nickname: player.nickname,
              isHost: player.isHost,
              protocolVersions:
                this.clientProtocols.get(participantClient.sessionId) ?? {},
            });
            return result;
          },
          [],
        );
        const migration = await createRematchTable(RUMMIKUB_GAME, participants);
        this.clients.forEach((participantClient) => {
          const reservation = migration.reservations.get(participantClient.sessionId);
          if (reservation) {
            participantClient.send('move_room', { reservation, gameType: 'table' });
          }
        });
        this.clock.setTimeout(() => {
          this.isReturning = false;
        }, MIGRATION_RETRY_MS);
      } catch (error) {
        logRoomError('rummikub.rematch_migration_failed', error, {
          roomId: this.roomId,
          gameId: RUMMIKUB_GAME.id,
        });
        this.isReturning = false;
      }
    });
  }

  onAuth(client: Client, options: unknown) {
    const authorized =
      this.migrationSeats.total > 0 &&
      !this.migrationSeats.isComplete &&
      this.migrationSeats.authorize(options);
    if (!authorized) this.logRejectedRequest('INVALID_MIGRATION_SEAT');
    return authorized;
  }

  onJoin(client: Client, options: unknown) {
    if (this.state.gamePhase !== 'waiting') {
      client.leave();
      return;
    }
    const seat = this.migrationSeats.claim(options);
    if (!seat) {
      this.logRejectedRequest('MIGRATION_SEAT_ALREADY_USED');
      client.leave();
      return;
    }

    const player = new RummikubPlayer();
    player.sessionId = client.sessionId;
    player.nickname = seat.nickname;
    player.isHost = seat.isHost;
    this.playerIds.set(client.sessionId, seat.playerId);
    this.clientProtocols.set(client.sessionId, seat.protocolVersions);
    this.hands.set(client.sessionId, []);

    if (player.isHost) {
      this.state.players.forEach((existingPlayer) => {
        existingPlayer.isHost = false;
      });
      this.state.hostSessionId = client.sessionId;
    }

    this.state.players.set(client.sessionId, player);
    this.syncPrivateRack(player);
    this.finalizeMigrationIfReady();
    this.broadcast('chat', {
      clientId: 'System',
      message: `${player.nickname} 님이 입장했습니다.`,
    });
  }

  async onLeave(client: Client, consented: boolean) {
    if (!consented) {
      try {
        await this.allowReconnection(client, 20);
        const player = this.state.players.get(client.sessionId);
        if (player) {
          player.connected = true;
          this.syncPrivateRack(player);
        }
        this.finalizeMigrationIfReady();
        return;
      } catch {
        // 재연결 시간이 지나면 일반 퇴장으로 처리한다.
      }
    }

    this.chatLimiter.clear(client.sessionId);
    this.clientProtocols.delete(client.sessionId);
    this.playerIds.delete(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    if (this.state.gamePhase === 'waiting') {
      const wasHost = player.isHost;
      this.state.players.delete(client.sessionId);
      this.hands.delete(client.sessionId);
      if (wasHost) this.transferHost();
      return;
    }

    player.connected = false;
    if (player.isHost) this.transferHost();
    this.broadcast('chat', {
      clientId: 'System',
      message: `${player.nickname} 님이 게임에서 이탈했습니다.`,
    });

    const activePlayerIds = this.getActivePlayerIds();
    if (this.state.gamePhase === 'playing' && activePlayerIds.length === 1) {
      this.finishGame(scoreCompletedGame(this.hands, activePlayerIds[0]));
      return;
    }
    if (
      this.state.gamePhase === 'playing' &&
      this.state.currentTurnId === client.sessionId
    ) {
      this.passTurn();
    }
  }

  private startGame() {
    // waiting 중 연결이 종료된 플레이어는 onLeave에서 제거되므로
    // 시작 인원은 별도의 connected 플래그가 아닌 실제 참가자 Map을 기준으로 한다.
    const playerIds = Array.from(this.state.players.keys());
    const shuffled = shuffleRummikubTiles(createRummikubDeck());
    const deal = dealRummikubGame(shuffled, playerIds);

    this.pool = deal.pool;
    this.state.melds.clear();
    this.state.rankings.clear();
    this.state.gamePhase = 'playing';
    this.state.poolCount = this.pool.length;
    this.state.boardRevision = 0;
    this.state.consecutivePasses = 0;
    this.state.turnCount = 1;
    this.state.winnerSessionId = '';
    this.state.lastAction = '게임 시작';
    this.state.currentTurnId =
      playerIds[Math.floor(Math.random() * playerIds.length)] ?? '';

    this.state.players.forEach((player) => {
      player.connected = true;
      player.hasInitialMeld = false;
      player.score = 0;
      player.rank = 0;
      this.hands.set(player.sessionId, deal.hands.get(player.sessionId) ?? []);
    });
    this.syncAllPrivateRacks();
    this.broadcast('chat', {
      clientId: 'System',
      message: '루미큐브 게임이 시작되었습니다. 첫 등록은 30점 이상이어야 합니다.',
    });
  }

  private canAct(client: Client) {
    if (this.state.gamePhase !== 'playing') {
      this.rejectRequest(client, 'GAME_NOT_PLAYING', '진행 중인 게임이 아닙니다.');
      return false;
    }
    if (this.state.currentTurnId !== client.sessionId) {
      this.rejectRequest(client, 'NOT_YOUR_TURN', '현재 내 턴이 아닙니다.');
      return false;
    }
    const player = this.state.players.get(client.sessionId);
    if (!player?.connected) return false;
    return true;
  }

  private getPublicBoard(): RummikubMeld[] {
    return Array.from(this.state.melds, (meld) =>
      Array.from(meld.tiles, (tile) => ({
        id: tile.id,
        color: tile.color as RummikubTile['color'],
        number: tile.number,
        isJoker: tile.isJoker,
      })),
    );
  }

  private replacePublicBoard(melds: readonly RummikubMeld[]) {
    this.state.melds.clear();
    melds.forEach((sourceMeld) => {
      const meld = new RummikubPublicMeld();
      sourceMeld.forEach((tile) => meld.tiles.push(toPublicTile(tile)));
      this.state.melds.push(meld);
    });
  }

  private passTurn() {
    const playerIds = this.getActivePlayerIds();
    if (playerIds.length <= 1) return;
    this.state.currentTurnId = getNextRummikubPlayerId(
      playerIds,
      this.state.currentTurnId,
    );
    this.state.turnCount += 1;
    this.syncAllPrivateRacks();
  }

  private finishGame(result: RummikubScoreResult) {
    this.state.gamePhase = 'finished';
    this.state.winnerSessionId = result.winnerSessionId;
    this.state.rankings.clear();
    result.rankings.forEach((sessionId, index) => {
      const player = this.state.players.get(sessionId);
      if (player) {
        player.rank = index + 1;
        player.score = result.scores.get(sessionId) ?? 0;
      }
      this.state.rankings.push(sessionId);
    });
    const winner = this.state.players.get(result.winnerSessionId);
    this.state.lastAction = `${winner?.nickname ?? '플레이어'} 승리`;
    this.broadcast('chat', {
      clientId: 'System',
      message: `${winner?.nickname ?? '플레이어'}님이 루미큐브에서 승리했습니다!`,
    });
    this.syncAllPrivateRacks();
  }

  private getHand(sessionId: string) {
    return this.hands.get(sessionId) ?? [];
  }

  private syncPrivateRack(player: RummikubPlayer) {
    const hand = this.getHand(player.sessionId);
    player.handCount = hand.length;
    const client = this.clients.find(
      (candidate) => candidate.sessionId === player.sessionId,
    );
    if (!client) return;
    client.send(RUMMIKUB_MESSAGES.privateRack, {
      revision: this.state.boardRevision,
      tiles: hand.map((tile) => ({ ...tile })),
    });
  }

  private syncAllPrivateRacks() {
    this.state.players.forEach((player) => this.syncPrivateRack(player));
  }

  private getActivePlayerIds() {
    return Array.from(this.state.players.entries())
      .filter(([, player]) => player.connected)
      .map(([sessionId]) => sessionId);
  }

  private transferHost() {
    this.state.players.forEach((player) => {
      player.isHost = false;
    });
    const nextHost = Array.from(this.state.players.values()).find(
      (player) => player.connected,
    );
    if (!nextHost) {
      this.state.hostSessionId = '';
      return;
    }
    nextHost.isHost = true;
    this.state.hostSessionId = nextHost.sessionId;
  }

  private finalizeMigrationIfReady() {
    if (
      this.state.migrationReady ||
      !isMigrationGroupReady(this.migrationSeats, this.clients.length)
    ) {
      return;
    }
    this.state.migrationReady = true;
    if (!this.state.hostSessionId) this.transferHost();
    this.broadcast('migration_ready');
  }

  private rejectRequest(client: Client, code: string, message: string) {
    this.logRejectedRequest(code);
    sendRoomError(client, code, message);
  }

  private logRejectedRequest(code: string, event = 'rummikub.request_rejected') {
    logRoomEvent('warn', event, {
      roomId: this.roomId,
      gameId: RUMMIKUB_GAME.id,
      code,
    });
  }
}
