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
import { createLoveLetterDeck, shuffleLoveLetterCards } from './domain/deck';
import { buildLoveLetterRankings, getNextLoveLetterPlayerId } from './domain/engine';
import {
  canChooseLoveLetterTarget,
  getLoveLetterFavorTarget,
  getLoveLetterRoundWinners,
  getSpyBonusRecipients,
  mustPlayCountess,
} from './domain/rules';
import type { LoveLetterCard, LoveLetterCharacter } from './domain/types';
import { LOVE_LETTER_GAME } from './metadata';
import {
  LOVE_LETTER_MESSAGES,
  parseChancellorPayload,
  parseLoveLetterDrawPayload,
  parseLoveLetterPlayPayload,
} from './protocol';
import { LoveLetterPlayer, LoveLetterPublicCard, LoveLetterState } from './schema';

const TARGET_CHARACTERS = new Set<LoveLetterCharacter>([
  'guard', 'priest', 'baron', 'prince', 'king',
]);

export class LoveLetterRoom extends Room<LoveLetterState> {
  private deck: LoveLetterCard[] = [];
  private setAsideCard: LoveLetterCard | null = null;
  private hands = new Map<string, LoveLetterCard[]>();
  private spyUsers = new Set<string>();
  private roundFirstPlayerId = '';
  private readonly playerIds = new Map<string, string>();
  private readonly clientProtocols = new Map<string, Record<string, number>>();
  private readonly chatLimiter = new SlidingWindowRateLimiter(5, 5000);
  private migrationSeats = new MigrationSeatRegistry();
  private isReturning = false;

  onCreate(options: unknown) {
    this.setState(new LoveLetterState());
    this.setSeatReservationTime(MIGRATION_SEAT_SECONDS);
    this.migrationSeats = new MigrationSeatRegistry(options);
    this.maxClients = this.migrationSeats.total || LOVE_LETTER_GAME.maxPlayers;

    this.clock.setTimeout(async () => {
      if (this.state.migrationReady) return;
      this.migrationSeats.expire();
      this.logRejectedRequest('MIGRATION_TIMEOUT', 'love_letter.migration_aborted');
      this.broadcast('migration_aborted', {
        message: '모든 참가자가 제한 시간 안에 러브레터 방으로 이동하지 못했습니다.',
      });
      await this.disconnect();
    }, MIGRATION_ABORT_MS);

    this.onMessage(LOVE_LETTER_MESSAGES.requestPrivateState, (client) => this.syncPrivateHand(client.sessionId));
    this.onMessage('chat', (client, message) => this.handleChat(client, message));
    this.onMessage(LOVE_LETTER_MESSAGES.startGame, (client) => this.handleStartGame(client));
    this.onMessage(LOVE_LETTER_MESSAGES.drawCard, (client, payload) => this.handleDrawCard(client, payload));
    this.onMessage(LOVE_LETTER_MESSAGES.playCard, (client, payload) => this.handlePlayCard(client, payload));
    this.onMessage(LOVE_LETTER_MESSAGES.resolveChancellor, (client, payload) => this.handleResolveChancellor(client, payload));
    this.onMessage(LOVE_LETTER_MESSAGES.nextRound, (client) => this.handleNextRound(client));
    this.onMessage(LOVE_LETTER_MESSAGES.returnToTable, (client) => void this.handleReturnToTable(client));
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
    const player = new LoveLetterPlayer();
    player.sessionId = client.sessionId;
    player.nickname = seat.nickname;
    player.isHost = seat.isHost;
    this.playerIds.set(client.sessionId, seat.playerId);
    this.clientProtocols.set(client.sessionId, seat.protocolVersions);
    this.hands.set(client.sessionId, []);
    if (player.isHost) {
      this.state.players.forEach((candidate) => (candidate.isHost = false));
      this.state.hostSessionId = client.sessionId;
    }
    this.state.players.set(client.sessionId, player);
    this.syncPrivateHand(client.sessionId);
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
          this.syncPrivateHand(client.sessionId);
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
      this.hands.delete(client.sessionId);
      if (wasHost) this.transferHost();
      return;
    }

