import { Client, Room } from '@colyseus/core';
import { ArraySchema } from '@colyseus/schema';
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
  createLostCitiesDeck,
  dealLostCitiesHands,
  shuffleLostCitiesDeck,
} from './domain/deck';
import {
  buildLostCitiesRankings,
  getLostCitiesWinnerIds,
  getNextLostCitiesPlayerId,
  selectLostCitiesRoundStarter,
  type LostCitiesScoreEntry,
} from './domain/engine';
import {
  canPlayLostCitiesCard,
  createEmptyLostCitiesRoutes,
  scoreLostCitiesExpedition,
  scoreLostCitiesRoutes,
} from './domain/rules';
import {
  LOST_CITIES_COLORS,
  type LostCitiesCard,
  type LostCitiesColor,
  type LostCitiesRoutes,
} from './domain/types';
import { LOST_CITIES_GAME } from './metadata';
import {
  LOST_CITIES_MESSAGES,
  parseLostCitiesDrawPayload,
  parseLostCitiesPlayPayload,
} from './protocol';
import {
  LostCitiesDiscardPiles,
  LostCitiesExpeditions,
  LostCitiesPlayer,
  LostCitiesPublicCard,
  LostCitiesState,
} from './schema';

const createEmptyDiscardPiles = () =>
  Object.fromEntries(LOST_CITIES_COLORS.map((color) => [color, []])) as Record<
    LostCitiesColor,
    LostCitiesCard[]
  >;

export class LostCitiesRoom extends Room<LostCitiesState> {
  private turnDeadline!: TurnDeadlineController;
  private deck: LostCitiesCard[] = [];
  private hands = new Map<string, LostCitiesCard[]>();
  private routes = new Map<string, LostCitiesRoutes>();
  private discardPiles = createEmptyDiscardPiles();
  private readonly playerIds = new Map<string, string>();
  private readonly clientProtocols = new Map<string, Record<string, number>>();
  private readonly chatLimiter = new SlidingWindowRateLimiter(5, 5000);
  private migrationSeats = new MigrationSeatRegistry();
  private isReturning = false;

  onCreate(options: unknown) {
    this.setState(new LostCitiesState());
    this.turnDeadline = new TurnDeadlineController(
      (callback, delayMs) => void this.clock.setTimeout(callback, delayMs),
      (deadlineAt) => (this.state.turnDeadlineAt = deadlineAt),
    );
    this.setSeatReservationTime(MIGRATION_SEAT_SECONDS);
    this.migrationSeats = new MigrationSeatRegistry(options);
    this.maxClients = this.migrationSeats.total || LOST_CITIES_GAME.maxPlayers;

    this.clock.setTimeout(async () => {
      if (this.state.migrationReady) return;
      this.migrationSeats.expire();
      this.logRejectedRequest(
        'MIGRATION_TIMEOUT',
        'lost_cities.migration_aborted',
      );
      this.broadcast('migration_aborted', {
        message:
          '모든 참가자가 제한 시간 안에 로스트시티 방으로 이동하지 못했습니다.',
      });
      await this.disconnect();
    }, MIGRATION_ABORT_MS);

    this.onMessage('chat', (client, message) =>
      this.handleChat(client, message),
    );
    this.onMessage(LOST_CITIES_MESSAGES.requestPrivateState, (client) =>
      this.sendPrivateHand(client),
    );
    this.onMessage(LOST_CITIES_MESSAGES.startGame, (client) =>
      this.handleStartGame(client),
    );
    this.onMessage(LOST_CITIES_MESSAGES.playCard, (client, payload) =>
      this.handlePlayCard(client, payload),
    );
    this.onMessage(LOST_CITIES_MESSAGES.drawCard, (client, payload) =>
      this.handleDrawCard(client, payload),
    );
    this.onMessage(LOST_CITIES_MESSAGES.nextRound, (client) =>
      this.handleNextRound(client),
    );
    this.onMessage(
      LOST_CITIES_MESSAGES.returnToTable,
      (client) => void this.handleReturnToTable(client),
    );
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

    const player = new LostCitiesPlayer();
    player.sessionId = client.sessionId;
    player.nickname = seat.nickname;
    player.isHost = seat.isHost;
    this.playerIds.set(client.sessionId, seat.playerId);
    this.clientProtocols.set(client.sessionId, seat.protocolVersions);
    this.hands.set(client.sessionId, []);
    this.routes.set(client.sessionId, createEmptyLostCitiesRoutes());
    if (player.isHost) {
      this.state.players.forEach((candidate) => (candidate.isHost = false));
      this.state.hostSessionId = client.sessionId;
    }
    this.state.players.set(client.sessionId, player);
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
        if (player) player.connected = true;
        this.sendPrivateHand(client);
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
      this.hands.delete(client.sessionId);
      this.routes.delete(client.sessionId);
      if (wasHost) this.transferHost();
      return;
    }

