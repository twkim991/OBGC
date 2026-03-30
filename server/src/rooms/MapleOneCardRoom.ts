import { Room, Client, matchMaker } from 'colyseus';
import { Schema, MapSchema, ArraySchema, type } from '@colyseus/schema';

// --- 스키마 정의 ---
export class OneCardCard extends Schema {
  @type('string') id: string = '';
  @type('string') color: string = ''; // red, yellow, green, blue, purple
  @type('string') type: string = ''; // number, jump, reverse, plus1, wild, attack2, attack3, oz, mihile, hawkeye, irina, ikart
  @type('number') number: number = 0; // 숫자카드가 아니면 0
}

export class OneCardPlayer extends Schema {
  @type('string') sessionId: string = '';
  @type('string') nickname: string = '';
  @type([OneCardCard]) hand = new ArraySchema<OneCardCard>();

  @type('boolean') alive: boolean = true;
  @type('boolean') bankrupt: boolean = false;
  @type('number') rank: number = 0;

  // 미하일 지속용: "다음 자신의 턴 종료시까지"
  @type('boolean') shieldActive: boolean = false;
  @type('boolean') shieldPendingExpire: boolean = false;
}

export class MapleOneCardState extends Schema {
  @type({ map: OneCardPlayer }) players = new MapSchema<OneCardPlayer>();

  @type([OneCardCard]) deck = new ArraySchema<OneCardCard>();
  @type([OneCardCard]) discardPile = new ArraySchema<OneCardCard>();

  @type('string') currentTurnId: string = '';
  @type('number') direction: number = 1; // 1 or -1
  @type('string') gamePhase: string = 'waiting'; // waiting, playing, finished

  @type('string') currentColor: string = '';
  @type('number') pendingAttack: number = 0;

  @type('string') winnerSessionId: string = '';
  @type(['string']) rankings = new ArraySchema<string>();

  @type('string') lastAction: string = '';
  @type('number') turnCount: number = 0;
}

// --- 덱 생성 ---
let seq = 0;
function nextCardId() {
  seq += 1;
  return `oc_${seq}`;
}

