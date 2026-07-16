// server\src\rooms\MapleOneCardRoom.ts
import { Room, Client } from 'colyseus';
import { createRematchTable } from '../games/rematch';
import {
  readChatMessage,
  sendRoomError,
  SlidingWindowRateLimiter,
} from '../games/protocol';
import {
  MigrationSeatRegistry,
  isMigrationGroupReady,
  MIGRATION_ABORT_MS,
  MIGRATION_RETRY_MS,
  MIGRATION_SEAT_SECONDS,
  type MigrationParticipant,
} from '../games/migration';
import { MAPLE_ONE_CARD_GAME } from '../games/onecard/metadata';
import {
  buildTurnPriorityMap,
  dealOneCardGame,
  getNextTurnId,
  rankPlayers,
} from '../games/onecard/domain/engine';
import {
  isBankruptHand,
  prepareDiscardRefill,
  removeColorFromHands,
  resolveCardEffect,
  type OneCardEffect,
} from '../games/onecard/domain/effects';
import {
  MapleOneCardState,
  OneCardCard,
  OneCardPlayer,
} from '../games/onecard/schema';
import {
  ONECARD_MESSAGES,
  parsePlayCardPayload,
} from '../games/onecard/protocol';
import { logRoomError, logRoomEvent } from '../games/logging';
import {
  createDeck as createOneCardDeck,
  shuffle,
} from '../games/onecard/domain/deck';
import {
  canPlayCard,
  getAttackValue,
  isAttackCard,
} from '../games/onecard/domain/rules';
import type { Card } from '../games/onecard/domain/types';

function toSchemaCard(source: Card): OneCardCard {
  const card = new OneCardCard();
  card.id = source.id;
  card.color = source.color;
  card.type = source.type;
  card.number = source.number ?? 0;
  return card;
}

function createSchemaDeck(): OneCardCard[] {
  return createOneCardDeck().map(toSchemaCard);
}

function getTopCard(state: MapleOneCardState): OneCardCard | null {
  if (state.discardPile.length === 0) return null;
  return state.discardPile[state.discardPile.length - 1];
}

export class MapleOneCardRoom extends Room<MapleOneCardState> {
  private isReturning = false;
  private deck: OneCardCard[] = [];
  private readonly hands = new Map<string, OneCardCard[]>();
  private readonly playerIds = new Map<string, string>();
  private readonly chatLimiter = new SlidingWindowRateLimiter(5, 5000);
  private readonly clientProtocols = new Map<string, Record<string, number>>();
  private migrationSeats = new MigrationSeatRegistry();

  onCreate(options: any) {
    this.setState(new MapleOneCardState());
    this.setSeatReservationTime(MIGRATION_SEAT_SECONDS);
    this.migrationSeats = new MigrationSeatRegistry(options);
    this.maxClients = this.migrationSeats.total || MAPLE_ONE_CARD_GAME.maxPlayers;
    this.clock.setTimeout(async () => {
      if (this.state.migrationReady) return;
      this.migrationSeats.expire();
      this.logRejectedRequest('MIGRATION_TIMEOUT', 'onecard.migration_aborted');
      this.broadcast('migration_aborted', {
        message: '모든 참가자가 제한 시간 안에 게임방으로 이동하지 못했습니다.',
      });
      await this.disconnect();
    }, MIGRATION_ABORT_MS);

    this.onMessage(ONECARD_MESSAGES.requestPrivateState, (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) this.syncPrivateHand(player);
    });

    this.onMessage('chat', (client, message) => {
      const normalized = readChatMessage(message);
      if (!normalized) {
        this.logRejectedRequest('INVALID_CHAT');
        sendRoomError(client, 'INVALID_CHAT', '채팅은 1~300자로 입력해주세요.');
        return;
      }
      if (!this.chatLimiter.allow(client.sessionId)) {
        this.logRejectedRequest('CHAT_RATE_LIMIT');
        sendRoomError(client, 'CHAT_RATE_LIMIT', '채팅을 너무 빠르게 보내고 있습니다.');
        return;
      }

      const player = this.state.players.get(client.sessionId);
      this.broadcast('chat', {
        clientId: player?.nickname ?? client.sessionId,
        message: `[메이플원카드] ${normalized}`,
      });
    });