    player.connected = false;
    if (player.isHost) this.transferHost();
    this.broadcast('chat', {
      clientId: 'System',
      message: `${player.nickname} 님이 게임에서 이탈했습니다.`,
    });
    this.finishByForfeit(client.sessionId);
  }

  private handleChat(client: Client, message: unknown) {
    const normalized = readChatMessage(message);
    if (!normalized)
      return this.rejectRequest(
        client,
        'INVALID_CHAT',
        '채팅은 1~300자로 입력해주세요.',
      );
    if (!this.chatLimiter.allow(client.sessionId))
      return this.rejectRequest(
        client,
        'CHAT_RATE_LIMIT',
        '채팅을 너무 빠르게 보내고 있습니다.',
      );
    const player = this.state.players.get(client.sessionId);
    this.broadcast('chat', {
      clientId: player?.nickname ?? client.sessionId,
      message: `[로스트시티] ${normalized}`,
    });
  }

  private handleStartGame(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (this.state.gamePhase !== 'waiting')
      return this.rejectRequest(
        client,
        'GAME_ALREADY_STARTED',
        '이미 게임이 시작되었습니다.',
      );
    if (!player?.isHost)
      return this.rejectRequest(
        client,
        'NOT_HOST',
        '방장만 게임을 시작할 수 있습니다.',
      );
    if (this.getConnectedPlayers().length !== 2)
      return this.rejectRequest(
        client,
        'NOT_ENOUGH_PLAYERS',
        '로스트시티는 정확히 2명이 모여야 시작할 수 있습니다.',
      );

    this.state.players.forEach((candidate) => {
      candidate.totalScore = 0;
      candidate.roundScore = 0;
      candidate.rank = 0;
    });
    this.state.roundCount = 1;
    this.state.roundStarterId = client.sessionId;
    this.setupRound(client.sessionId);
  }

  private handlePlayCard(client: Client, payload: unknown) {
    if (!this.canAct(client, 'play')) return;
    const parsed = parseLostCitiesPlayPayload(payload);
    if (!parsed || parsed.turnRevision !== this.state.turnRevision) {
      return this.rejectRequest(
        client,
        'STALE_TURN',
        '테이블 상태가 바뀌었습니다. 다시 선택해주세요.',
      );
    }
    const hand = this.hands.get(client.sessionId) ?? [];
    const cardIndex = hand.findIndex((card) => card.id === parsed.cardId);
    const card = hand[cardIndex];
    if (!card)
      return this.rejectRequest(
        client,
        'CARD_NOT_FOUND',
        '선택한 카드가 손패에 없습니다.',
      );

    if (parsed.destination === 'expedition') {
      const routes =
        this.routes.get(client.sessionId) ?? createEmptyLostCitiesRoutes();
      if (!canPlayLostCitiesCard(card, routes[card.color])) {
        return this.rejectRequest(
          client,
          'INVALID_EXPEDITION_ORDER',
          '탐험 카드는 기존 숫자보다 큰 값만 놓을 수 있습니다.',
        );
      }
      routes[card.color].push(card);
      this.routes.set(client.sessionId, routes);
      this.state.blockedDiscardColor = '';
      this.state.lastAction = `${this.playerName(
        client.sessionId,
      )}: ${this.colorLabel(card.color)} ${this.cardLabel(card)} 탐험`;
      this.syncPlayerExpeditions(client.sessionId);
    } else {
      this.discardPiles[card.color].push(card);
      this.state.blockedDiscardColor = card.color;
      this.state.lastAction = `${this.playerName(
        client.sessionId,
      )}: ${this.colorLabel(card.color)} ${this.cardLabel(card)} 버림`;
      this.syncDiscardPile(card.color);
    }

    hand.splice(cardIndex, 1);
    const player = this.state.players.get(client.sessionId);
    if (player) player.handCount = hand.length;
    this.state.actionPhase = 'draw';
    this.state.turnRevision += 1;
    this.sendPrivateHand(client);
    this.armActionDeadline();
  }

  private handleDrawCard(client: Client, payload: unknown) {
    if (!this.canAct(client, 'draw')) return;
    const parsed = parseLostCitiesDrawPayload(payload);
    if (!parsed || parsed.turnRevision !== this.state.turnRevision) {
      return this.rejectRequest(
        client,
        'STALE_TURN',
        '테이블 상태가 바뀌었습니다. 다시 선택해주세요.',
      );
    }

    let card: LostCitiesCard | undefined;
    let sourceLabel = '뒷면 더미';
    if (parsed.source === 'deck') {
      card = this.deck.pop();
      if (!card)
        return this.rejectRequest(
          client,
          'DECK_EMPTY',
          '뒷면 더미에 남은 카드가 없습니다.',
        );
      this.state.deckCount = this.deck.length;
    } else {
      if (!parsed.color || parsed.color === this.state.blockedDiscardColor) {
        return this.rejectRequest(
          client,
          'BLOCKED_DISCARD',
          '이번 차례에 방금 버린 카드는 다시 가져올 수 없습니다.',
        );
      }
      card = this.discardPiles[parsed.color].pop();
      if (!card)
        return this.rejectRequest(
          client,
          'EMPTY_DISCARD',
          '선택한 버림 더미가 비어 있습니다.',
        );
      sourceLabel = `${this.colorLabel(parsed.color)} 버림 더미`;
      this.syncDiscardPile(parsed.color);
    }

    const hand = this.hands.get(client.sessionId) ?? [];
    hand.push(card);
    this.hands.set(client.sessionId, hand);
    const player = this.state.players.get(client.sessionId);
    if (player) player.handCount = hand.length;
    this.state.lastAction = `${this.playerName(
      client.sessionId,
    )}: ${sourceLabel}에서 카드 뽑음`;
    this.state.turnCount += 1;
    this.state.turnRevision += 1;
    this.sendPrivateHand(client);

    if (parsed.source === 'deck' && this.deck.length === 0) {
      this.finishRound();
      return;
    }

    this.state.currentTurnId = getNextLostCitiesPlayerId(
      this.getConnectedPlayers().map((candidate) => candidate.sessionId),
      client.sessionId,
    );
    this.state.actionPhase = 'play';
    this.state.blockedDiscardColor = '';
    this.armActionDeadline();
  }

  private handleNextRound(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (this.state.gamePhase !== 'round_result')
      return this.rejectRequest(
        client,
        'ROUND_NOT_READY',
        '현재는 다음 라운드를 시작할 수 없습니다.',
      );
    if (!player?.isHost)
      return this.rejectRequest(
        client,
        'NOT_HOST',
        '방장만 다음 라운드를 시작할 수 있습니다.',
      );
    const starterId = selectLostCitiesRoundStarter(
      this.scoreEntries(),
      this.state.roundStarterId,
    );
    this.state.roundCount += 1;
    this.state.roundStarterId = starterId;
    this.setupRound(starterId);
  }

  private setupRound(starterId: string) {
    const playerIds = this.getConnectedPlayers().map(
      (player) => player.sessionId,
    );
    const dealt = dealLostCitiesHands(
      shuffleLostCitiesDeck(createLostCitiesDeck()),
      playerIds,
    );
    this.deck = dealt.deck;
    this.hands = dealt.hands;
    this.routes = new Map(
      playerIds.map((id) => [id, createEmptyLostCitiesRoutes()]),
    );
    this.discardPiles = createEmptyDiscardPiles();
    this.state.discards = new LostCitiesDiscardPiles();
    this.state.players.forEach((player) => {
      player.expeditions = new LostCitiesExpeditions();
      player.handCount = this.hands.get(player.sessionId)?.length ?? 0;
      player.roundScore = 0;
      player.rank = 0;
    });
    this.state.currentTurnId = starterId;
    this.state.gamePhase = 'playing';
    this.state.actionPhase = 'play';
    this.state.turnCount = 0;
    this.state.turnRevision += 1;
    this.state.deckCount = this.deck.length;
    this.state.blockedDiscardColor = '';
    this.state.roundWinnerIds = new ArraySchema<string>();
    this.state.winnerSessionIds = new ArraySchema<string>();
    this.state.rankings = new ArraySchema<string>();
    this.state.lastAction = `${this.playerName(starterId)}님이 ${
      this.state.roundCount
    }라운드를 시작합니다.`;
    this.syncAllPrivateHands();
    this.armActionDeadline();
  }

  private finishRound() {
    this.state.players.forEach((player) => {
      const routes =
        this.routes.get(player.sessionId) ?? createEmptyLostCitiesRoutes();
      player.roundScore = scoreLostCitiesRoutes(routes);
      player.totalScore += player.roundScore;
      this.syncPlayerExpeditions(player.sessionId);
    });
    const entries = this.scoreEntries();
    const bestRoundScore = Math.max(
      ...entries.map((entry) => entry.roundScore),
    );
    this.state.roundWinnerIds = new ArraySchema<string>(
      ...entries
        .filter((entry) => entry.roundScore === bestRoundScore)
        .map((entry) => entry.sessionId),
    );
    this.state.actionPhase = 'round_result';
    this.state.blockedDiscardColor = '';
    if (this.state.roundCount >= 3) {
      this.finishGame();
      return;
    }
    this.state.gamePhase = 'round_result';
    this.state.lastAction = `${this.state.roundCount}라운드가 종료되었습니다.`;
    this.armActionDeadline();
  }

  private finishGame() {
    const entries = this.scoreEntries();
    const rankings = buildLostCitiesRankings(entries);
    this.state.rankings = new ArraySchema<string>(...rankings);
    this.state.winnerSessionIds = new ArraySchema<string>(
      ...getLostCitiesWinnerIds(entries),
    );
    rankings.forEach((sessionId, index) => {
      const player = this.state.players.get(sessionId);
      if (player) player.rank = index + 1;
    });
    this.state.gamePhase = 'finished';
    this.turnDeadline?.clear();
    this.state.actionPhase = 'finished';
    this.state.lastAction = `${this.state.winnerSessionIds
      .map((id) => this.playerName(id))
      .join(', ')} 승리`;
  }

  private finishByForfeit(leavingId: string) {
    const remainingIds = Array.from(this.state.players.values())
      .filter((player) => player.connected && player.sessionId !== leavingId)
      .map((player) => player.sessionId);
    const rankings = [...remainingIds, leavingId];
    this.state.rankings = new ArraySchema<string>(...rankings);
    this.state.winnerSessionIds = new ArraySchema<string>(
      ...remainingIds.slice(0, 1),
    );
    rankings.forEach((sessionId, index) => {
      const player = this.state.players.get(sessionId);
      if (player) player.rank = index + 1;
    });
    this.state.gamePhase = 'finished';
    this.turnDeadline?.clear();
    this.state.actionPhase = 'finished';
    this.state.lastAction = remainingIds.length
      ? `${this.playerName(remainingIds[0])}님이 상대 이탈로 승리했습니다.`
      : '게임이 종료되었습니다.';
  }

  private armActionDeadline() {
    if (!this.turnDeadline) return;
    if (this.state.gamePhase === 'round_result') {
      this.turnDeadline.arm(20_000, () => {
        const starterId = selectLostCitiesRoundStarter(
          this.scoreEntries(),
          this.state.roundStarterId,
        );
        this.state.roundCount += 1;
        this.state.roundStarterId = starterId;
        this.broadcast('chat', {
          clientId: 'System',
          message: '⏱️ 라운드 전환 시간이 끝나 다음 라운드를 자동으로 시작합니다.',
        });
        this.setupRound(starterId);
      });
      return;
    }
    if (this.state.gamePhase !== 'playing' || !this.state.currentTurnId) {
      this.turnDeadline.clear();
      return;
    }
    this.turnDeadline.arm(
      this.state.actionPhase === 'draw' ? 15_000 : 30_000,
      () => this.handleActionTimeout(),
    );
  }

  private handleActionTimeout() {
    const sessionId = this.state.currentTurnId;
    const client = this.clients.find((candidate) => candidate.sessionId === sessionId);
    if (!client) {
      this.finishByForfeit(sessionId);
      return;
    }
    this.broadcast('chat', {
      clientId: 'System',
      message: `⏱️ ${this.playerName(sessionId)}님의 시간이 초과되어 행동을 자동으로 처리합니다.`,
    });
    if (this.state.actionPhase === 'draw') {
      this.handleDrawCard(client, {
        source: 'deck',
        color: '',
        turnRevision: this.state.turnRevision,
      });
      return;
    }
    const card = [...(this.hands.get(sessionId) ?? [])].sort(
      (left, right) => left.value - right.value,
    )[0];
    if (!card) {
      this.finishByForfeit(sessionId);
      return;
    }
    this.handlePlayCard(client, {
      cardId: card.id,
      destination: 'discard',
      turnRevision: this.state.turnRevision,
    });
  }

  private canAct(client: Client, actionPhase: 'play' | 'draw') {
    const player = this.state.players.get(client.sessionId);
    if (this.state.gamePhase !== 'playing') {
      this.rejectRequest(
        client,
        'GAME_NOT_PLAYING',
        '현재 게임이 진행 중이 아닙니다.',
      );
      return false;
    }
    if (!player?.connected || this.state.currentTurnId !== client.sessionId) {
      this.rejectRequest(client, 'NOT_YOUR_TURN', '현재 내 차례가 아닙니다.');
      return false;
    }
    if (this.state.actionPhase !== actionPhase) {
      this.rejectRequest(
        client,
        'WRONG_PHASE',
        actionPhase === 'play'
          ? '먼저 카드를 내려놓아야 합니다.'
          : '먼저 카드 한 장을 뽑아야 합니다.',
      );
      return false;
    }
    return true;
  }

  private syncPlayerExpeditions(sessionId: string) {
    const player = this.state.players.get(sessionId);
    const routes = this.routes.get(sessionId);
    if (!player || !routes) return;
    LOST_CITIES_COLORS.forEach((color) => {
      const target = player.expeditions[color];
      target.cards = new ArraySchema<LostCitiesPublicCard>(
        ...routes[color].map((card) => this.toPublicCard(card)),
      );
      target.score = scoreLostCitiesExpedition(routes[color]);
    });
    player.roundScore = scoreLostCitiesRoutes(routes);
  }

  private syncDiscardPile(color: LostCitiesColor) {
    const pile = this.discardPiles[color];
    const target = this.state.discards[color];
    target.count = pile.length;
    target.topCard = this.toPublicCard(pile[pile.length - 1]);
  }

  private toPublicCard(card?: LostCitiesCard) {
    const publicCard = new LostCitiesPublicCard();
    if (!card) return publicCard;
    publicCard.id = card.id;
    publicCard.color = card.color;
    publicCard.kind = card.kind;
    publicCard.value = card.value;
    return publicCard;
  }

  private sendPrivateHand(client: Client) {
    const cards = this.hands.get(client.sessionId) ?? [];
    client.send(LOST_CITIES_MESSAGES.privateHand, {
      revision: this.state.turnRevision,
      cards: cards.map((card) => ({ ...card })),
    });
  }

  private syncAllPrivateHands() {
    this.clients.forEach((client) => this.sendPrivateHand(client));
  }

  private scoreEntries(): LostCitiesScoreEntry[] {
    return Array.from(this.state.players.values()).map((player) => ({
      sessionId: player.sessionId,
      roundScore: player.roundScore,
      totalScore: player.totalScore,
    }));
  }

  private getConnectedPlayers() {
    return Array.from(this.state.players.values()).filter(
      (player) => player.connected,
    );
  }

  private playerName(sessionId: string) {
    return this.state.players.get(sessionId)?.nickname ?? '플레이어';
  }

  private colorLabel(color: LostCitiesColor) {
    return (
      {
        yellow: '황금 사막',
        blue: '심해',
        white: '설산',
        green: '밀림',
        red: '화산',
      } as Record<LostCitiesColor, string>
    )[color];
  }

  private cardLabel(card: LostCitiesCard) {
    return card.kind === 'wager' ? '내기' : String(card.value);
  }

  private async handleReturnToTable(client: Client) {
    if (this.isReturning || !this.state.players.has(client.sessionId)) return;
    this.isReturning = true;
    try {
      const participants = this.clients.reduce<MigrationParticipant[]>(
        (result, participantClient) => {
          const player = this.state.players.get(participantClient.sessionId);
          if (player)
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
      const migration = await createRematchTable(
        LOST_CITIES_GAME,
        participants,
      );
      this.clients.forEach((participantClient) => {
        const reservation = migration.reservations.get(
          participantClient.sessionId,
        );
        if (reservation)
          participantClient.send('move_room', {
            reservation,
            gameType: 'table',
          });
      });
      this.clock.setTimeout(
        () => (this.isReturning = false),
        MIGRATION_RETRY_MS,
      );
    } catch (error) {
      logRoomError('lost_cities.rematch_migration_failed', error, {
        roomId: this.roomId,
        gameId: LOST_CITIES_GAME.id,
      });
      this.isReturning = false;
    }
  }

  private transferHost() {
    this.state.players.forEach((player) => (player.isHost = false));
    const nextHost = this.getConnectedPlayers()[0];
    this.state.hostSessionId = nextHost?.sessionId ?? '';
    if (nextHost) nextHost.isHost = true;
  }

  private finalizeMigrationIfReady() {
    if (
      this.state.migrationReady ||
      !isMigrationGroupReady(this.migrationSeats, this.clients.length)
    )
      return;
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
    event = 'lost_cities.request_rejected',
  ) {
    logRoomEvent('warn', event, {
      roomId: this.roomId,
      gameId: LOST_CITIES_GAME.id,
      code,
    });
  }
}
