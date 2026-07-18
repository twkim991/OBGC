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
import { readChatMessage, sendRoomError, SlidingWindowRateLimiter } from '../protocol';
import { createRematchTable } from '../rematch';
import { createSplendorCards, createSplendorNobles } from './domain/cards';
import { getNextSplendorPlayerId, shouldFinishSplendorGame } from './domain/engine';
import {
  getEligibleSplendorNobles,
  getSplendorPayment,
  getSplendorRankings,
  getSplendorTokenTotal,
  getSplendorWinnerIds,
  SPLENDOR_MAX_RESERVED,
  SPLENDOR_MAX_TOKENS,
  SPLENDOR_WIN_PRESTIGE,
  canReturnSplendorTokens,
  validateSplendorGemTake,
} from './domain/rules';
import {
  createEmptyGemCounts,
  createEmptyTokenCounts,
  getSplendorGemCount,
  getSplendorNobleCount,
  shuffleSplendorItems,
  splitSplendorDecks,
  SPLENDOR_GOLD_COUNT,
} from './domain/setup';
import {
  SPLENDOR_COLORS,
  SPLENDOR_TOKEN_COLORS,
  type SplendorCard,
  type SplendorGemCounts,
  type SplendorNoble,
  type SplendorTier,
  type SplendorTokenCounts,
} from './domain/types';
import { SPLENDOR_GAME } from './metadata';
import {
  SPLENDOR_MESSAGES,
  parseSplendorNoblePayload,
  parseSplendorPurchasePayload,
  parseSplendorReservePayload,
  parseSplendorReturnPayload,
  parseSplendorTakePayload,
} from './protocol';
import {
  SplendorPlayer,
  SplendorPublicCard,
  SplendorPublicNoble,
  SplendorResources,
  SplendorState,
} from './schema';

export class SplendorRoom extends Room<SplendorState> {
  private decks = new Map<SplendorTier, SplendorCard[]>();
  private reservedCards = new Map<string, SplendorCard[]>();
  private readonly playerIds = new Map<string, string>();
  private readonly clientProtocols = new Map<string, Record<string, number>>();
  private readonly chatLimiter = new SlidingWindowRateLimiter(5, 5000);
  private migrationSeats = new MigrationSeatRegistry();
  private isReturning = false;

  onCreate(options: unknown) {
    this.setState(new SplendorState());
    this.setSeatReservationTime(MIGRATION_SEAT_SECONDS);
    this.migrationSeats = new MigrationSeatRegistry(options);
    this.maxClients = this.migrationSeats.total || SPLENDOR_GAME.maxPlayers;

    this.clock.setTimeout(async () => {
      if (this.state.migrationReady) return;
      this.migrationSeats.expire();
      this.logRejectedRequest('MIGRATION_TIMEOUT', 'splendor.migration_aborted');
      this.broadcast('migration_aborted', { message: '모든 참가자가 제한 시간 안에 스플렌더 방으로 이동하지 못했습니다.' });
      await this.disconnect();
    }, MIGRATION_ABORT_MS);

    this.onMessage(SPLENDOR_MESSAGES.requestPrivateState, (client) => this.syncPrivateReservations(client.sessionId));
    this.onMessage('chat', (client, message) => this.handleChat(client, message));
    this.onMessage(SPLENDOR_MESSAGES.startGame, (client) => this.handleStartGame(client));
    this.onMessage(SPLENDOR_MESSAGES.takeGems, (client, payload) => this.handleTakeGems(client, payload));
    this.onMessage(SPLENDOR_MESSAGES.reserveCard, (client, payload) => this.handleReserveCard(client, payload));
    this.onMessage(SPLENDOR_MESSAGES.purchaseCard, (client, payload) => this.handlePurchaseCard(client, payload));
    this.onMessage(SPLENDOR_MESSAGES.returnTokens, (client, payload) => this.handleReturnTokens(client, payload));
    this.onMessage(SPLENDOR_MESSAGES.chooseNoble, (client, payload) => this.handleChooseNoble(client, payload));
    this.onMessage(SPLENDOR_MESSAGES.returnToTable, (client) => void this.handleReturnToTable(client));
  }