    player.connected = false;
    player.eliminated = true;
    player.protected = false;
    player.handCount = 0;
    this.hands.set(client.sessionId, []);
    if (player.isHost) this.transferHost();
    if (this.state.gamePhase === 'playing') {
      const active = this.getActivePlayers();
      if (active.length <= 1) this.finishRound();
      else if (this.state.currentTurnId === client.sessionId) this.advanceTurn();
    }
    this.syncPublicCounts();
  }

  private handleChat(client: Client, message: unknown) {
    const normalized = readChatMessage(message);
    if (!normalized) return this.rejectRequest(client, 'INVALID_CHAT', '채팅은 1~300자로 입력해주세요.');
    if (!this.chatLimiter.allow(client.sessionId)) return this.rejectRequest(client, 'CHAT_RATE_LIMIT', '채팅을 너무 빠르게 보내고 있습니다.');
    const player = this.state.players.get(client.sessionId);
    this.broadcast('chat', { clientId: player?.nickname ?? client.sessionId, message: `[러브레터] ${normalized}` });
  }

  private handleStartGame(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (this.state.gamePhase !== 'waiting') return this.rejectRequest(client, 'GAME_ALREADY_STARTED', '이미 게임이 시작되었습니다.');
    if (!player?.isHost) return this.rejectRequest(client, 'NOT_HOST', '방장만 게임을 시작할 수 있습니다.');
    if (this.getConnectedPlayers().length < LOVE_LETTER_GAME.minPlayers) {
      return this.rejectRequest(client, 'NOT_ENOUGH_PLAYERS', '러브레터는 2명 이상 모여야 시작할 수 있습니다.');
    }
    this.state.players.forEach((candidate) => {
      candidate.favorTokens = 0;
      candidate.rank = 0;
    });
    const ids = this.getConnectedPlayers().map((candidate) => candidate.sessionId);
    this.roundFirstPlayerId = ids[Math.floor(Math.random() * ids.length)] ?? '';
    this.state.favorTarget = getLoveLetterFavorTarget(ids.length);
    this.startRound();
  }

  private handlePlayCard(client: Client, payload: unknown) {
    if (!this.canAct(client, 'choose')) return;
    const parsed = parseLoveLetterPlayPayload(payload);
    if (!parsed || parsed.turnRevision !== this.state.turnRevision) {
      return this.rejectRequest(client, 'STALE_TURN', '턴 상태가 바뀌었습니다. 다시 선택해주세요.');
    }
    const hand = this.hands.get(client.sessionId) ?? [];
    const cardIndex = hand.findIndex((card) => card.id === parsed.cardId);
    if (cardIndex < 0) return this.rejectRequest(client, 'CARD_NOT_FOUND', '선택한 카드를 손패에서 찾을 수 없습니다.');
    const card = hand[cardIndex];
    if (mustPlayCountess(hand) && card.character !== 'countess') {
      return this.rejectRequest(client, 'COUNTESS_REQUIRED', '왕 또는 왕자와 백작부인을 함께 들고 있으면 백작부인을 내야 합니다.');
    }

    const activeIds = this.getActivePlayers().map((player) => player.sessionId);
    const protectedIds = new Set(this.getActivePlayers().filter((player) => player.protected).map((player) => player.sessionId));
    const validOpponentExists = activeIds.some((id) =>
      id !== client.sessionId && !protectedIds.has(id),
    );
    if (TARGET_CHARACTERS.has(card.character)) {
      if (parsed.targetSessionId) {
        if (!canChooseLoveLetterTarget(client.sessionId, parsed.targetSessionId, card.character, activeIds, protectedIds)) {
          return this.rejectRequest(client, 'INVALID_TARGET', '이 카드로 선택할 수 없는 대상입니다.');
        }
      } else if (card.character === 'prince' || validOpponentExists) {
        return this.rejectRequest(client, 'TARGET_REQUIRED', '카드 효과의 대상을 선택해주세요.');
      }
    }
    if (card.character === 'guard' && (parsed.targetSessionId || validOpponentExists) && (!parsed.guessedCharacter || parsed.guessedCharacter === 'guard')) {
      return this.rejectRequest(client, 'INVALID_GUESS', '경비병 이외의 인물을 추측해주세요.');
    }

    hand.splice(cardIndex, 1);
    if (card.character === 'spy') this.spyUsers.add(client.sessionId);
    this.setPublicCard(this.state.lastPlayedCard, card);
    this.clearPublicCard(this.state.lastDiscardedCard);
    this.state.lastPlayedById = client.sessionId;
    this.state.lastTargetId = parsed.targetSessionId;
    this.state.lastGuessCharacter = card.character === 'guard' ? parsed.guessedCharacter : '';
    this.state.lastOutcome = 'resolved';
    this.state.lastAction = `${this.playerName(client.sessionId)} 님이 카드를 사용했습니다.`;

    const pending = this.applyCardEffect(client.sessionId, card, parsed.targetSessionId, parsed.guessedCharacter);
    this.syncPublicCounts();
    this.syncAllPrivateHands();
    if (!pending) this.completeTurn();
  }

  private handleDrawCard(client: Client, payload: unknown) {
    if (!this.canAct(client, 'draw')) return;
    const parsed = parseLoveLetterDrawPayload(payload);
    if (!parsed || parsed.turnRevision !== this.state.turnRevision) {
      return this.rejectRequest(client, 'STALE_TURN', '카드를 뽑을 수 있는 턴 상태가 바뀌었습니다.');
    }
    const drawn = this.deck.pop();
    if (!drawn) {
      this.finishRound();
      return;
    }
    this.hands.get(client.sessionId)?.push(drawn);
    this.state.actionPhase = 'choose';
    this.state.turnRevision += 1;
    this.state.lastAction = `${this.playerName(client.sessionId)} 님이 카드를 뽑았습니다.`;
    this.syncPublicCounts();
    this.syncAllPrivateHands();
  }

  private applyCardEffect(actorId: string, card: LoveLetterCard, targetId: string, guessed: LoveLetterCharacter | '') {
    const targetHand = this.hands.get(targetId) ?? [];
    const actorHand = this.hands.get(actorId) ?? [];
    switch (card.character) {
      case 'spy':
      case 'countess':
        return false;
      case 'guard':
        if (targetId && targetHand[0]?.character === guessed) {
          this.state.lastOutcome = 'guard_hit';
          this.eliminatePlayer(targetId);
        } else if (targetId) {
          this.state.lastOutcome = 'guard_miss';
        } else {
          this.state.lastOutcome = 'no_target';
        }
        return false;
      case 'priest':
        if (targetId && targetHand[0]) this.sendPrivateReveal(actorId, targetId, targetHand[0], 'priest');
        else this.state.lastOutcome = 'no_target';
        return false;
      case 'baron':
        if (targetId && actorHand[0] && targetHand[0]) {
          this.sendPrivateReveal(actorId, targetId, targetHand[0], 'baron');
          this.sendPrivateReveal(targetId, actorId, actorHand[0], 'baron');
          if (actorHand[0].value > targetHand[0].value) this.eliminatePlayer(targetId);
          else if (actorHand[0].value < targetHand[0].value) this.eliminatePlayer(actorId);
          else this.state.lastOutcome = 'baron_tie';
        } else this.state.lastOutcome = 'no_target';
        return false;
      case 'handmaid': {
        const actor = this.state.players.get(actorId);
        if (actor) actor.protected = true;
        this.state.lastOutcome = 'protected';
        return false;
      }
      case 'prince': {
        const discarded = targetHand.shift();
        if (!discarded) return false;
        this.setPublicCard(this.state.lastDiscardedCard, discarded);
        if (discarded.character === 'spy') this.spyUsers.add(targetId);
        if (discarded.character === 'princess') {
          this.state.lastOutcome = 'princess_discarded';
          this.eliminatePlayer(targetId, false);
        } else {
          const replacement = this.deck.pop() ?? this.setAsideCard;
          if (replacement) {
            targetHand.push(replacement);
            if (replacement === this.setAsideCard) this.setAsideCard = null;
          }
          this.state.lastOutcome = 'prince_replaced';
        }
        return false;
      }
      case 'chancellor': {
        for (let count = 0; count < 2; count += 1) {
          const drawn = this.deck.pop();
          if (drawn) actorHand.push(drawn);
        }
        if (actorHand.length <= 1) return false;
        this.state.actionPhase = 'chancellor';
        this.state.turnRevision += 1;
        this.state.lastOutcome = 'chancellor_choice';
        return true;
      }
      case 'king': {
        if (!targetId) {
          this.state.lastOutcome = 'no_target';
          return false;
        }
        this.hands.set(actorId, targetHand);
        this.hands.set(targetId, actorHand);
        this.state.lastOutcome = 'hands_swapped';
        return false;
      }
      case 'princess':
        this.state.lastOutcome = 'princess_played';
        this.eliminatePlayer(actorId);
        return false;
    }
  }

  private handleResolveChancellor(client: Client, payload: unknown) {
    if (!this.canAct(client, 'chancellor')) return;
    const parsed = parseChancellorPayload(payload);
    if (!parsed || parsed.turnRevision !== this.state.turnRevision) {
      return this.rejectRequest(client, 'STALE_TURN', '재상 카드 선택 상태가 바뀌었습니다.');
    }
    const hand = this.hands.get(client.sessionId) ?? [];
    const supplied = [parsed.keepCardId, ...parsed.returnCardIds];
    if (supplied.length !== hand.length || new Set(supplied).size !== hand.length || supplied.some((id) => !hand.some((card) => card.id === id))) {
      return this.rejectRequest(client, 'INVALID_CHANCELLOR_SELECTION', '받은 카드에서 한 장만 남기고 나머지 순서를 정해주세요.');
    }
    const keep = hand.find((card) => card.id === parsed.keepCardId);
    if (!keep) return;
    const returns = parsed.returnCardIds.map((id) => hand.find((card) => card.id === id)).filter((card): card is LoveLetterCard => Boolean(card));
    this.hands.set(client.sessionId, [keep]);
    // 첫 번째 선택 카드가 다음에 더 늦게 뽑히도록 배열의 바닥(앞쪽)부터 넣는다.
    this.deck.unshift(...returns);
    this.state.lastOutcome = 'chancellor_resolved';
    this.syncPublicCounts();
    this.syncAllPrivateHands();
    this.completeTurn();
  }

  private handleNextRound(client: Client) {
    if (this.state.gamePhase !== 'round_result') return;
    const player = this.state.players.get(client.sessionId);
    if (!player?.isHost) return this.rejectRequest(client, 'NOT_HOST', '방장만 다음 라운드를 시작할 수 있습니다.');
    this.startRound();
  }

  private startRound() {
    const players = this.getConnectedPlayers();
    const shuffled = shuffleLoveLetterCards(createLoveLetterDeck());
    this.setAsideCard = shuffled.pop() ?? null;
    this.state.faceUpRemovedCards.clear();
    if (players.length === 2) {
      for (let count = 0; count < 3; count += 1) {
        const card = shuffled.pop();
        if (card) this.state.faceUpRemovedCards.push(this.toPublicCard(card));
      }
    }
    this.deck = shuffled;
    this.hands = new Map(players.map((player) => [player.sessionId, []]));
    this.spyUsers.clear();
    players.forEach((player) => {
      player.eliminated = false;
      player.protected = false;
      player.handCount = 0;
      const card = this.deck.pop();
      if (card) this.hands.get(player.sessionId)?.push(card);
    });
    this.state.gamePhase = 'playing';
    this.state.actionPhase = 'draw';
    this.state.roundCount += 1;
    this.state.roundWinnerIds.clear();
    this.state.winnerSessionIds.clear();
    this.state.rankings.clear();
    this.clearPublicCard(this.state.lastPlayedCard);
    this.clearPublicCard(this.state.lastDiscardedCard);
    this.state.lastPlayedById = '';
    this.state.lastTargetId = '';
    this.state.lastGuessCharacter = '';
    this.state.lastOutcome = '';
    this.state.lastAction = `${this.state.roundCount}라운드 시작`;
    const connectedIds = players.map((player) => player.sessionId);
    if (!connectedIds.includes(this.roundFirstPlayerId)) this.roundFirstPlayerId = connectedIds[0] ?? '';
    this.state.currentTurnId = this.roundFirstPlayerId;
    this.startTurn();
    this.broadcast('chat', { clientId: 'System', message: `러브레터 ${this.state.roundCount}라운드가 시작되었습니다.` });
  }

  private startTurn() {
    const player = this.state.players.get(this.state.currentTurnId);
    if (!player || player.eliminated || !player.connected) {
      this.advanceTurn();
      return;
    }
    player.protected = false;
    this.state.actionPhase = 'draw';
    this.state.turnRevision += 1;
    this.syncPublicCounts();
    this.syncAllPrivateHands();
  }

  private completeTurn() {
    this.syncPublicCounts();
    this.syncAllPrivateHands();
    if (this.getActivePlayers().length <= 1 || this.deck.length === 0) {
      this.finishRound();
      return;
    }
    this.advanceTurn();
  }

  private advanceTurn() {
    const ordered = this.getConnectedPlayers().map((player) => player.sessionId);
    const activeIds = new Set(this.getActivePlayers().map((player) => player.sessionId));
    this.state.currentTurnId = getNextLoveLetterPlayerId(ordered, this.state.currentTurnId, activeIds);
    if (!this.state.currentTurnId) this.finishRound();
    else this.startTurn();
  }

  private finishRound() {
    if (this.state.gamePhase !== 'playing') return;
    const activeIds = this.getActivePlayers().map((player) => player.sessionId);
    const roundWinners = getLoveLetterRoundWinners(activeIds, this.hands);
    const spyRecipients = getSpyBonusRecipients(activeIds, this.spyUsers);
    roundWinners.forEach((id) => {
      const player = this.state.players.get(id);
      if (player) player.favorTokens += 1;
    });
    spyRecipients.forEach((id) => {
      const player = this.state.players.get(id);
      if (player) player.favorTokens += 1;
    });
    this.state.roundWinnerIds.clear();
    roundWinners.forEach((id) => this.state.roundWinnerIds.push(id));
    this.state.currentTurnId = '';
    this.state.actionPhase = 'round_result';
    this.state.lastAction = `${roundWinners.map((id) => this.playerName(id)).join(', ')} 라운드 승리`;
    this.roundFirstPlayerId = roundWinners[Math.floor(Math.random() * roundWinners.length)] ?? this.getConnectedPlayers()[0]?.sessionId ?? '';
    const gameWinners = this.getConnectedPlayers().filter((player) => player.favorTokens >= this.state.favorTarget);
    if (gameWinners.length > 0) {
      this.finishGame(gameWinners.map((player) => player.sessionId));
      return;
    }
    this.state.gamePhase = 'round_result';
    this.syncPublicCounts();
    this.syncAllPrivateHands();
  }

  private finishGame(winnerIds: string[]) {
    const players = this.getConnectedPlayers();
    const favors = new Map(players.map((player) => [player.sessionId, player.favorTokens]));
    const rankings = buildLoveLetterRankings(players.map((player) => player.sessionId), favors);
    this.state.gamePhase = 'finished';
    this.state.actionPhase = 'finished';
    this.state.winnerSessionIds.clear();
    winnerIds.forEach((id) => this.state.winnerSessionIds.push(id));
    this.state.rankings.clear();
    rankings.forEach((id, index) => {
      this.state.rankings.push(id);
      const player = this.state.players.get(id);
      if (player) player.rank = index + 1;
    });
    this.state.lastAction = `${winnerIds.map((id) => this.playerName(id)).join(', ')} 최종 승리`;
    this.broadcast('chat', { clientId: 'System', message: `${winnerIds.map((id) => this.playerName(id)).join(', ')} 님이 러브레터에서 승리했습니다!` });
  }

  private eliminatePlayer(sessionId: string, revealHand = true) {
    const player = this.state.players.get(sessionId);
    const hand = this.hands.get(sessionId) ?? [];
    const discarded = hand.shift();
    if (discarded && revealHand) this.setPublicCard(this.state.lastDiscardedCard, discarded);
    if (discarded?.character === 'spy') this.spyUsers.add(sessionId);
    if (player) {
      player.eliminated = true;
      player.protected = false;
      player.handCount = 0;
    }
    this.hands.set(sessionId, []);
    this.state.lastOutcome = 'eliminated';
  }

  private canAct(client: Client, phase: string) {
    if (this.state.gamePhase !== 'playing') {
      this.rejectRequest(client, 'GAME_NOT_PLAYING', '진행 중인 라운드가 아닙니다.');
      return false;
    }
    if (this.state.currentTurnId !== client.sessionId || this.state.actionPhase !== phase) {
      this.rejectRequest(client, 'NOT_YOUR_TURN', '현재 선택할 수 있는 차례가 아닙니다.');
      return false;
    }
    const player = this.state.players.get(client.sessionId);
    if (!player?.connected || player.eliminated) {
      this.rejectRequest(client, 'PLAYER_ELIMINATED', '현재 라운드에 참여할 수 없습니다.');
      return false;
    }
    return true;
  }

  private syncPublicCounts() {
    this.state.deckCount = this.deck.length;
    this.state.activeCount = this.getActivePlayers().length;
    this.state.players.forEach((player) => {
      player.handCount = this.hands.get(player.sessionId)?.length ?? 0;
    });
  }

  private syncPrivateHand(sessionId: string) {
    const client = this.clients.find((candidate) => candidate.sessionId === sessionId);
    if (!client) return;
    client.send(LOVE_LETTER_MESSAGES.privateHand, {
      revision: this.state.turnRevision,
      cards: (this.hands.get(sessionId) ?? []).map((card) => ({ ...card })),
      chancellorPending: this.state.currentTurnId === sessionId && this.state.actionPhase === 'chancellor',
    });
  }

  private syncAllPrivateHands() {
    this.state.players.forEach((player) => this.syncPrivateHand(player.sessionId));
  }

  private sendPrivateReveal(receiverId: string, targetId: string, card: LoveLetterCard, source: 'priest' | 'baron') {
    const client = this.clients.find((candidate) => candidate.sessionId === receiverId);
    client?.send(LOVE_LETTER_MESSAGES.privateReveal, {
      source,
      targetSessionId: targetId,
      card: { ...card },
      revision: this.state.turnRevision,
    });
  }

  private toPublicCard(card: LoveLetterCard) {
    const result = new LoveLetterPublicCard();
    this.setPublicCard(result, card);
    return result;
  }

  private setPublicCard(target: LoveLetterPublicCard, card: LoveLetterCard) {
    target.id = card.id;
    target.character = card.character;
    target.value = card.value;
  }

  private clearPublicCard(target: LoveLetterPublicCard) {
    target.id = '';
    target.character = '';
    target.value = -1;
  }

  private getConnectedPlayers() {
    return Array.from(this.state.players.values()).filter((player) => player.connected);
  }

  private getActivePlayers() {
    return this.getConnectedPlayers().filter((player) => !player.eliminated);
  }

  private playerName(sessionId: string) {
    return this.state.players.get(sessionId)?.nickname ?? '플레이어';
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
      const migration = await createRematchTable(LOVE_LETTER_GAME, participants);
      this.clients.forEach((participantClient) => {
        const reservation = migration.reservations.get(participantClient.sessionId);
        if (reservation) participantClient.send('move_room', { reservation, gameType: 'table' });
      });
      this.clock.setTimeout(() => (this.isReturning = false), MIGRATION_RETRY_MS);
    } catch (error) {
      logRoomError('love_letter.rematch_migration_failed', error, { roomId: this.roomId, gameId: LOVE_LETTER_GAME.id });
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
    if (this.state.migrationReady || !isMigrationGroupReady(this.migrationSeats, this.clients.length)) return;
    this.state.migrationReady = true;
    if (!this.state.hostSessionId) this.transferHost();
    this.broadcast('migration_ready');
  }

  private rejectRequest(client: Client, code: string, message: string) {
    this.logRejectedRequest(code);
    sendRoomError(client, code, message);
  }

  private logRejectedRequest(code: string, event = 'love_letter.request_rejected') {
    logRoomEvent('warn', event, { roomId: this.roomId, gameId: LOVE_LETTER_GAME.id, code });
  }
}
