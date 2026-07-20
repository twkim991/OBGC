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
import { readChatMessage, sendRoomError, SlidingWindowRateLimiter } from '../protocol';
import { createRematchTable } from '../rematch';
import { TurnDeadlineController } from '../turn-timeout';
import { createHalliGalliDeck, dealHalliGalliCards, shuffleHalliGalliCards } from './domain/deck';
import { buildHalliGalliRankings, getNextHalliGalliPlayerId } from './domain/engine';
import { getExactFiveFruit, getVisibleFruitTotals } from './domain/rules';
import type { HalliGalliCard } from './domain/types';
import { HALLI_GALLI_GAME } from './metadata';
import { HALLI_GALLI_MESSAGES, parseHalliGalliRevisionPayload } from './protocol';
import { HalliGalliPlayer, HalliGalliState } from './schema';

export class HalliGalliRoom extends Room<HalliGalliState> {
  private turnDeadline!: TurnDeadlineController;
  private decks = new Map<string, HalliGalliCard[]>();
  private faceUpPiles = new Map<string, HalliGalliCard[]>();
  private readonly playerIds = new Map<string, string>();
  private readonly clientProtocols = new Map<string, Record<string, number>>();
  private readonly wrongBellRevisions = new Map<string, number>();
  private readonly chatLimiter = new SlidingWindowRateLimiter(5, 5000);
  private migrationSeats = new MigrationSeatRegistry();
  private isReturning = false;

  onCreate(options: unknown) {
    this.setState(new HalliGalliState());
    this.turnDeadline = new TurnDeadlineController(
      (callback, delayMs) => void this.clock.setTimeout(callback, delayMs),
      (deadlineAt) => (this.state.turnDeadlineAt = deadlineAt),
    );
    this.setSeatReservationTime(MIGRATION_SEAT_SECONDS);
    this.migrationSeats = new MigrationSeatRegistry(options);
    this.maxClients = this.migrationSeats.total || HALLI_GALLI_GAME.maxPlayers;

    this.clock.setTimeout(async () => {
      if (this.state.migrationReady) return;
      this.migrationSeats.expire();
      this.logRejectedRequest('MIGRATION_TIMEOUT', 'halli_galli.migration_aborted');
      this.broadcast('migration_aborted', {
        message: '모든 참가자가 제한 시간 안에 할리갈리 방으로 이동하지 못했습니다.',
      });
      await this.disconnect();
    }, MIGRATION_ABORT_MS);

    this.onMessage('chat', (client, message) => this.handleChat(client, message));
    this.onMessage(HALLI_GALLI_MESSAGES.startGame, (client) => this.handleStartGame(client));
    this.onMessage(HALLI_GALLI_MESSAGES.flipCard, (client, payload) => this.handleFlipCard(client, payload));
    this.onMessage(HALLI_GALLI_MESSAGES.ringBell, (client, payload) => this.handleRingBell(client, payload));
    this.onMessage(HALLI_GALLI_MESSAGES.returnToTable, (client) => void this.handleReturnToTable(client));
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
    const player = new HalliGalliPlayer();
    player.sessionId = client.sessionId;
    player.nickname = seat.nickname;
    player.isHost = seat.isHost;
    this.playerIds.set(client.sessionId, seat.playerId);
    this.clientProtocols.set(client.sessionId, seat.protocolVersions);
    this.decks.set(client.sessionId, []);
    this.faceUpPiles.set(client.sessionId, []);
    if (player.isHost) {
      this.state.players.forEach((candidate) => (candidate.isHost = false));
      this.state.hostSessionId = client.sessionId;
    }
    this.state.players.set(client.sessionId, player);
    this.finalizeMigrationIfReady();
    this.broadcast('chat', { clientId: 'System', message: `${player.nickname} 님이 입장했습니다.` });
  }