  onAuth(client: Client, options: unknown) {
    const authorized = this.migrationSeats.total > 0 && !this.migrationSeats.isComplete && this.migrationSeats.authorize(options);
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
    const player = new SplendorPlayer();
    player.sessionId = client.sessionId;
    player.nickname = seat.nickname;
    player.isHost = seat.isHost;
    this.playerIds.set(client.sessionId, seat.playerId);
    this.clientProtocols.set(client.sessionId, seat.protocolVersions);
    this.reservedCards.set(client.sessionId, []);
    if (player.isHost) {
      this.state.players.forEach((candidate) => (candidate.isHost = false));
      this.state.hostSessionId = client.sessionId;
    }
    this.state.players.set(client.sessionId, player);
    this.syncPrivateReservations(client.sessionId);
    this.finalizeMigrationIfReady();
    this.broadcast('chat', { clientId: 'System', message: `${player.nickname} 님이 입장했습니다.` });
  }

  async onLeave(client: Client, consented: boolean) {
    if (!consented) {
      try {
        await this.allowReconnection(client, 20);
        const player = this.state.players.get(client.sessionId);
        if (player) {
          player.connected = true;
          this.syncPrivateReservations(client.sessionId);
        }
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
      this.reservedCards.delete(client.sessionId);
      if (wasHost) this.transferHost();
      return;
    }

    player.connected = false;
    if (player.isHost) this.transferHost();
    const active = this.getActivePlayers();
    if (active.length <= 1) {
      this.finishGame(active[0]?.sessionId ? [active[0].sessionId] : []);
      return;
    }
    if (this.state.firstPlayerId === client.sessionId) this.state.firstPlayerId = active[0].sessionId;
    if (this.state.currentTurnId === client.sessionId) {
      this.state.eligibleNobleIds.clear();
      this.advanceTurn();
    }
  }

  private handleChat(client: Client, message: unknown) {
    const normalized = readChatMessage(message);
    if (!normalized) return this.rejectRequest(client, 'INVALID_CHAT', '채팅은 1~300자로 입력해주세요.');
    if (!this.chatLimiter.allow(client.sessionId)) return this.rejectRequest(client, 'CHAT_RATE_LIMIT', '채팅을 너무 빠르게 보내고 있습니다.');
    this.broadcast('chat', { clientId: this.playerName(client.sessionId), message: `[스플렌더] ${normalized}` });
  }

  private handleStartGame(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (this.state.gamePhase !== 'waiting') return this.rejectRequest(client, 'GAME_ALREADY_STARTED', '이미 게임이 시작되었습니다.');
    if (!player?.isHost) return this.rejectRequest(client, 'NOT_HOST', '방장만 게임을 시작할 수 있습니다.');
    if (this.getActivePlayers().length < SPLENDOR_GAME.minPlayers) return this.rejectRequest(client, 'NOT_ENOUGH_PLAYERS', '스플렌더는 2명 이상 모여야 시작할 수 있습니다.');
    this.startGame();
  }

  private handleTakeGems(client: Client, payload: unknown) {
    if (!this.canAct(client, 'main')) return;
    const parsed = parseSplendorTakePayload(payload);
    if (!parsed || parsed.turnRevision !== this.state.turnRevision) return this.rejectRequest(client, 'STALE_TURN', '시장 상태가 바뀌었습니다. 다시 선택해주세요.');
    const bank = this.readResources(this.state.bank);
    if (!validateSplendorGemTake(parsed.selection, bank)) return this.rejectRequest(client, 'INVALID_GEM_SELECTION', '서로 다른 보석 3개 또는 재고가 4개 이상인 같은 보석 2개를 선택해주세요.');
    const player = this.state.players.get(client.sessionId)!;
    SPLENDOR_COLORS.forEach((color) => {
      const amount = parsed.selection[color] ?? 0;
      player.tokens[color] += amount;
      this.state.bank[color] -= amount;
    });
    const summary = SPLENDOR_COLORS.filter((color) => (parsed.selection[color] ?? 0) > 0).map((color) => `${this.colorLabel(color)} ${parsed.selection[color]}개`).join(', ');
    this.recordAction(`${player.nickname}: ${summary} 획득`, `${player.nickname}님이 ${summary}를 가져갔습니다.`);
    this.finishOrRequestTokenReturn(player);
  }

  private handleReserveCard(client: Client, payload: unknown) {
    if (!this.canAct(client, 'main')) return;
    const parsed = parseSplendorReservePayload(payload);
    if (!parsed || parsed.turnRevision !== this.state.turnRevision) return this.rejectRequest(client, 'STALE_TURN', '시장 상태가 바뀌었습니다. 다시 선택해주세요.');
    const reserved = this.reservedCards.get(client.sessionId) ?? [];
    if (reserved.length >= SPLENDOR_MAX_RESERVED) return this.rejectRequest(client, 'RESERVE_LIMIT', '예약 카드는 최대 3장까지 보유할 수 있습니다.');
    let card: SplendorCard | undefined;
    if (parsed.source === 'market') {
      const market = this.getMarket(parsed.tier);
      const index = market.findIndex((candidate) => candidate.id === parsed.cardId);
      if (index < 0) return this.rejectRequest(client, 'CARD_NOT_FOUND', '선택한 시장 카드를 찾을 수 없습니다.');
      card = this.fromPublicCard(market[index]);
      market.splice(index, 1);
      this.refillMarket(parsed.tier);
    } else {
      card = this.decks.get(parsed.tier)?.pop();
      if (!card) return this.rejectRequest(client, 'DECK_EMPTY', '선택한 단계의 덱이 비었습니다.');
    }
    reserved.push(card);
    this.reservedCards.set(client.sessionId, reserved);
    const player = this.state.players.get(client.sessionId)!;
    player.reservedCount = reserved.length;
    if (this.state.bank.gold > 0) {
      this.state.bank.gold -= 1;
      player.tokens.gold += 1;
    }
    this.syncDeckCounts();
    this.syncPrivateReservations(client.sessionId);
    this.recordAction(`${player.nickname}: 개발 카드 예약`, `${player.nickname}님이 개발 카드 1장을 예약했습니다.`);
    this.finishOrRequestTokenReturn(player);
  }

  private handlePurchaseCard(client: Client, payload: unknown) {
    if (!this.canAct(client, 'main')) return;
    const parsed = parseSplendorPurchasePayload(payload);
    if (!parsed || parsed.turnRevision !== this.state.turnRevision) return this.rejectRequest(client, 'STALE_TURN', '시장 상태가 바뀌었습니다. 다시 선택해주세요.');
    const player = this.state.players.get(client.sessionId)!;
    let card: SplendorCard | undefined;
    let marketTier: SplendorTier | null = null;
    if (parsed.source === 'reserved') {
      card = (this.reservedCards.get(client.sessionId) ?? []).find((candidate) => candidate.id === parsed.cardId);
    } else {
      for (const tier of [1, 2, 3] as SplendorTier[]) {
        const candidate = this.getMarket(tier).find((item) => item.id === parsed.cardId);
        if (candidate) {
          card = this.fromPublicCard(candidate);
          marketTier = tier;
          break;
        }
      }
    }
    if (!card) return this.rejectRequest(client, 'CARD_NOT_FOUND', '구매할 카드를 찾을 수 없습니다.');
    const payment = getSplendorPayment(card, this.readResources(player.tokens), this.readGemResources(player.bonuses));
    if (!payment) return this.rejectRequest(client, 'CANNOT_AFFORD', '현재 보석과 할인으로 구매할 수 없는 카드입니다.');
    SPLENDOR_TOKEN_COLORS.forEach((color) => {
      player.tokens[color] -= payment[color];
      this.state.bank[color] += payment[color];
    });
    player.bonuses[card.bonus] += 1;
    player.prestige += card.prestige;
    player.developmentCount += 1;
    if (parsed.source === 'reserved') {
      const next = (this.reservedCards.get(client.sessionId) ?? []).filter((candidate) => candidate.id !== card!.id);
      this.reservedCards.set(client.sessionId, next);
      player.reservedCount = next.length;
      this.syncPrivateReservations(client.sessionId);
    } else if (marketTier) {
      const market = this.getMarket(marketTier);
      const index = market.findIndex((candidate) => candidate.id === card!.id);
      if (index >= 0) market.splice(index, 1);
      this.refillMarket(marketTier);
    }
    this.recordAction(`${player.nickname}: ${card.tier}단계 개발 구매`, `${player.nickname}님이 ${card.tier}단계 개발 카드를 구매했습니다.`);
    const eligible = getEligibleSplendorNobles(this.state.nobles.map((noble) => this.fromPublicNoble(noble)), this.readGemResources(player.bonuses));
    if (eligible.length === 1) {
      this.acquireNoble(player, eligible[0].id);
      this.completeTurn();
    } else if (eligible.length > 1) {
      this.state.eligibleNobleIds.clear();
      eligible.forEach((noble) => this.state.eligibleNobleIds.push(noble.id));
      this.state.actionPhase = 'choose_noble';
      this.state.turnRevision += 1;
    } else {
      this.completeTurn();
    }
  }

  private handleReturnTokens(client: Client, payload: unknown) {
    if (!this.canAct(client, 'return_tokens')) return;
    const parsed = parseSplendorReturnPayload(payload);
    if (!parsed || parsed.turnRevision !== this.state.turnRevision) return this.rejectRequest(client, 'STALE_TURN', '반환할 토큰 상태가 바뀌었습니다.');
    const player = this.state.players.get(client.sessionId)!;
    if (!canReturnSplendorTokens(this.readResources(player.tokens), parsed.returned)) return this.rejectRequest(client, 'INVALID_TOKEN_RETURN', '10개를 초과한 수만큼 보유 토큰에서 반환해주세요.');
    SPLENDOR_TOKEN_COLORS.forEach((color) => {
      player.tokens[color] -= parsed.returned[color] ?? 0;
      this.state.bank[color] += parsed.returned[color] ?? 0;
    });
    this.completeTurn();
  }

  private handleChooseNoble(client: Client, payload: unknown) {
    if (!this.canAct(client, 'choose_noble')) return;
    const parsed = parseSplendorNoblePayload(payload);
    if (!parsed || parsed.turnRevision !== this.state.turnRevision || !this.state.eligibleNobleIds.includes(parsed.nobleId)) return this.rejectRequest(client, 'INVALID_NOBLE', '방문받을 수 있는 귀족을 선택해주세요.');
    const player = this.state.players.get(client.sessionId)!;
    this.acquireNoble(player, parsed.nobleId);
    this.state.eligibleNobleIds.clear();
    this.completeTurn();
  }

  private startGame() {
    const players = this.getActivePlayers();
    this.decks = splitSplendorDecks(createSplendorCards());
    this.state.tierOne.clear();
    this.state.tierTwo.clear();
    this.state.tierThree.clear();
    ([1, 2, 3] as SplendorTier[]).forEach((tier) => {
      for (let count = 0; count < 4; count += 1) this.refillMarket(tier);
    });
    const gemCount = getSplendorGemCount(players.length);
    SPLENDOR_COLORS.forEach((color) => (this.state.bank[color] = gemCount));
    this.state.bank.gold = SPLENDOR_GOLD_COUNT;
    this.state.nobles.clear();
    shuffleSplendorItems(createSplendorNobles()).slice(0, getSplendorNobleCount(players.length)).forEach((noble) => this.state.nobles.push(this.toPublicNoble(noble)));
    players.forEach((player) => {
      this.writeResources(player.tokens, createEmptyTokenCounts());
      this.writeResources(player.bonuses, createEmptyTokenCounts());
      player.prestige = 0;
      player.developmentCount = 0;
      player.reservedCount = 0;
      player.nobleIds.clear();
      player.rank = 0;
      this.reservedCards.set(player.sessionId, []);
      this.syncPrivateReservations(player.sessionId);
    });
    const first = players[Math.floor(Math.random() * players.length)]?.sessionId ?? '';
    this.state.firstPlayerId = first;
    this.state.currentTurnId = first;
    this.state.gamePhase = 'playing';
    this.state.actionPhase = 'main';
    this.state.turnRevision = 1;
    this.state.turnCount = 1;
    this.state.finalRoundTriggered = false;
    this.state.finalRoundTriggeredBy = '';
    this.state.eligibleNobleIds.clear();
    this.state.winnerSessionIds.clear();
    this.state.rankings.clear();
    this.state.lastAction = '첫 플레이어가 행동을 선택합니다.';
    this.syncDeckCounts();
    this.broadcast('chat', { clientId: 'System', message: '스플렌더가 시작되었습니다. 한 턴에 한 가지 행동을 선택하세요.' });
  }

  private finishOrRequestTokenReturn(player: SplendorPlayer) {
    if (getSplendorTokenTotal(this.readResources(player.tokens)) > SPLENDOR_MAX_TOKENS) {
      this.state.actionPhase = 'return_tokens';
      this.state.turnRevision += 1;
      return;
    }
    this.completeTurn();
  }

  private completeTurn() {
    const player = this.state.players.get(this.state.currentTurnId);
    if (player && !this.state.finalRoundTriggered && player.prestige >= SPLENDOR_WIN_PRESTIGE) {
      this.state.finalRoundTriggered = true;
      this.state.finalRoundTriggeredBy = player.sessionId;
      this.broadcast('chat', { clientId: 'System', message: `${player.nickname}님이 15점에 도달했습니다. 현재 라운드가 끝나면 게임을 종료합니다.` });
    }
    this.advanceTurn();
  }

  private advanceTurn() {
    const ordered = Array.from(this.state.players.values()).map((player) => player.sessionId);
    const active = new Set(this.getActivePlayers().map((player) => player.sessionId));
    const next = getNextSplendorPlayerId(ordered, this.state.currentTurnId, active);
    if (!next || shouldFinishSplendorGame(next, this.state.firstPlayerId, this.state.finalRoundTriggered)) {
      this.finishGame();
      return;
    }
    this.state.currentTurnId = next;
    this.state.actionPhase = 'main';
    this.state.eligibleNobleIds.clear();
    this.state.turnRevision += 1;
    this.state.turnCount += 1;
  }

  private finishGame(forcedWinnerIds?: string[]) {
    if (this.state.gamePhase === 'finished') return;
    const candidates = this.getActivePlayers().map((player) => ({ id: player.sessionId, prestige: player.prestige, developmentCount: player.developmentCount }));
    const rankings = getSplendorRankings(candidates);
    const winnerIds = forcedWinnerIds ?? getSplendorWinnerIds(candidates);
    this.state.gamePhase = 'finished';
    this.state.actionPhase = 'finished';
    this.state.currentTurnId = '';
    this.state.winnerSessionIds.clear();
    winnerIds.forEach((id) => this.state.winnerSessionIds.push(id));
    this.state.rankings.clear();
    let displayedRank = 0;
    rankings.forEach((entry, index) => {
      const previous = rankings[index - 1];
      if (!previous || previous.prestige !== entry.prestige || previous.developmentCount !== entry.developmentCount) {
        displayedRank = index + 1;
      }
      this.state.rankings.push(entry.id);
      const player = this.state.players.get(entry.id);
      if (player) player.rank = displayedRank;
    });
    this.state.lastAction = `${winnerIds.map((id) => this.playerName(id)).join(', ')} 최종 승리`;
    this.broadcast('chat', { clientId: 'System', message: `${winnerIds.map((id) => this.playerName(id)).join(', ')}님이 스플렌더에서 승리했습니다!` });
  }

  private acquireNoble(player: SplendorPlayer, nobleId: string) {
    const index = this.state.nobles.findIndex((noble) => noble.id === nobleId);
    if (index < 0) return;
    const noble = this.state.nobles[index];
    player.prestige += noble.prestige;
    player.nobleIds.push(noble.id);
    this.state.nobles.splice(index, 1);
    this.recordAction(`${player.nickname}: 귀족 방문`, `${player.nickname}님이 귀족의 방문을 받아 명성 ${noble.prestige}점을 얻었습니다.`);
  }

  private refillMarket(tier: SplendorTier) {
    const card = this.decks.get(tier)?.pop();
    if (card) this.getMarket(tier).push(this.toPublicCard(card));
    this.syncDeckCounts();
  }

  private getMarket(tier: SplendorTier): ArraySchema<SplendorPublicCard> {
    return tier === 1 ? this.state.tierOne : tier === 2 ? this.state.tierTwo : this.state.tierThree;
  }

  private syncDeckCounts() {
    this.state.tierOneDeckCount = this.decks.get(1)?.length ?? 0;
    this.state.tierTwoDeckCount = this.decks.get(2)?.length ?? 0;
    this.state.tierThreeDeckCount = this.decks.get(3)?.length ?? 0;
  }

  private syncPrivateReservations(sessionId: string) {
    const client = this.clients.find((candidate) => candidate.sessionId === sessionId);
    if (!client) return;
    client.send(SPLENDOR_MESSAGES.privateReservations, {
      revision: this.state.turnRevision,
      cards: (this.reservedCards.get(sessionId) ?? []).map((card) => ({ ...card, cost: { ...card.cost } })),
    });
  }

  private canAct(client: Client, phase: string) {
    if (this.state.gamePhase !== 'playing') {
      this.rejectRequest(client, 'GAME_NOT_PLAYING', '진행 중인 게임이 아닙니다.');
      return false;
    }
    if (this.state.currentTurnId !== client.sessionId || this.state.actionPhase !== phase) {
      this.rejectRequest(client, 'NOT_YOUR_TURN', '현재 선택할 수 있는 차례가 아닙니다.');
      return false;
    }
    if (!this.state.players.get(client.sessionId)?.connected) {
      this.rejectRequest(client, 'PLAYER_DISCONNECTED', '현재 게임에 참여할 수 없습니다.');
      return false;
    }
    return true;
  }

  private recordAction(lastAction: string, message: string) {
    this.state.lastAction = lastAction;
    this.broadcast('chat', { clientId: 'System', message });
  }

  private readResources(resources: SplendorResources): SplendorTokenCounts {
    return { white: resources.white, blue: resources.blue, green: resources.green, red: resources.red, black: resources.black, gold: resources.gold };
  }

  private readGemResources(resources: SplendorResources): SplendorGemCounts {
    return { white: resources.white, blue: resources.blue, green: resources.green, red: resources.red, black: resources.black };
  }

  private writeResources(target: SplendorResources, source: SplendorTokenCounts) {
    SPLENDOR_TOKEN_COLORS.forEach((color) => (target[color] = source[color]));
  }

  private toPublicCard(card: SplendorCard) {
    const result = new SplendorPublicCard();
    result.id = card.id;
    result.tier = card.tier;
    result.bonus = card.bonus;
    result.prestige = card.prestige;
    SPLENDOR_COLORS.forEach((color) => (result.cost[color] = card.cost[color]));
    return result;
  }

  private fromPublicCard(card: SplendorPublicCard): SplendorCard {
    return { id: card.id, tier: card.tier as SplendorTier, bonus: card.bonus as SplendorCard['bonus'], prestige: card.prestige, cost: this.readGemResources(card.cost) };
  }

  private toPublicNoble(noble: SplendorNoble) {
    const result = new SplendorPublicNoble();
    result.id = noble.id;
    result.prestige = noble.prestige;
    SPLENDOR_COLORS.forEach((color) => (result.requirement[color] = noble.requirement[color]));
    return result;
  }

  private fromPublicNoble(noble: SplendorPublicNoble): SplendorNoble {
    return { id: noble.id, prestige: noble.prestige, requirement: this.readGemResources(noble.requirement) };
  }

  private getActivePlayers() {
    return Array.from(this.state.players.values()).filter((player) => player.connected);
  }

  private playerName(sessionId: string) {
    return this.state.players.get(sessionId)?.nickname ?? '플레이어';
  }

  private colorLabel(color: string) {
    return ({ white: '다이아몬드', blue: '사파이어', green: '에메랄드', red: '루비', black: '오닉스', gold: '황금' } as Record<string, string>)[color] ?? color;
  }

  private async handleReturnToTable(client: Client) {
    if (this.state.gamePhase !== 'finished' || this.isReturning || !this.state.players.has(client.sessionId)) return;
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
      const migration = await createRematchTable(SPLENDOR_GAME, participants);
      this.clients.forEach((participantClient) => {
        const reservation = migration.reservations.get(participantClient.sessionId);
        if (reservation) participantClient.send('move_room', { reservation, gameType: 'table' });
      });
      this.clock.setTimeout(() => (this.isReturning = false), MIGRATION_RETRY_MS);
    } catch (error) {
      logRoomError('splendor.rematch_migration_failed', error, { roomId: this.roomId, gameId: SPLENDOR_GAME.id });
      this.isReturning = false;
    }
  }

  private transferHost() {
    this.state.players.forEach((player) => (player.isHost = false));
    const nextHost = this.getActivePlayers()[0];
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

  private logRejectedRequest(code: string, event = 'splendor.request_rejected') {
    logRoomEvent('warn', event, { roomId: this.roomId, gameId: SPLENDOR_GAME.id, code });
  }
}