    this.onMessage(ONECARD_MESSAGES.startGame, (client) => {
      if (this.state.gamePhase !== 'waiting') return;
      const player = this.state.players.get(client.sessionId);
      if (!player?.isHost) return;
      if (this.state.players.size < MAPLE_ONE_CARD_GAME.minPlayers) {
        client.send('chat', {
          clientId: 'System',
          message: `${MAPLE_ONE_CARD_GAME.label}는 ${MAPLE_ONE_CARD_GAME.minPlayers}명 이상 모여야 시작할 수 있습니다.`,
        });
        return;
      }

      this.startGame(client.sessionId);
      this.broadcast('chat', {
        clientId: 'System',
        message: `🃏 메이플 원카드 게임이 시작되었습니다!`,
      });
    });

    this.onMessage(
      ONECARD_MESSAGES.playCard,
      (client, payload: unknown) => {
        if (this.state.gamePhase !== 'playing') return;
        if (client.sessionId !== this.state.currentTurnId) return;

        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive || player.bankrupt) return;

        const parsedPayload = parsePlayCardPayload(payload);
        if (!parsedPayload) {
          this.rejectRequest(client, 'INVALID_PAYLOAD', '카드 정보가 올바르지 않습니다.');
          return;
        }
        const { cardId, chosenColor } = parsedPayload;

        const hand = this.getHand(player);
        const cardIndex = hand.findIndex((card) => card.id === cardId);
        if (cardIndex === -1) {
          this.rejectRequest(client, 'CARD_NOT_OWNED', '보유하지 않은 카드입니다.');
          return;
        }

        const card = hand[cardIndex];
        if (
          !canPlayCard({
            card,
            topCard: getTopCard(this.state),
            currentColor: this.state.currentColor,
            pendingAttack: this.state.pendingAttack,
          })
        ) {
          this.rejectRequest(client, 'ILLEGAL_CARD', '현재 낼 수 없는 카드입니다.');
          return;
        }

        const topBefore = getTopCard(this.state);

        hand.splice(cardIndex, 1);

        // 이카르트는 discardPile에 남지 않음
        if (card.type !== 'ikart') {
          this.state.discardPile.push(card);
        }

        this.applyCardEffect(player, card, chosenColor, topBefore);

        // 현재 턴 플레이어가 이리나 등으로 0장 될 수 있음
        if (this.getHand(player).length === 0 && !this.state.winnerSessionId) {
          this.finishGame(player.sessionId);
          return;
        }

        this.checkBankruptAll();
        this.checkForcedGameEnd();
        this.syncAllPrivateHands();
      },
    );

    this.onMessage(ONECARD_MESSAGES.drawCard, (client) => {
      if (this.state.gamePhase !== 'playing') return;
      if (client.sessionId !== this.state.currentTurnId) return;

      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive || player.bankrupt) return;

      const drawCount =
        this.state.pendingAttack > 0 ? this.state.pendingAttack : 1;

      this.drawCards(player, drawCount);

      if (this.state.pendingAttack > 0) {
        this.broadcast('chat', {
          clientId: 'System',
          message: `💥 ${player.nickname}님이 공격 ${drawCount}장을 받았습니다.`,
        });
        this.state.pendingAttack = 0;

        const top = getTopCard(this.state);
        if (top && top.color !== 'purple') {
          this.state.currentColor = top.color;
        }
      } else {
        this.broadcast('chat', {
          clientId: 'System',
          message: `🂠 ${player.nickname}님이 카드를 1장 뽑았습니다.`,
        });
      }

      this.checkBankrupt(player);
      this.passTurn();
      this.checkForcedGameEnd();
    });

    this.onMessage(ONECARD_MESSAGES.returnToTable, async (client) => {
      if (this.state.gamePhase !== 'finished' || this.isReturning) return;
      this.isReturning = true;

      try {
        const participants = this.clients.reduce<MigrationParticipant[]>(
          (result, participantClient) => {
            const player = this.state.players.get(participantClient.sessionId);
            if (player) {
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
            }
            return result;
          },
          [],
        );
        const migration = await createRematchTable(
          MAPLE_ONE_CARD_GAME,
          participants,
        );

        this.clients.forEach((participantClient) => {
          const reservation = migration.reservations.get(
            participantClient.sessionId,
          );
          if (!reservation) return;
          participantClient.send('move_room', {
            reservation,
            gameType: 'table',
          });
        });
        this.clock.setTimeout(() => {
          this.isReturning = false;
        }, MIGRATION_RETRY_MS);
      } catch (e) {
        logRoomError('onecard.rematch_migration_failed', e, {
          roomId: this.roomId,
          gameId: MAPLE_ONE_CARD_GAME.id,
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

  onJoin(client: Client, options: any) {
    if (this.state.gamePhase !== 'waiting') {
      client.leave();
      return;
    }

    const migrationSeat = this.migrationSeats.claim(options);
    if (!migrationSeat) {
      this.logRejectedRequest('MIGRATION_SEAT_ALREADY_USED');
      client.leave();
      return;
    }

    const player = new OneCardPlayer();
    player.sessionId = client.sessionId;
    this.playerIds.set(client.sessionId, migrationSeat.playerId);
    player.nickname = migrationSeat.nickname;
    player.isHost = migrationSeat.isHost;
    this.clientProtocols.set(client.sessionId, migrationSeat.protocolVersions);

    if (player.isHost) {
      this.state.players.forEach(
        (existingPlayer) => (existingPlayer.isHost = false),
      );
      this.state.hostSessionId = client.sessionId;
    }

    this.state.players.set(client.sessionId, player);
    this.hands.set(client.sessionId, []);
    this.syncPrivateHand(player);

    this.finalizeMigrationIfReady();

    this.broadcast('chat', {
      clientId: 'System',
      message: `${player.nickname} 님이 입장했습니다.`,
    });
  }

  async onLeave(client: Client, consented: boolean) {
    if (!consented) {
      try {
        const reconnectedClient = await this.allowReconnection(client, 20);
        const reconnectedPlayer = this.state.players.get(client.sessionId);
        if (reconnectedPlayer) {
          const currentClient = this.clients.find(
            (candidate) => candidate.sessionId === reconnectedClient.sessionId,
          );
          if (currentClient) this.syncPrivateHand(reconnectedPlayer);
        }
        this.finalizeMigrationIfReady();
        return;
      } catch {
        // 재연결 제한 시간이 지나면 아래의 일반 퇴장 처리를 수행한다.
      }
    }

    this.chatLimiter.clear(client.sessionId);
    this.clientProtocols.delete(client.sessionId);
    this.playerIds.delete(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    // waiting 상태에서는 그냥 제거
    if (this.state.gamePhase === 'waiting') {
      const wasHost = player.isHost;
      this.state.players.delete(client.sessionId);
      this.hands.delete(client.sessionId);
      if (wasHost) this.transferHost();
      return;
    }

    // playing 도중 이탈 시 탈락 처리
    player.alive = false;
    player.bankrupt = true;

    this.broadcast('chat', {
      clientId: 'System',
      message: `${player.nickname} 님이 게임에서 이탈했습니다.`,
    });

    if (
      this.state.currentTurnId === client.sessionId &&
      this.state.gamePhase === 'playing'
    ) {
      this.passTurn();
    }

    this.checkForcedGameEnd();
  }

  // --- 게임 시작 ---
  private startGame(hostSessionId: string) {
    this.deck = [];
    this.state.discardPile.clear();
    this.state.rankings.clear();
    this.state.winnerSessionId = '';
    this.state.direction = 1;
    this.state.pendingAttack = 0;
    this.state.turnCount = 1;
    this.state.lastAction = '게임 시작';
    this.state.gamePhase = 'playing';

    const ids = Array.from(this.state.players.keys());
    const deal = dealOneCardGame(createSchemaDeck(), ids, 7, shuffle);

    this.state.players.forEach((player) => {
      player.alive = true;
      player.bankrupt = false;
      player.rank = 0;
      player.shieldActive = false;
      player.shieldPendingExpire = false;

      this.hands.set(player.sessionId, deal.hands.get(player.sessionId) ?? []);
      this.syncPrivateHand(player);
    });

    if (deal.firstCard) {
      this.state.discardPile.push(deal.firstCard);
      this.state.currentColor =
        deal.firstCard.color === 'purple' ? '' : deal.firstCard.color;
    } else {
      this.state.currentColor = '';
    }

    this.deck = deal.deck;
    this.state.currentTurnId = ids.includes(hostSessionId)
      ? hostSessionId
      : ids[0] || '';

    const top = getTopCard(this.state);
    if (top && isAttackCard(top)) {
      this.state.pendingAttack = getAttackValue(top);
    }

    this.broadcast('chat', {
      clientId: 'System',
      message: `시작 카드: ${this.formatCard(top)} / 현재 색상: ${
        this.state.currentColor || '-'
      }`,
    });
    this.syncAllPrivateHands();
  }

  // --- 카드 효과 적용 ---
  private applyCardEffect(
    player: OneCardPlayer,
    card: OneCardCard,
    chosenColor?: string,
    topBefore?: OneCardCard | null,
  ) {
    const playerName = player.nickname;
    const effect = resolveCardEffect({
      card,
      chosenColor,
      pendingAttack: this.state.pendingAttack,
      alivePlayerCount: this.getAlivePlayers().length,
      currentColor: this.state.currentColor,
      topCardBefore: topBefore ?? null,
    });

    if (effect.currentColor !== undefined) {
      this.state.currentColor = effect.currentColor;
    }
    if (effect.pendingAttack !== undefined) {
      this.state.pendingAttack = effect.pendingAttack;
    }
    this.state.direction *= effect.directionMultiplier;
    this.state.lastAction = `${playerName}: ${effect.actionLabel}`;

    if (effect.activateShield) {
      player.shieldActive = true;
      player.shieldPendingExpire = false;
    }

    if (effect.special === 'irina') {
      this.handleIrina(player, effect.currentColor ?? 'red');
      return;
    }

    if (effect.special === 'draw_others') {
      this.state.players.forEach((other, otherId) => {
        if (otherId === player.sessionId || !other.alive || other.bankrupt) return;
        this.drawCards(other, effect.drawOtherCount);
      });
      this.checkBankruptAll();
    }

    this.broadcast('chat', {
      clientId: 'System',
      message: this.cardEffectMessage(playerName, card, effect),
    });

    if (this.state.gamePhase === 'finished') return;
    if (effect.turnStep > 0) this.passTurn(effect.turnStep);
  }

  private handleIrina(player: OneCardPlayer, nextColor: string) {
    const result = removeColorFromHands(this.hands, 'green');
    result.hands.forEach((hand, sessionId) => this.hands.set(sessionId, hand));
    this.deck.push(...result.removedCards);

    this.state.players.forEach((p) => {
      this.syncPrivateHand(p);
    });

    // deck 재셔플
    this.deck = shuffle(this.deck);

    this.state.currentColor = nextColor;

    this.broadcast('chat', {
      clientId: 'System',
      message: `🌪️ ${player.nickname}님이 이리나를 사용했습니다. 모든 초록 카드를 흡수하고 현재 색상을 ${this.state.currentColor}(으)로 바꿉니다.`,
    });

    // 이리나로 인해 누군가 0장 될 수 있음
    const zeroPlayers = this.getAlivePlayers().filter(
      (p) => this.getHand(p).length === 0,
    );
    if (zeroPlayers.length > 0) {
      const me = zeroPlayers.find((p) => p.sessionId === player.sessionId);
      this.finishGame((me || zeroPlayers[0]).sessionId);
      return;
    }

    this.passTurn();
  }

  // --- 드로우 ---
  private drawCards(player: OneCardPlayer, count: number) {
    const hand = this.getHand(player);

    for (let i = 0; i < count; i++) {
      if (this.deck.length === 0) {
        this.refillDeck();
      }

      if (this.deck.length === 0) break;

      const card = this.deck.shift();
      if (card) hand.push(card);
    }

    this.syncPrivateHand(player);
  }

  private refillDeck() {
    const refill = prepareDiscardRefill(
      Array.from(this.state.discardPile),
      shuffle,
    );
    if (refill.refillCards.length === 0) return;

    this.state.discardPile.clear();
    if (refill.topCard) this.state.discardPile.push(refill.topCard);
    this.deck.push(...refill.refillCards);
  }

  // --- 턴 처리 ---
  private passTurn(step = 1) {
    const aliveIds = this.getAlivePlayerIds();
    if (aliveIds.length <= 1) return;

    const currentPlayer = this.state.players.get(this.state.currentTurnId);
    if (currentPlayer?.shieldActive) {
      if (!currentPlayer.shieldPendingExpire) {
        currentPlayer.shieldPendingExpire = true;
      } else {
        currentPlayer.shieldActive = false;
        currentPlayer.shieldPendingExpire = false;
      }
    }

    this.state.currentTurnId = getNextTurnId({
      playerIds: aliveIds,
      currentTurnId: this.state.currentTurnId,
      direction: this.state.direction,
      step,
    });
    this.state.turnCount += 1;
    this.syncAllPrivateHands();
  }

  private getAlivePlayers() {
    return Array.from(this.state.players.values()).filter(
      (p) => p.alive && !p.bankrupt,
    );
  }

  private getAlivePlayerIds() {
    return Array.from(this.state.players.entries())
      .filter(([, p]) => p.alive && !p.bankrupt)
      .map(([id]) => id);
  }

  // --- 파산 / 종료 ---
  private checkBankrupt(player: OneCardPlayer) {
    if (isBankruptHand(this.getHand(player).length)) {
      player.bankrupt = true;
      player.alive = false;

      this.broadcast('chat', {
        clientId: 'System',
        message: `💀 ${player.nickname}님이 손패 18장 이상으로 파산했습니다.`,
      });
    }
  }

  private checkBankruptAll() {
    this.state.players.forEach((player) => {
      this.checkBankrupt(player);
    });
  }

  private checkForcedGameEnd() {
    const alive = this.getAlivePlayers();

    if (alive.length === 1) {
      this.finishGame(alive[0].sessionId);
    }
  }

  private finishGame(winnerSessionId: string) {
    this.state.gamePhase = 'finished';
    this.state.winnerSessionId = winnerSessionId;
    this.state.rankings.clear();

    const aliveIds = this.getAlivePlayerIds();
    const turnPriority = buildTurnPriorityMap(aliveIds, this.state.currentTurnId);
    const rankingIds = rankPlayers(
      Array.from(this.state.players.values()).map((player) => ({
        sessionId: player.sessionId,
        bankrupt: player.bankrupt,
        handCount: this.getHand(player).length,
      })),
      winnerSessionId,
      turnPriority,
    );

    rankingIds.forEach((sessionId, idx) => {
      const player = this.state.players.get(sessionId);
      if (!player) return;
      player.rank = idx + 1;
      this.state.rankings.push(sessionId);
    });

    const winner = this.state.players.get(winnerSessionId);
    this.broadcast('chat', {
      clientId: 'System',
      message: `🏆 게임 종료! ${
        winner?.nickname || winnerSessionId
      }님이 1위를 차지했습니다.`,
    });
    this.syncAllPrivateHands();
  }

  // --- 기타 ---
  private formatCard(card: OneCardCard | null | undefined) {
    if (!card) return '없음';
    if (card.type === 'number') return `${card.color} ${card.number}`;
    return `${card.color} ${card.type}`;
  }

  private cardEffectMessage(
    playerName: string,
    card: OneCardCard,
    effect: OneCardEffect,
  ) {
    switch (card.type) {
      case 'number':
        return `🃏 ${playerName}님이 ${this.formatCard(card)}를 냈습니다.`;
      case 'jump':
        return `⏭️ ${playerName}님이 점프 카드를 냈습니다.`;
      case 'reverse':
        return `🔄 ${playerName}님이 리버스 카드를 냈습니다.`;
      case 'plus1':
        return `➕ ${playerName}님이 +1 카드를 냈습니다. 한 번 더 진행합니다.`;
      case 'wild':
        return `🌈 ${playerName}님이 색깔 바꾸기 카드를 냈습니다. 현재 색상: ${this.state.currentColor}`;
      case 'attack2':
      case 'attack3':
        return `🔥 ${playerName}님이 ${this.formatCard(card)}를 사용했습니다. 누적 공격: ${this.state.pendingAttack}`;
      case 'oz':
        return `🔥🔥 ${playerName}님이 오즈를 사용했습니다. 누적 공격: ${this.state.pendingAttack}`;
      case 'mihile':
        return `🛡️ ${playerName}님이 미하일을 사용했습니다. 공격을 무효화합니다.`;
      case 'hawkeye':
        return `🎯 ${playerName}님이 호크아이를 사용했습니다. 자신을 제외한 모두가 ${effect.drawOtherCount}장씩 받습니다.`;
      case 'ikart':
        return `🫥 ${playerName}님이 이카르트를 사용했습니다.`;
      default:
        return `${playerName}님이 카드를 사용했습니다.`;
    }
  }

  private transferHost() {
    this.state.players.forEach((player) => (player.isHost = false));
    const nextHost = Array.from(this.state.players.values())[0];

    if (!nextHost) {
      this.state.hostSessionId = '';
      return;
    }

    nextHost.isHost = true;
    this.state.hostSessionId = nextHost.sessionId;
    this.broadcast('chat', {
      clientId: 'System',
      message: `${nextHost.nickname} 님이 새 방장이 되었습니다.`,
    });
  }

  private finalizeMigrationIfReady() {
    if (
      this.state.migrationReady ||
      !isMigrationGroupReady(this.migrationSeats, this.clients.length)
    ) {
      return;
    }

    this.state.migrationReady = true;
    this.broadcast('migration_ready');
  }

  private logRejectedRequest(code: string, event = 'onecard.request_rejected') {
    logRoomEvent('warn', event, {
      roomId: this.roomId,
      gameId: MAPLE_ONE_CARD_GAME.id,
      code,
    });
  }

  private rejectRequest(client: Client, code: string, message: string) {
    this.logRejectedRequest(code);
    sendRoomError(client, code, message);
  }

  private getHand(player: OneCardPlayer): OneCardCard[] {
    return this.hands.get(player.sessionId) ?? [];
  }

  private syncPrivateHand(player: OneCardPlayer) {
    const hand = this.getHand(player);
    player.handCount = hand.length;

    const client = this.clients.find(
      (candidate) => candidate.sessionId === player.sessionId,
    );
    if (!client) return;

    client.send(ONECARD_MESSAGES.privateHand, {
      cards: hand.map((card) => {
        const playable =
          this.state.gamePhase === 'playing' &&
          this.state.currentTurnId === player.sessionId &&
          canPlayCard({
            card,
            topCard: getTopCard(this.state),
            currentColor: this.state.currentColor,
            pendingAttack: this.state.pendingAttack,
          });

        return {
          id: card.id,
          color: card.color,
          type: card.type,
          number: card.number,
          playable,
        };
      }),
    });
  }

  private syncAllPrivateHands() {
    this.state.players.forEach((player) => this.syncPrivateHand(player));
  }
}