function makeCard(color: string, type: string, number = 0): OneCardCard {
  const card = new OneCardCard();
  card.id = nextCardId();
  card.color = color;
  card.type = type;
  card.number = number;
  return card;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createDeck(): OneCardCard[] {
  const deck: OneCardCard[] = [];
  const colors = ['red', 'yellow', 'green', 'blue'];

  for (const color of colors) {
    for (let n = 1; n <= 6; n++) {
      deck.push(makeCard(color, 'number', n));
    }

    deck.push(makeCard(color, 'jump'));
    deck.push(makeCard(color, 'reverse'));
    deck.push(makeCard(color, 'plus1'));
    deck.push(makeCard(color, 'wild'));

    deck.push(makeCard(color, 'attack2'));
    deck.push(makeCard(color, 'attack3'));
  }

  deck.push(makeCard('red', 'oz'));
  deck.push(makeCard('yellow', 'mihile'));
  deck.push(makeCard('blue', 'hawkeye'));
  deck.push(makeCard('green', 'irina'));
  deck.push(makeCard('purple', 'ikart'));

  return shuffle(deck);
}

// --- 룰 유틸 ---
function isAttackCard(card: OneCardCard | undefined | null) {
  if (!card) return false;
  return (
    card.type === 'attack2' || card.type === 'attack3' || card.type === 'oz'
  );
}

function getAttackValue(card: OneCardCard | undefined | null) {
  if (!card) return 0;
  if (card.type === 'attack2') return 2;
  if (card.type === 'attack3') return 3;
  if (card.type === 'oz') return 5;
  return 0;
}

function getTopCard(state: MapleOneCardState): OneCardCard | null {
  if (state.discardPile.length === 0) return null;
  return state.discardPile[state.discardPile.length - 1];
}

export class MapleOneCardRoom extends Room<MapleOneCardState> {
  private isReturning = false;

  onCreate() {
    this.setState(new MapleOneCardState());
    this.maxClients = 4;

    this.onMessage('chat', (client, message) => {
      this.broadcast('chat', {
        clientId: client.sessionId,
        message: `[메이플원카드] ${message}`,
      });
    });

    this.onMessage('start_game', (client) => {
      if (this.state.gamePhase !== 'waiting') return;
      if (this.state.players.size < 2) return;

      this.startGame();
      this.broadcast('chat', {
        clientId: 'System',
        message: `🃏 메이플 원카드 게임이 시작되었습니다!`,
      });
    });

    this.onMessage(
      'play_card',
      (client, payload: { cardId: string; chosenColor?: string }) => {
        if (this.state.gamePhase !== 'playing') return;
        if (client.sessionId !== this.state.currentTurnId) return;

        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive || player.bankrupt) return;

        const cardIndex = player.hand.findIndex((c) => c.id === payload.cardId);
        if (cardIndex === -1) return;

        const card = player.hand[cardIndex];
        if (!this.canPlayCard(player, card)) return;

        const topBefore = getTopCard(this.state);

        player.hand.splice(cardIndex, 1);

        // 이카르트는 discardPile에 남지 않음
        if (card.type !== 'ikart') {
          this.state.discardPile.push(card);
        }

        this.applyCardEffect(player, card, payload.chosenColor, topBefore);

        // 현재 턴 플레이어가 이리나 등으로 0장 될 수 있음
        if (player.hand.length === 0 && !this.state.winnerSessionId) {
          this.finishGame(player.sessionId);
          return;
        }

        this.checkBankruptAll();
        this.checkForcedGameEnd();
      },
    );

    this.onMessage('draw_card', (client) => {
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

    this.onMessage('return_to_table', async (client) => {
      if (this.state.gamePhase !== 'finished' || this.isReturning) return;
      this.isReturning = true;

      try {
        const newTable = await matchMaker.createRoom('table_room', {
          roomName: '🃏 메이플 원카드 리매치 대기실',
        });

        this.broadcast('move_room', {
          roomId: newTable.roomId,
          gameType: 'table',
        });
      } catch (e) {
        console.error('대기실 복귀 실패:', e);
        this.isReturning = false;
      }
    });
  }

  onJoin(client: Client, options: any) {
    if (this.state.gamePhase !== 'waiting') {
      client.leave();
      return;
    }

    const player = new OneCardPlayer();
    player.sessionId = client.sessionId;
    player.nickname = options?.nickname || client.sessionId;

    this.state.players.set(client.sessionId, player);

    if (this.state.players.size === 1) {
      this.state.currentTurnId = client.sessionId;
    }

    this.broadcast('chat', {
      clientId: 'System',
      message: `${player.nickname} 님이 입장했습니다.`,
    });
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    // waiting 상태에서는 그냥 제거
    if (this.state.gamePhase === 'waiting') {
      this.state.players.delete(client.sessionId);

      if (this.state.currentTurnId === client.sessionId) {
        const ids = Array.from(this.state.players.keys());
        this.state.currentTurnId = ids[0] || '';
      }
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
  private startGame() {
    this.state.deck.clear();
    this.state.discardPile.clear();
    this.state.rankings.clear();
    this.state.winnerSessionId = '';
    this.state.direction = 1;
    this.state.pendingAttack = 0;
    this.state.turnCount = 1;
    this.state.lastAction = '게임 시작';
    this.state.gamePhase = 'playing';

    const rawDeck = createDeck();

    this.state.players.forEach((player) => {
      player.hand.clear();
      player.alive = true;
      player.bankrupt = false;
      player.rank = 0;
      player.shieldActive = false;
      player.shieldPendingExpire = false;

      for (let i = 0; i < 7; i++) {
        const card = rawDeck.shift();
        if (card) player.hand.push(card);
      }
    });

    // 시작 카드 오픈
    let first = rawDeck.shift();
    while (first && first.type === 'ikart') {
      rawDeck.push(first);
      const reshuffled = shuffle(rawDeck);
      rawDeck.length = 0;
      rawDeck.push(...reshuffled);
      first = rawDeck.shift();
    }

    if (first) {
      this.state.discardPile.push(first);
      this.state.currentColor = first.color === 'purple' ? '' : first.color;
    } else {
      this.state.currentColor = '';
    }

    rawDeck.forEach((card) => this.state.deck.push(card));

    const ids = Array.from(this.state.players.keys());
    this.state.currentTurnId = ids[0] || '';

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
  }

  // --- 카드 제출 가능 여부 ---
  private canPlayCard(player: OneCardPlayer, card: OneCardCard): boolean {
    const top = getTopCard(this.state);

    // 공격 진행 중이면 공격 대응 규칙 우선
    if (this.state.pendingAttack > 0) {
      if (!top) return false;

      if (top.type === 'oz') {
        return card.type === 'mihile' || card.type === 'ikart';
      }

      if (card.type === 'mihile' || card.type === 'ikart') return true;

      if (!isAttackCard(card)) return false;

      return getAttackValue(card) >= getAttackValue(top);
    }

    // 이카르트는 언제든 가능
    if (card.type === 'ikart') return true;

    // 첫 카드면 허용
    if (!top) return true;

    // 와일드는 "현재 카드와 같은 색"이거나
    // 현재 카드가 와일드일 때만 가능
    if (card.type === 'wild') {
      return card.color === this.state.currentColor || top.type === 'wild';
    }

    // 현재 색상 일치
    if (card.color === this.state.currentColor) return true;

    // 숫자 일치
    if (
      card.type === 'number' &&
      top.type === 'number' &&
      card.number === top.number
    ) {
      return true;
    }

    // 특수카드끼리만 타입 일치 허용
    const specialTypes = [
      'jump',
      'reverse',
      'plus1',
      'wild',
      'attack2',
      'attack3',
      'oz',
      'mihile',
      'hawkeye',
      'irina',
      'ikart',
    ];

    if (
      specialTypes.includes(card.type) &&
      specialTypes.includes(top.type) &&
      card.type === top.type
    ) {
      return true;
    }

    // 공격카드끼리 일반 상황 추가 허용
    if (isAttackCard(card) && isAttackCard(top)) {
      return (
        card.color === this.state.currentColor ||
        getAttackValue(card) === getAttackValue(top)
      );
    }

    return false;
  }

  // --- 카드 효과 적용 ---
  private applyCardEffect(
    player: OneCardPlayer,
    card: OneCardCard,
    chosenColor?: string,
    topBefore?: OneCardCard | null,
  ) {
    const playerName = player.nickname;
    const aliveCount = this.getAlivePlayers().length;

    switch (card.type) {
      case 'number': {
        this.state.currentColor = card.color;
        this.state.lastAction = `${playerName}: 숫자 카드`;
        this.broadcast('chat', {
          clientId: 'System',
          message: `🃏 ${playerName}님이 ${this.formatCard(card)}를 냈습니다.`,
        });
        this.passTurn();
        return;
      }

      case 'jump': {
        this.state.currentColor = card.color;
        this.broadcast('chat', {
          clientId: 'System',
          message: `⏭️ ${playerName}님이 점프 카드를 냈습니다.`,
        });

        if (aliveCount === 2) {
          // 2인전에서는 +1처럼 자기 턴 유지
          return;
        }

        this.passTurn(2);
        return;
      }

      case 'reverse': {
        this.state.currentColor = card.color;
        this.state.direction *= -1;
        this.broadcast('chat', {
          clientId: 'System',
          message: `🔄 ${playerName}님이 리버스 카드를 냈습니다.`,
        });
        this.passTurn();
        return;
      }

      case 'plus1': {
        this.state.currentColor = card.color;
        this.broadcast('chat', {
          clientId: 'System',
          message: `➕ ${playerName}님이 +1 카드를 냈습니다. 한 번 더 진행합니다.`,
        });
        // 자기 턴 유지
        return;
      }

      case 'wild': {
        this.state.currentColor = this.normalizeChosenColor(chosenColor);
        this.broadcast('chat', {
          clientId: 'System',
          message: `🌈 ${playerName}님이 색깔 바꾸기 카드를 냈습니다. 현재 색상: ${this.state.currentColor}`,
        });
        this.passTurn();
        return;
      }

      case 'attack2':
      case 'attack3': {
        this.state.currentColor = card.color;
        this.state.pendingAttack += getAttackValue(card);

        this.broadcast('chat', {
          clientId: 'System',
          message: `🔥 ${playerName}님이 ${this.formatCard(
            card,
          )}를 사용했습니다. 누적 공격: ${this.state.pendingAttack}`,
        });

        this.passTurn();
        return;
      }

      case 'oz': {
        this.state.currentColor = card.color;
        this.state.pendingAttack += 5;

        this.broadcast('chat', {
          clientId: 'System',
          message: `🔥🔥 ${playerName}님이 오즈를 사용했습니다. 누적 공격: ${this.state.pendingAttack}`,
        });

        this.passTurn();
        return;
      }

      case 'mihile': {
        this.state.currentColor = card.color;

        player.shieldActive = true;
        player.shieldPendingExpire = false;

        this.state.pendingAttack = 0;

        this.broadcast('chat', {
          clientId: 'System',
          message: `🛡️ ${playerName}님이 미하일을 사용했습니다. 공격을 무효화합니다.`,
        });

        this.passTurn();
        return;
      }

      case 'hawkeye': {
        this.state.currentColor = card.color;

        this.state.players.forEach((other, otherId) => {
          if (otherId === player.sessionId) return;
          if (!other.alive || other.bankrupt) return;
          this.drawCards(other, 2);
        });

        this.broadcast('chat', {
          clientId: 'System',
          message: `🎯 ${playerName}님이 호크아이를 사용했습니다. 자신을 제외한 모두가 2장씩 받습니다.`,
        });

        this.checkBankruptAll();
        if (this.state.gamePhase === 'finished') return;

        this.passTurn();
        return;
      }

      case 'irina': {
        this.handleIrina(player, chosenColor);
        return;
      }

      case 'ikart': {
        // discardPile에 쌓이지 않음
        // currentColor 유지
        // 공격 중이면 pendingAttack 유지한 채 다음으로 넘김
        this.broadcast('chat', {
          clientId: 'System',
          message: `🫥 ${playerName}님이 이카르트를 사용했습니다.`,
        });

        // topBefore의 색 유지
        if (topBefore && topBefore.color !== 'purple') {
          this.state.currentColor = this.state.currentColor || topBefore.color;
        }

        this.passTurn();
        return;
      }

      default:
        return;
    }
  }

  private handleIrina(player: OneCardPlayer, chosenColor?: string) {
    this.state.players.forEach((p) => {
      const kept: OneCardCard[] = [];
      const removedGreens: OneCardCard[] = [];

      for (const card of p.hand) {
        if (card.color === 'green') removedGreens.push(card);
        else kept.push(card);
      }

      p.hand.clear();
      kept.forEach((card) => p.hand.push(card));
      removedGreens.forEach((card) => this.state.deck.push(card));
    });

    // deck 재셔플
    const shuffled = shuffle(Array.from(this.state.deck));
    this.state.deck.clear();
    shuffled.forEach((card) => this.state.deck.push(card));

    let nextColor = this.normalizeChosenColor(chosenColor);
    if (nextColor === 'green') nextColor = 'red';
    this.state.currentColor = nextColor;

    this.broadcast('chat', {
      clientId: 'System',
      message: `🌪️ ${player.nickname}님이 이리나를 사용했습니다. 모든 초록 카드를 흡수하고 현재 색상을 ${this.state.currentColor}(으)로 바꿉니다.`,
    });

    // 이리나로 인해 누군가 0장 될 수 있음
    const zeroPlayers = this.getAlivePlayers().filter(
      (p) => p.hand.length === 0,
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
    for (let i = 0; i < count; i++) {
      if (this.state.deck.length === 0) {
        this.refillDeck();
      }

      if (this.state.deck.length === 0) return;

      const card = this.state.deck.shift();
      if (card) player.hand.push(card);
    }
  }

  private refillDeck() {
    if (this.state.discardPile.length <= 1) return;

    const top = this.state.discardPile[this.state.discardPile.length - 1];
    const rest: OneCardCard[] = [];

    for (let i = 0; i < this.state.discardPile.length - 1; i++) {
      rest.push(this.state.discardPile[i]);
    }

    const shuffled = shuffle(rest);

    this.state.discardPile.clear();
    if (top) this.state.discardPile.push(top);

    shuffled.forEach((card) => this.state.deck.push(card));
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

    let currentIndex = aliveIds.indexOf(this.state.currentTurnId);
    if (currentIndex === -1) currentIndex = 0;

    for (let i = 0; i < step; i++) {
      currentIndex =
        (currentIndex + this.state.direction + aliveIds.length) %
        aliveIds.length;
    }

    this.state.currentTurnId = aliveIds[currentIndex];
    this.state.turnCount += 1;
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
    if (player.hand.length > 17) {
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
    const turnPriority = this.buildTurnPriorityMap(aliveIds);

    const sorted = Array.from(this.state.players.values()).sort((a, b) => {
      if (a.sessionId === winnerSessionId) return -1;
      if (b.sessionId === winnerSessionId) return 1;

      if (a.bankrupt && !b.bankrupt) return 1;
      if (!a.bankrupt && b.bankrupt) return -1;

      if (a.hand.length !== b.hand.length) {
        return a.hand.length - b.hand.length;
      }

      return (
        (turnPriority[a.sessionId] ?? 999) - (turnPriority[b.sessionId] ?? 999)
      );
    });

    sorted.forEach((player, idx) => {
      player.rank = idx + 1;
      this.state.rankings.push(player.sessionId);
    });

    const winner = this.state.players.get(winnerSessionId);
    this.broadcast('chat', {
      clientId: 'System',
      message: `🏆 게임 종료! ${
        winner?.nickname || winnerSessionId
      }님이 1위를 차지했습니다.`,
    });
  }

  private buildTurnPriorityMap(aliveIds: string[]) {
    const map: Record<string, number> = {};
    if (aliveIds.length === 0) return map;

    let currentIndex = aliveIds.indexOf(this.state.currentTurnId);
    if (currentIndex === -1) currentIndex = 0;

    for (let i = 0; i < aliveIds.length; i++) {
      map[aliveIds[(currentIndex + i) % aliveIds.length]] = i;
    }

    return map;
  }

  // --- 기타 ---
  private normalizeChosenColor(color?: string) {
    if (
      color === 'red' ||
      color === 'yellow' ||
      color === 'green' ||
      color === 'blue'
    ) {
      return color;
    }
    return 'red';
  }

  private formatCard(card: OneCardCard | null | undefined) {
    if (!card) return '없음';
    if (card.type === 'number') return `${card.color} ${card.number}`;
    return `${card.color} ${card.type}`;
  }
}
