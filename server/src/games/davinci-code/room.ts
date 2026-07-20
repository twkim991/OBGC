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
import { TurnDeadlineController } from '../turn-timeout';
import {
  createDavinciDeck,
  drawDavinciCode,
  drawDavinciTile,
  shuffleDavinciTiles,
} from './domain/deck';
import {
  buildDavinciRankings,
  getNextDavinciPlayerId,
  resolveDavinciGuess,
} from './domain/engine';
import {
  insertDavinciTile,
  isDavinciCodeExposed,
  sortDavinciCode,
} from './domain/rules';
import type {
  DavinciCodeTile,
  DavinciColor,
  DavinciTile,
} from './domain/types';
import { DAVINCI_CODE_GAME } from './metadata';
import {
  DAVINCI_CODE_MESSAGES,
  parseDrawTilePayload,
  parseGuessTilePayload,
  parseInitialColorsPayload,
  parseStopGuessingPayload,
} from './protocol';
import {
  DavinciCodeState,
  DavinciPlayer,
  DavinciPublicTile,
} from './schema';

const GUESS_ERROR_MESSAGES = {
  TILE_NOT_FOUND: '선택한 타일을 찾을 수 없습니다.',
  TILE_ALREADY_REVEALED: '이미 공개된 타일입니다.',
} as const;

export class DavinciCodeRoom extends Room<DavinciCodeState> {
  private turnDeadline!: TurnDeadlineController;
  private pool: DavinciTile[] = [];
  private readonly codes = new Map<string, DavinciCodeTile[]>();
  private readonly pendingDraws = new Map<string, DavinciTile>();
  private readonly eliminationOrder: string[] = [];
  private readonly playerIds = new Map<string, string>();
  private readonly clientProtocols = new Map<string, Record<string, number>>();
  private readonly chatLimiter = new SlidingWindowRateLimiter(5, 5000);
  private migrationSeats = new MigrationSeatRegistry();
  private isReturning = false;