  async onLeave(client: Client, consented: boolean) {
    if (!consented) {
      try {
        await this.allowReconnection(client, 20);
        const player = this.state.players.get(client.sessionId);
        if (player) player.connected = true;
        this.finalizeMigrationIfReady();
        return;
      } catch {
        // 재연결 제한이 지나면 이탈로 확정한다.
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
      this.decks.delete(client.sessionId);
      this.faceUpPiles.delete(client.sessionId);
      if (wasHost) this.transferHost();
      return;
    }

    player.connected = false;
    player.eliminated = true;
    if (player.isHost) this.transferHost();
    this.broadcast('chat', { clientId: 'System', message: `${player.nickname} 님이 게임에서 이탈했습니다.` });
    const active = this.getActivePlayers();
    if (active.length <= 1) {
      this.finishGame(active[0]?.sessionId ?? '');
      return;
    }
    this.state.finalRound = active.length === 2;
    if (this.state.currentTurnId === client.sessionId) {
      this.advanceTurn();
      this.armFlipDeadline();
    }
    this.syncAllPlayers();
  }

  private handleChat(client: Client, message: unknown) {
    const normalized = readChatMessage(message);
    if (!normalized) return this.rejectRequest(client, 'INVALID_CHAT', '채팅은 1~300자로 입력해주세요.');
    if (!this.chatLimiter.allow(client.sessionId)) return this.rejectRequest(client, 'CHAT_RATE_LIMIT', '채팅을 너무 빠르게 보내고 있습니다.');
    const player = this.state.players.get(client.sessionId);
    this.broadcast('chat', { clientId: player?.nickname ?? client.sessionId, message: `[할리갈리] ${normalized}` });
  }

  private handleStartGame(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (this.state.gamePhase !== 'waiting') return this.rejectRequest(client, 'GAME_ALREADY_STARTED', '이미 게임이 시작되었습니다.');
    if (!player?.isHost) return this.rejectRequest(client, 'NOT_HOST', '방장만 게임을 시작할 수 있습니다.');
    if (this.state.players.size < HALLI_GALLI_GAME.minPlayers) {
      return this.rejectRequest(client, 'NOT_ENOUGH_PLAYERS', '할리갈리는 2명 이상 모여야 시작할 수 있습니다.');
    }
    this.startGame();
  }

  private handleFlipCard(client: Client, payload: unknown) {
    if (!this.canPlay(client)) return;
    if (this.state.currentTurnId !== client.sessionId) return this.rejectRequest(client, 'NOT_YOUR_TURN', '현재 내 차례가 아닙니다.');
    const parsed = parseHalliGalliRevisionPayload(payload);
    if (!parsed || parsed.boardRevision !== this.state.boardRevision) return this.rejectRequest(client, 'STALE_BOARD', '테이블 상태가 바뀌었습니다. 다시 시도해주세요.');
    const deck = this.decks.get(client.sessionId) ?? [];
    const card = deck.pop();
    if (!card) return this.rejectRequest(client, 'DECK_EMPTY', '공개할 카드가 없습니다. 다음 종 판정을 기다려주세요.');
    this.faceUpPiles.get(client.sessionId)?.push(card);
    this.state.turnCount += 1;
    this.state.boardRevision += 1;
    this.state.lastBellPlayerId = '';
    this.state.lastBellResult = '';
    this.wrongBellRevisions.clear();
    this.state.lastAction = `${this.playerName(client.sessionId)}: ${this.fruitLabel(card.fruit)} ${card.count}개 공개`;
    this.advanceTurn();
    this.syncAllPlayers();
    this.armFlipDeadline();
  }

  private handleRingBell(client: Client, payload: unknown) {
    if (!this.canPlay(client)) return;
    const parsed = parseHalliGalliRevisionPayload(payload);
    if (!parsed || parsed.boardRevision !== this.state.boardRevision) return this.rejectRequest(client, 'STALE_BOARD', '이미 다른 종 판정으로 테이블이 바뀌었습니다.');
    if (this.state.bellLocked) return this.rejectRequest(client, 'BELL_LOCKED', '이미 종 판정이 진행 중입니다.');
    if (this.wrongBellRevisions.get(client.sessionId) === this.state.boardRevision) return this.rejectRequest(client, 'BELL_ALREADY_TRIED', '같은 카드 상태에서는 종을 한 번만 누를 수 있습니다.');

    const exactFruit = this.getExactFiveFruit();
    this.state.lastBellPlayerId = client.sessionId;
    if (exactFruit) {
      this.state.bellLocked = true;
      this.state.lastBellResult = 'correct';
      this.collectFaceUpCards(client.sessionId);
      this.state.lastAction = `${this.playerName(client.sessionId)}: ${this.fruitLabel(exactFruit)} 5개 정답`;
      this.broadcast('chat', { clientId: 'System', message: `${this.playerName(client.sessionId)}님이 ${this.fruitLabel(exactFruit)} 5개를 가장 먼저 찾아 공개 더미를 획득했습니다.` });
      if (this.state.finalRound) {
        this.state.boardRevision += 1;
        this.finishGame(client.sessionId);
        return;
      }
      this.eliminateEmptyPlayers(client.sessionId);
      const active = this.getActivePlayers();
      if (active.length <= 1) {
        this.finishGame(active[0]?.sessionId ?? client.sessionId);
        return;
      }
      this.state.roundCount += 1;
      this.state.boardRevision += 1;
      this.state.currentTurnId = client.sessionId;
      this.state.finalRound = active.length === 2;
      this.state.bellLocked = false;
      this.wrongBellRevisions.clear();
      this.syncAllPlayers();
      this.armFlipDeadline();
      return;
    }

    this.state.lastBellResult = 'wrong';
    this.wrongBellRevisions.set(client.sessionId, this.state.boardRevision);
    if (this.state.finalRound) {
      const opponent = this.getActivePlayers().find((player) => player.sessionId !== client.sessionId);
      if (opponent) this.collectFaceUpCards(opponent.sessionId);
      this.state.lastAction = `${this.playerName(client.sessionId)}: 오답 종 · 최종 라운드 종료`;
      this.state.boardRevision += 1;
      this.finishGame(opponent?.sessionId ?? '');
      return;
    }

    const opponents = this.getActivePlayers().filter((player) => player.sessionId !== client.sessionId);
    const sourceDeck = this.decks.get(client.sessionId) ?? [];
    let penalty = 0;
    opponents.forEach((opponent) => {
      const card = sourceDeck.pop();
      if (!card) return;
      this.decks.get(opponent.sessionId)?.unshift(card);
      penalty += 1;
    });
    this.state.lastAction = `${this.playerName(client.sessionId)}: 오답 종 · ${penalty}장 배분`;
    this.broadcast('chat', { clientId: 'System', message: `${this.playerName(client.sessionId)}님이 종을 잘못 눌러 상대에게 ${penalty}장을 나누어 줬습니다.` });
    this.syncAllPlayers();
  }

  private startGame() {
    const playerIds = this.getActivePlayers().map((player) => player.sessionId);
    this.decks = dealHalliGalliCards(shuffleHalliGalliCards(createHalliGalliDeck()), playerIds);
    this.faceUpPiles = new Map(playerIds.map((id) => [id, []]));
    this.wrongBellRevisions.clear();
    this.state.gamePhase = 'playing';
    this.state.currentTurnId = playerIds[0] ?? '';
    this.state.boardRevision = 1;
    this.state.turnCount = 0;
    this.state.roundCount = 1;
    this.state.bellLocked = false;
    this.state.finalRound = playerIds.length === 2;
    this.state.winnerSessionId = '';
    this.state.rankings.clear();
    this.state.lastBellPlayerId = '';
    this.state.lastBellResult = '';
    this.state.lastAction = '첫 카드 공개 대기';
    this.state.players.forEach((player) => {
      player.eliminated = false;
      player.connected = true;
      player.rank = 0;
    });
    this.syncAllPlayers();
    this.broadcast('chat', { clientId: 'System', message: '할리갈리가 시작되었습니다. 같은 과일이 정확히 5개 보이면 종을 누르세요!' });
    this.armFlipDeadline();
  }

  private canPlay(client: Client) {
    if (this.state.gamePhase !== 'playing') {
      this.rejectRequest(client, 'GAME_NOT_PLAYING', '진행 중인 게임이 아닙니다.');
      return false;
    }
    const player = this.state.players.get(client.sessionId);
    if (!player?.connected || player.eliminated) {
      this.rejectRequest(client, 'PLAYER_ELIMINATED', '현재 게임에 참여할 수 없습니다.');
      return false;
    }
    return true;
  }

  private advanceTurn() {
    const activeIds = this.getActivePlayers().map((player) => player.sessionId);
    this.state.currentTurnId = getNextHalliGalliPlayerId(
      activeIds,
      this.state.currentTurnId,
      (id) => (this.decks.get(id)?.length ?? 0) > 0,
    );
    // 마지막 카드로 정확히 5개가 만들어졌다면 종 반응 기회를 남긴다.
    if (!this.state.currentTurnId && !this.getExactFiveFruit()) this.finishGameByCards();
  }

  private armFlipDeadline() {
    if (!this.turnDeadline) return;
    if (this.state.gamePhase === 'playing' && !this.state.currentTurnId && this.getExactFiveFruit()) {
      this.turnDeadline.arm(5_000, () => this.finishGameByCards());
      return;
    }
    if (this.state.gamePhase !== 'playing' || !this.state.currentTurnId) {
      this.turnDeadline.clear();
      return;
    }
    this.turnDeadline.arm(12_000, () => {
      const client = this.clients.find(
        (candidate) => candidate.sessionId === this.state.currentTurnId,
      );
      if (!client) {
        this.advanceTurn();
        this.armFlipDeadline();
        return;
      }
      this.broadcast('chat', {
        clientId: 'System',
        message: `⏱️ ${this.playerName(client.sessionId)}님의 시간이 초과되어 카드를 자동으로 뒤집습니다.`,
      });
      this.handleFlipCard(client, { boardRevision: this.state.boardRevision });
    });
  }

  private collectFaceUpCards(sessionId: string) {
    const collected = shuffleHalliGalliCards([...this.faceUpPiles.values()].flat());
    const deck = this.decks.get(sessionId) ?? [];
    deck.unshift(...collected);
    this.decks.set(sessionId, deck);
    this.faceUpPiles.forEach((pile) => pile.splice(0));
  }

  private eliminateEmptyPlayers(winnerId: string) {
    this.getActivePlayers().forEach((player) => {
      if (player.sessionId !== winnerId && (this.decks.get(player.sessionId)?.length ?? 0) === 0) {
        player.eliminated = true;
      }
    });
  }

  private finishGameByCards() {
    const counts = this.getOwnedCardCounts();
    const winner = buildHalliGalliRankings([...counts.keys()], counts)[0] ?? '';
    this.finishGame(winner);
  }

  private finishGame(preferredWinnerId: string) {
    if (this.state.gamePhase === 'finished') return;
    const playerIds = Array.from(this.state.players.values())
      .filter((player) => player.connected)
      .map((player) => player.sessionId);
    const rankings = buildHalliGalliRankings(playerIds, this.getOwnedCardCounts(), preferredWinnerId);
    const winnerSessionId = rankings[0] ?? preferredWinnerId;
    this.state.gamePhase = 'finished';
    this.turnDeadline?.clear();
    this.state.currentTurnId = '';
    this.state.bellLocked = true;
    this.state.winnerSessionId = winnerSessionId;
    this.state.rankings.clear();
    rankings.forEach((id, index) => {
      this.state.rankings.push(id);
      const player = this.state.players.get(id);
      if (player) player.rank = index + 1;
    });
    this.state.lastAction = `${this.playerName(winnerSessionId)} 승리`;
    this.syncAllPlayers();
    this.broadcast('chat', { clientId: 'System', message: `${this.playerName(winnerSessionId)}님이 할리갈리에서 승리했습니다!` });
  }

  private getOwnedCardCounts() {
    return new Map(
      Array.from(this.state.players.values()).map((player) => [
        player.sessionId,
        (this.decks.get(player.sessionId)?.length ?? 0) + (this.faceUpPiles.get(player.sessionId)?.length ?? 0),
      ]),
    );
  }

  private syncAllPlayers() {
    this.state.players.forEach((player) => {
      const deck = this.decks.get(player.sessionId) ?? [];
      const pile = this.faceUpPiles.get(player.sessionId) ?? [];
      const top = pile[pile.length - 1];
      player.deckCount = deck.length;
      player.faceUpCount = pile.length;
      player.topCard.id = top?.id ?? '';
      player.topCard.fruit = top?.fruit ?? '';
      player.topCard.count = top?.count ?? 0;
    });
    this.state.exactFiveFruit = this.getExactFiveFruit() ?? '';
  }

  private getExactFiveFruit() {
    const topCards = [...this.faceUpPiles.values()].map((pile) => pile[pile.length - 1]);
    return getExactFiveFruit(getVisibleFruitTotals(topCards));
  }

  private getActivePlayers() {
    return Array.from(this.state.players.values()).filter((player) => player.connected && !player.eliminated);
  }

  private playerName(sessionId: string) {
    return this.state.players.get(sessionId)?.nickname ?? '플레이어';
  }

  private fruitLabel(fruit: string) {
    return ({ strawberry: '딸기', banana: '바나나', lime: '라임', plum: '자두' } as Record<string, string>)[fruit] ?? fruit;
  }

  private async handleReturnToTable(client: Client) {
    if (this.isReturning || !this.state.players.has(client.sessionId)) return;
    this.isReturning = true;
    try {
      const participants = this.clients.reduce<MigrationParticipant[]>((result, participantClient) => {
        const player = this.state.players.get(participantClient.sessionId);
        if (player) result.push({
          sourceSessionId: participantClient.sessionId,
          playerId: this.playerIds.get(participantClient.sessionId) ?? participantClient.sessionId,
          nickname: player.nickname,
          isHost: player.isHost,
          protocolVersions: this.clientProtocols.get(participantClient.sessionId) ?? {},
        });
        return result;
      }, []);
      const migration = await createRematchTable(HALLI_GALLI_GAME, participants);
      this.clients.forEach((participantClient) => {
        const reservation = migration.reservations.get(participantClient.sessionId);
        if (reservation) participantClient.send('move_room', { reservation, gameType: 'table' });
      });
      this.clock.setTimeout(() => (this.isReturning = false), MIGRATION_RETRY_MS);
    } catch (error) {
      logRoomError('halli_galli.rematch_migration_failed', error, { roomId: this.roomId, gameId: HALLI_GALLI_GAME.id });
      this.isReturning = false;
    }
  }

  private transferHost() {
    this.state.players.forEach((player) => (player.isHost = false));
    const nextHost = Array.from(this.state.players.values()).find((player) => player.connected);
    this.state.hostSessionId = nextHost?.sessionId ?? '';
    if (nextHost) nextHost.isHost = true;
  }

  private finalizeMigrationIfReady() {
    if (this.state.migrationReady || !isMigrationGroupReady(this.migrationSeats, this.clients.length)) return;
    this.state.migrationReady = true;
    if (!this.state.hostSessionId) this.transferHost();
    this.broadcast('migration_ready');
  }

  private rejectRequest(client: Client, code: string, message: string) {
    this.logRejectedRequest(code);
    sendRoomError(client, code, message);
  }

  private logRejectedRequest(code: string, event = 'halli_galli.request_rejected') {
    logRoomEvent('warn', event, { roomId: this.roomId, gameId: HALLI_GALLI_GAME.id, code });
  }
}