  onCreate(options: unknown) {
    this.setState(new DavinciCodeState());
    this.turnDeadline = new TurnDeadlineController(
      (callback, delayMs) => void this.clock.setTimeout(callback, delayMs),
      (deadlineAt) => (this.state.turnDeadlineAt = deadlineAt),
    );
    this.setSeatReservationTime(MIGRATION_SEAT_SECONDS);
    this.migrationSeats = new MigrationSeatRegistry(options);
    this.maxClients = this.migrationSeats.total || DAVINCI_CODE_GAME.maxPlayers;

    this.clock.setTimeout(async () => {
      if (this.state.migrationReady) return;
      this.migrationSeats.expire();
      this.logRejectedRequest('MIGRATION_TIMEOUT', 'davinci_code.migration_aborted');
      this.broadcast('migration_aborted', {
        message: '모든 참가자가 제한 시간 안에 다빈치 코드 방으로 이동하지 못했습니다.',
      });
      await this.disconnect();
    }, MIGRATION_ABORT_MS);

    this.onMessage(DAVINCI_CODE_MESSAGES.requestPrivateState, (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) this.syncPrivateCode(player);
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
        message: `[다빈치 코드] ${normalized}`,
      });
    });

    this.onMessage(DAVINCI_CODE_MESSAGES.startGame, (client) => {
      const player = this.state.players.get(client.sessionId);
      if (this.state.gamePhase !== 'waiting') {
        this.rejectRequest(client, 'GAME_ALREADY_STARTED', '이미 게임이 시작되었습니다.');
        return;
      }
      if (!player?.isHost) {
        this.rejectRequest(client, 'NOT_HOST', '방장만 게임을 시작할 수 있습니다.');
        return;
      }
      if (this.state.players.size < DAVINCI_CODE_GAME.minPlayers) {
        this.rejectRequest(
          client,
          'NOT_ENOUGH_PLAYERS',
          `${DAVINCI_CODE_GAME.label}는 ${DAVINCI_CODE_GAME.minPlayers}명 이상 모여야 시작할 수 있습니다.`,
        );
        return;
      }
      this.startSetup();
    });

    this.onMessage(
      DAVINCI_CODE_MESSAGES.chooseInitialColors,
      (client, payload: unknown) => {
        if (this.state.gamePhase !== 'setup') {
          this.rejectRequest(client, 'SETUP_NOT_ACTIVE', '시작 타일을 고르는 단계가 아닙니다.');
          return;
        }
        const player = this.state.players.get(client.sessionId);
        if (!player || player.setupComplete || player.eliminated) return;
        const parsed = parseInitialColorsPayload(payload);
        const requiredCount = this.initialCodeSize;
        if (!parsed || parsed.colors.length !== requiredCount) {
          this.rejectRequest(
            client,
            'INVALID_INITIAL_COLORS',
            `시작 타일 색상을 ${requiredCount}개 선택해주세요.`,
          );
          return;
        }
        const code = drawDavinciCode(this.pool, parsed.colors);
        if (!code) {
          this.rejectRequest(client, 'COLOR_POOL_EMPTY', '선택한 색상의 타일이 부족합니다.');
          return;
        }
        this.codes.set(client.sessionId, sortDavinciCode(code));
        player.setupComplete = true;
        this.updatePublicCode(player);
        this.updatePoolCounts();
        this.state.lastAction = `${player.nickname}: 시작 코드 준비 완료`;
        this.syncPrivateCode(player);
        if (this.getActivePlayers().every((candidate) => candidate.setupComplete)) {
          this.beginFirstTurn();
        }
      },
    );

    this.onMessage(DAVINCI_CODE_MESSAGES.drawTile, (client, payload: unknown) => {
      if (!this.canAct(client, ['draw'])) return;
      const parsed = parseDrawTilePayload(payload);
      if (!parsed || !this.hasCurrentRevision(parsed.turnRevision)) {
        this.rejectRequest(client, 'STALE_TURN', '턴 상태가 갱신되었습니다. 다시 시도해주세요.');
        return;
      }
      const tile = drawDavinciTile(this.pool, parsed.color);
      if (!tile) {
        this.rejectRequest(client, 'COLOR_POOL_EMPTY', '선택한 색상의 타일이 없습니다.');
        return;
      }
      this.pendingDraws.set(client.sessionId, tile);
      this.state.drawnTileColor = tile.color;
      this.state.turnPhase = 'guess';
      this.state.turnRevision += 1;
      this.updatePoolCounts();
      const player = this.state.players.get(client.sessionId);
      this.state.lastAction = `${player?.nickname ?? client.sessionId}: ${this.colorLabel(tile.color)} 타일 선택`;
      if (player) this.syncPrivateCode(player);
      this.armPhaseDeadline();
    });

    this.onMessage(DAVINCI_CODE_MESSAGES.guessTile, (client, payload: unknown) => {
      if (!this.canAct(client, ['guess', 'decision'])) return;
      const parsed = parseGuessTilePayload(payload);
      if (!parsed || !this.hasCurrentRevision(parsed.turnRevision)) {
        this.rejectRequest(client, 'STALE_TURN', '턴 상태가 갱신되었습니다. 다시 시도해주세요.');
        return;
      }
      if (parsed.targetSessionId === client.sessionId) {
        this.rejectRequest(client, 'INVALID_TARGET', '자기 타일은 추측할 수 없습니다.');
        return;
      }
      const targetPlayer = this.state.players.get(parsed.targetSessionId);
      if (!targetPlayer || targetPlayer.eliminated || !targetPlayer.connected) {
        this.rejectRequest(client, 'INVALID_TARGET', '추측할 수 없는 플레이어입니다.');
        return;
      }
      const result = resolveDavinciGuess(
        this.getCode(parsed.targetSessionId),
        parsed.tileId,
        parsed.guessedNumber,
      );
      if (result.ok === false) {
        this.rejectRequest(client, result.code, GUESS_ERROR_MESSAGES[result.code]);
        return;
      }

      const actor = this.state.players.get(client.sessionId);
      if (result.correct) {
        this.codes.set(parsed.targetSessionId, result.code);
        this.updatePublicCode(targetPlayer);
        this.syncPrivateCode(targetPlayer);
        this.state.turnPhase = 'decision';
        this.state.turnRevision += 1;
        this.state.lastAction = `${actor?.nickname ?? client.sessionId}: ${targetPlayer.nickname}의 ${this.colorLabel(result.tile.color)} ${result.tile.number} 적중`;
        this.broadcast('chat', {
          clientId: 'System',
          message: `${actor?.nickname ?? '플레이어'}님이 ${targetPlayer.nickname}님의 ${this.colorLabel(result.tile.color)} ${result.tile.number} 타일을 공개했습니다.`,
        });

        if (isDavinciCodeExposed(result.code)) {
          targetPlayer.eliminated = true;
          this.eliminationOrder.push(targetPlayer.sessionId);
          this.broadcast('chat', {
            clientId: 'System',
            message: `${targetPlayer.nickname}님의 코드가 모두 공개되었습니다.`,
          });
          if (this.getActivePlayers().length === 1) {
            this.finishGame();
          }
        }
        if (this.state.gamePhase === 'playing') this.armPhaseDeadline();
        return;
      }

      this.state.lastAction = `${actor?.nickname ?? client.sessionId}: 추측 실패`;
      this.broadcast('chat', {
        clientId: 'System',
        message: `${actor?.nickname ?? '플레이어'}님의 추측이 빗나갔습니다.`,
      });
      this.completeTurn(client.sessionId, true);
    });

    this.onMessage(
      DAVINCI_CODE_MESSAGES.stopGuessing,
      (client, payload: unknown) => {
        if (!this.canAct(client, ['decision'])) return;
        const parsed = parseStopGuessingPayload(payload);
        if (!parsed || !this.hasCurrentRevision(parsed.turnRevision)) {
          this.rejectRequest(client, 'STALE_TURN', '턴 상태가 갱신되었습니다. 다시 시도해주세요.');
          return;
        }
        const player = this.state.players.get(client.sessionId);
        this.state.lastAction = `${player?.nickname ?? client.sessionId}: 추리 중단`;
        this.completeTurn(client.sessionId, false);
      },
    );

    this.onMessage(DAVINCI_CODE_MESSAGES.returnToTable, async (client) => {
      if (this.isReturning) return;
      if (!this.state.players.has(client.sessionId)) return;
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
        const migration = await createRematchTable(DAVINCI_CODE_GAME, participants);
        this.clients.forEach((participantClient) => {
          const reservation = migration.reservations.get(participantClient.sessionId);
          if (reservation) {
            participantClient.send('move_room', {
              reservation,
              gameType: 'table',
            });
          }
        });
        this.clock.setTimeout(() => {
          this.isReturning = false;
        }, MIGRATION_RETRY_MS);
      } catch (error) {
        logRoomError('davinci_code.rematch_migration_failed', error, {
          roomId: this.roomId,
          gameId: DAVINCI_CODE_GAME.id,
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
    const player = new DavinciPlayer();
    player.sessionId = client.sessionId;
    player.nickname = seat.nickname;
    player.isHost = seat.isHost;
    this.playerIds.set(client.sessionId, seat.playerId);
    this.clientProtocols.set(client.sessionId, seat.protocolVersions);
    this.codes.set(client.sessionId, []);
    if (player.isHost) {
      this.state.players.forEach((candidate) => {
        candidate.isHost = false;
      });
      this.state.hostSessionId = client.sessionId;
    }
    this.state.players.set(client.sessionId, player);
    this.syncPrivateCode(player);
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
          this.syncPrivateCode(player);
        }
        this.finalizeMigrationIfReady();
        return;
      } catch {
        // 재연결 제한이 지나면 아래 이탈 처리를 수행한다.
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
      this.codes.delete(client.sessionId);
      if (wasHost) this.transferHost();
      return;
    }

    player.connected = false;
    player.eliminated = true;
    player.setupComplete = true;
    if (!this.eliminationOrder.includes(player.sessionId)) {
      this.eliminationOrder.push(player.sessionId);
    }
    if (player.isHost) this.transferHost();
    this.broadcast('chat', {
      clientId: 'System',
      message: `${player.nickname} 님이 게임에서 이탈했습니다.`,
    });
    if (this.getActivePlayers().length <= 1) {
      this.finishGame();
      return;
    }
    if (this.state.gamePhase === 'setup') {
      if (this.getActivePlayers().every((candidate) => candidate.setupComplete)) {
        this.beginFirstTurn();
      }
      return;
    }
    if (this.state.currentTurnId === client.sessionId) this.advanceTurn();
  }

  private get initialCodeSize() {
    return this.state.players.size === 4 ? 3 : 4;
  }

  private startSetup() {
    this.pool = shuffleDavinciTiles(createDavinciDeck());
    this.pendingDraws.clear();
    this.eliminationOrder.splice(0);
    this.state.gamePhase = 'setup';
    this.state.turnPhase = 'setup';
    this.state.currentTurnId = '';
    this.state.turnCount = 0;
    this.state.turnRevision = 0;
    this.state.rankings.clear();
    this.state.winnerSessionId = '';
    this.state.drawnTileColor = '';
    this.state.lastAction = '시작 타일 색상 선택';
    this.state.players.forEach((player) => {
      player.connected = true;
      player.setupComplete = false;
      player.eliminated = false;
      player.rank = 0;
      player.code.clear();
      player.hiddenCount = 0;
      this.codes.set(player.sessionId, []);
      this.syncPrivateCode(player);
    });
    this.updatePoolCounts();
    this.broadcast('chat', {
      clientId: 'System',
      message: `다빈치 코드가 시작되었습니다. 시작 타일 색상을 ${this.initialCodeSize}개 선택하세요.`,
    });
    this.armPhaseDeadline();
  }

  private beginFirstTurn() {
    const activeIds = this.getActivePlayers().map((player) => player.sessionId);
    this.state.gamePhase = 'playing';
    this.state.currentTurnId =
      activeIds[Math.floor(Math.random() * activeIds.length)] ?? '';
    this.state.turnCount = 1;
    this.prepareTurn();
    this.broadcast('chat', {
      clientId: 'System',
      message: `${this.state.players.get(this.state.currentTurnId)?.nickname ?? '플레이어'}님의 턴입니다.`,
    });
  }

  private prepareTurn() {
    this.pendingDraws.delete(this.state.currentTurnId);
    this.state.drawnTileColor = '';
    this.state.turnPhase = this.pool.length > 0 ? 'draw' : 'guess';
    this.state.turnRevision += 1;
    this.syncAllPrivateCodes();
    this.armPhaseDeadline();
  }

  private armPhaseDeadline() {
    if (!this.turnDeadline) return;
    if (this.state.gamePhase === 'setup') {
      this.turnDeadline.arm(45_000, () => this.handleSetupTimeout());
      return;
    }
    if (this.state.gamePhase !== 'playing' || !this.state.currentTurnId) {
      this.turnDeadline.clear();
      return;
    }
    const delayMs =
      this.state.turnPhase === 'draw'
        ? 15_000
        : this.state.turnPhase === 'decision'
          ? 10_000
          : 30_000;
    this.turnDeadline.arm(delayMs, () => this.handlePhaseTimeout());
  }

  private handleSetupTimeout() {
    const requiredCount = this.initialCodeSize;
    this.getActivePlayers()
      .filter((player) => !player.setupComplete)
      .forEach((player) => {
        const colors: DavinciColor[] = [];
        for (let index = 0; index < requiredCount; index += 1) {
          const lightCount = this.pool.filter((tile) => tile.color === 'light').length;
          const darkCount = this.pool.filter((tile) => tile.color === 'dark').length;
          colors.push(lightCount >= darkCount ? 'light' : 'dark');
        }
        const code = drawDavinciCode(this.pool, colors);
        if (!code) return;
        this.codes.set(player.sessionId, sortDavinciCode(code));
        player.setupComplete = true;
        this.updatePublicCode(player);
        this.syncPrivateCode(player);
      });
    this.updatePoolCounts();
    this.broadcast('chat', {
      clientId: 'System',
      message: '⏱️ 준비 시간이 끝나 미선택 시작 타일을 자동으로 배분했습니다.',
    });
    this.beginFirstTurn();
  }

  private handlePhaseTimeout() {
    const sessionId = this.state.currentTurnId;
    const player = this.state.players.get(sessionId);
    if (!player) {
      this.advanceTurn();
      return;
    }
    if (this.state.turnPhase === 'draw') {
      const color = this.pool[0]?.color;
      const tile = color ? drawDavinciTile(this.pool, color) : null;
      if (!tile) {
        this.state.turnPhase = 'guess';
        this.state.turnRevision += 1;
        this.armPhaseDeadline();
        return;
      }
      this.pendingDraws.set(sessionId, tile);
      this.state.drawnTileColor = tile.color;
      this.state.turnPhase = 'guess';
      this.state.turnRevision += 1;
      this.state.lastAction = `${player.nickname}: 시간초과로 ${this.colorLabel(tile.color)} 타일 자동 선택`;
      this.updatePoolCounts();
      this.syncPrivateCode(player);
      this.broadcast('chat', {
        clientId: 'System',
        message: `⏱️ ${player.nickname}님의 시간이 초과되어 타일을 자동으로 선택했습니다.`,
      });
      this.armPhaseDeadline();
      return;
    }
    const revealPending = this.state.turnPhase === 'guess';
    this.state.lastAction = `${player.nickname}: 시간초과로 추리 종료`;
    this.broadcast('chat', {
      clientId: 'System',
      message: `⏱️ ${player.nickname}님의 추리 시간이 초과되어 턴을 종료합니다.`,
    });
    this.completeTurn(sessionId, revealPending);
  }

  private completeTurn(sessionId: string, revealPending: boolean) {
    const pending = this.pendingDraws.get(sessionId);
    if (pending) {
      const nextCode = insertDavinciTile(
        this.getCode(sessionId),
        pending,
        revealPending,
      );
      this.codes.set(sessionId, nextCode);
      this.pendingDraws.delete(sessionId);
      const player = this.state.players.get(sessionId);
      if (player) {
        this.updatePublicCode(player);
        this.syncPrivateCode(player);
        if (isDavinciCodeExposed(nextCode)) {
          player.eliminated = true;
          if (!this.eliminationOrder.includes(sessionId)) {
            this.eliminationOrder.push(sessionId);
          }
        }
      }
    }
    if (this.getActivePlayers().length <= 1) {
      this.finishGame();
      return;
    }
    this.advanceTurn();
  }

  private advanceTurn() {
    const activeIds = this.getActivePlayers().map((player) => player.sessionId);
    this.state.currentTurnId = getNextDavinciPlayerId(
      activeIds,
      this.state.currentTurnId,
    );
    this.state.turnCount += 1;
    this.prepareTurn();
  }

  private finishGame() {
    if (this.state.gamePhase === 'finished') return;
    const winner = this.getActivePlayers()[0];
    const winnerSessionId = winner?.sessionId ?? '';
    const rankings = buildDavinciRankings(
      winnerSessionId,
      this.eliminationOrder.filter((id) => id !== winnerSessionId),
    );
    this.state.gamePhase = 'finished';
    this.turnDeadline?.clear();
    this.state.turnPhase = 'finished';
    this.state.winnerSessionId = winnerSessionId;
    this.state.currentTurnId = '';
    this.state.rankings.clear();
    rankings.forEach((sessionId, index) => {
      const player = this.state.players.get(sessionId);
      if (player) player.rank = index + 1;
      this.state.rankings.push(sessionId);
    });
    this.state.lastAction = `${winner?.nickname ?? '플레이어'} 승리`;
    this.broadcast('chat', {
      clientId: 'System',
      message: `${winner?.nickname ?? '플레이어'}님이 다빈치 코드에서 승리했습니다!`,
    });
    this.syncAllPrivateCodes();
  }

  private canAct(client: Client, phases: string[]) {
    if (this.state.gamePhase !== 'playing') {
      this.rejectRequest(client, 'GAME_NOT_PLAYING', '진행 중인 게임이 아닙니다.');
      return false;
    }
    if (this.state.currentTurnId !== client.sessionId) {
      this.rejectRequest(client, 'NOT_YOUR_TURN', '현재 내 턴이 아닙니다.');
      return false;
    }
    const player = this.state.players.get(client.sessionId);
    if (!player?.connected || player.eliminated) return false;
    if (!phases.includes(this.state.turnPhase)) {
      this.rejectRequest(client, 'INVALID_TURN_PHASE', '현재 단계에서 할 수 없는 행동입니다.');
      return false;
    }
    return true;
  }

  private hasCurrentRevision(revision: number) {
    return revision === this.state.turnRevision;
  }

  private getCode(sessionId: string) {
    return this.codes.get(sessionId) ?? [];
  }

  private getActivePlayers() {
    return Array.from(this.state.players.values()).filter(
      (player) => player.connected && !player.eliminated,
    );
  }

  private updatePublicCode(player: DavinciPlayer) {
    const code = this.getCode(player.sessionId);
    player.code.clear();
    code.forEach((source) => {
      const tile = new DavinciPublicTile();
      tile.id = source.id;
      tile.color = source.color;
      tile.revealed = source.revealed;
      tile.number = source.revealed ? source.number : -1;
      player.code.push(tile);
    });
    player.hiddenCount = code.filter((tile) => !tile.revealed).length;
  }

  private syncPrivateCode(player: DavinciPlayer) {
    const client = this.clients.find(
      (candidate) => candidate.sessionId === player.sessionId,
    );
    if (!client) return;
    const pending = this.pendingDraws.get(player.sessionId);
    client.send(DAVINCI_CODE_MESSAGES.privateCode, {
      revision: this.state.turnRevision,
      tiles: this.getCode(player.sessionId).map((tile) => ({ ...tile })),
      pendingDraw: pending ? { ...pending } : null,
    });
  }

  private syncAllPrivateCodes() {
    this.state.players.forEach((player) => this.syncPrivateCode(player));
  }

  private updatePoolCounts() {
    this.state.lightPoolCount = this.pool.filter((tile) => tile.color === 'light').length;
    this.state.darkPoolCount = this.pool.filter((tile) => tile.color === 'dark').length;
  }

  private colorLabel(color: DavinciColor) {
    return color === 'dark' ? '검정' : '흰색';
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

  private logRejectedRequest(
    code: string,
    event = 'davinci_code.request_rejected',
  ) {
    logRoomEvent('warn', event, {
      roomId: this.roomId,
      gameId: DAVINCI_CODE_GAME.id,
      code,
    });
  }
}
