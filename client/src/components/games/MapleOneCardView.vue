<!-- client/src/components/games/MapleOneCardView.vue -->
<template>
  <div class="onecard-wrap">
    <header class="game-header">
      <div>
        <p class="eyebrow">TABLE GAME</p>
        <h2>메이플 원카드</h2>
      </div>
      <div class="turn-chip" :class="{ mine: isMyTurn }">
        <span class="turn-label">현재 턴</span>
        <strong>{{ currentPlayerName }}</strong>
      </div>
    </header>

    <section class="status-grid">
      <article class="status-card">
        <p class="status-title">현재 색상</p>
        <div class="color-pill" :class="`color-${state?.currentColor || 'none'}`">
          {{ colorKoreanName(state?.currentColor) }}
        </div>
      </article>
      <article class="status-card">
        <p class="status-title">누적 공격</p>
        <p class="status-value danger">{{ state?.pendingAttack ?? 0 }} 장</p>
      </article>
      <article class="status-card status-card-wide">
        <p class="status-title">최근 액션</p>
        <p class="status-value subdued">{{ state?.lastAction || '게임을 시작하세요.' }}</p>
      </article>
    </section>

    <section class="play-area">
      <article class="board-panel discard-panel">
        <h3>중앙 카드</h3>
        <div v-if="topCard" class="table-card" :class="`color-${topCard.color}`">
          <span class="card-type">{{ cardTypeLabel(topCard) }}</span>
          <span class="card-name">{{ formatCard(topCard) }}</span>
        </div>
        <div v-else class="table-card empty">없음</div>
      </article>

      <article class="board-panel players-panel">
        <h3>플레이어 현황</h3>
        <div class="players">
          <div
            v-for="player in state?.players || []"
            :key="player.sessionId"
            class="player-box"
            :class="{
              current: player.sessionId === state?.players?.[state?.currentPlayerIndex]?.sessionId,
              me: player.sessionId === mySessionId,
              bankrupt: player.bankrupt,
            }"
          >
            <div class="player-top-row">
              <strong>{{ player.nickname }}</strong>
              <span v-if="player.sessionId === mySessionId" class="me-badge">나</span>
            </div>
            <div class="player-meta">손패 {{ player.hand.length }}장</div>
            <div v-if="player.rank" class="player-meta">순위 {{ player.rank }}위</div>
            <div v-if="player.bankrupt" class="player-bankrupt">파산</div>
          </div>
        </div>
      </article>
    </section>

    <section class="my-hand">
      <div class="section-title-row">
        <h3>내 손패</h3>
        <p>{{ myHand.length }}장</p>
      </div>
      <div class="cards">
        <button
          v-for="card in myHand"
          :key="card.id"
          class="card-btn"
          :class="[`color-${card.color}`, { playable: isMyTurn && canPlay(card) }]"
          :disabled="!isMyTurn || !canPlay(card)"
          @click="onClickCard(card)"
        >
          <span class="card-type">{{ cardTypeLabel(card) }}</span>
          <span>{{ formatCard(card) }}</span>
        </button>
      </div>
    </section>

    <section class="controls">
      <button v-if="state?.gamePhase === 'waiting'" class="primary-btn" @click="startGame">
        게임 시작
      </button>
      <button
        v-if="state?.gamePhase === 'playing' && isMyTurn"
        class="accent-btn"
        @click="drawCard"
      >
        {{ state?.pendingAttack > 0 ? `${state.pendingAttack}장 받기` : '카드 1장 뽑기' }}
      </button>
    </section>

    <section v-if="showColorPicker" class="color-picker">
      <p>색을 선택하세요</p>
      <div class="color-btn-row">
        <button class="pick-btn color-red" @click="submitSelectedCard('red')">빨강</button>
        <button class="pick-btn color-yellow" @click="submitSelectedCard('yellow')">노랑</button>
        <button class="pick-btn color-green" @click="submitSelectedCard('green')">초록</button>
        <button class="pick-btn color-blue" @click="submitSelectedCard('blue')">파랑</button>
      </div>
    </section>

    <section v-if="state?.ended" class="result">
      <h3>게임 종료</h3>
      <ol>
        <li v-for="sid in state.rankings" :key="sid">
          {{ getPlayerName(sid) }}
        </li>
      </ol>
    </section>

    <section class="chat-box">
      <h3>채팅</h3>
      <div v-if="!messages.length" class="chat-empty">아직 채팅이 없습니다.</div>
      <div v-for="(msg, index) in messages" :key="index" class="chat-row">
        <strong>{{ msg.clientId }}:</strong> {{ msg.message }}
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  gameConnection: { type: Object, required: true },
});

const room = computed(() => props.gameConnection ?? null);
const mySessionId = computed(() => props.gameConnection?.sessionId ?? '');

const state = ref(null);
const pendingCard = ref(null);
const showColorPicker = ref(false);
const messages = ref([]);

let boundRoomId = '';

watch(
  room,
  (nextRoom) => {
    if (!nextRoom) return;
    if (boundRoomId === nextRoom.roomId) return;

    nextRoom.onStateChange((newState) => {
      state.value = JSON.parse(JSON.stringify(newState));
    });

    nextRoom.onMessage('chat', (data) => {
      messages.value.push(data);
    });

    nextRoom.onMessage('move_room', (data) => {
      console.log('move_room', data);
    });

    boundRoomId = nextRoom.roomId;
  },
  { immediate: true }
);

const players = computed(() => {
  if (!state.value?.players) return [];
  return Object.values(state.value.players);
});

const myPlayer = computed(() => players.value.find((p) => p.sessionId === mySessionId.value));

const myHand = computed(() => myPlayer.value?.hand || []);

const topCard = computed(() => {
  const pile = state.value?.discardPile || [];
  return pile.length ? pile[pile.length - 1] : null;
});

const isMyTurn = computed(() => {
  return state.value?.currentTurnId === mySessionId.value;
});

const currentPlayerName = computed(() => {
  if (!state.value?.currentTurnId) return '-';
  const player = players.value.find((p) => p.sessionId === state.value.currentTurnId);
  return player?.nickname || state.value.currentTurnId;
});

function colorKoreanName(color) {
  const names = {
    red: '빨강',
    yellow: '노랑',
    green: '초록',
    blue: '파랑',
  };
  return names[color] || '없음';
}

function cardTypeLabel(card) {
  if (!card) return 'CARD';
  if (card.type === 'number') return `#${card.number}`;
  return card.type.toUpperCase();
}

function formatCard(card) {
  if (!card) return '없음';
  if (card.type === 'number') return `${card.color} ${card.number}`;
  return `${card.color} ${card.type}`;
}

function getPlayerName(sessionId) {
  const player = players.value.find((p) => p.sessionId === sessionId);
  return player?.nickname || sessionId;
}

function canPlay(card) {
  if (!state.value || !isMyTurn.value) return false;

  const top = topCard.value;

  if (state.value.pendingAttack > 0) {
    if (!top) return false;

    if (top.type === 'oz') {
      return ['mihile', 'ikart'].includes(card.type);
    }

    if (['mihile', 'ikart'].includes(card.type)) return true;

    const attackValues = { attack2: 2, attack3: 3, oz: 5 };
    if (!(card.type in attackValues)) return false;

    return attackValues[card.type] >= (attackValues[top.type] || 0);
  }

  if (card.type === 'ikart') return true;
  if (!top) return true;
  if (card.color === state.value.currentColor) return true;

  if (card.type === 'number' && top.type === 'number' && card.number === top.number) {
    return true;
  }

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

  const attackValues = { attack2: 2, attack3: 3, oz: 5 };
  if (card.type in attackValues && top.type in attackValues) {
    return (
      card.color === state.value.currentColor || attackValues[card.type] === attackValues[top.type]
    );
  }

  return false;
}

function startGame() {
  if (!room.value) return;
  room.value.send('start_game');
}

function drawCard() {
  if (!room.value) return;
  room.value.send('draw_card');
}

function onClickCard(card) {
  if (!room.value) return;

  if (card.type === 'wild' || card.type === 'irina') {
    pendingCard.value = card;
    showColorPicker.value = true;
    return;
  }

  room.value.send('play_card', { cardId: card.id });
}

function submitSelectedCard(color) {
  if (!room.value || !pendingCard.value) return;

  room.value.send('play_card', {
    cardId: pendingCard.value.id,
    chosenColor: color,
  });

  pendingCard.value = null;
  showColorPicker.value = false;
}
</script>

<style scoped>
.onecard-wrap {
  padding: 20px;
  color: #f7fbff;
  background: radial-gradient(circle at top, #2d3d74 0%, #161a33 42%, #0f1221 100%);
  border: 1px solid rgba(122, 163, 255, 0.28);
  border-radius: 16px;
  display: grid;
  gap: 16px;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.eyebrow {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.16em;
  color: #9fc0ff;
}

.game-header h2,
h3,
p {
  margin: 0;
}

.turn-chip {
  background: rgba(118, 147, 224, 0.2);
  border: 1px solid rgba(144, 170, 255, 0.45);
  border-radius: 999px;
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.turn-chip.mine {
  border-color: #52e0a5;
  box-shadow: 0 0 0 1px rgba(82, 224, 165, 0.3) inset;
}

.turn-label {
  color: #b1c8ff;
  font-size: 12px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.status-card {
  background: rgba(17, 24, 50, 0.8);
  border: 1px solid rgba(137, 176, 255, 0.25);
  border-radius: 12px;
  padding: 12px;
}

.status-card-wide {
  grid-column: span 2;
}

.status-title {
  color: #a7bcf7;
  margin-bottom: 8px;
  font-size: 13px;
}

.status-value {
  font-weight: 700;
}

.status-value.danger {
  color: #ff9c98;
}

.status-value.subdued {
  color: #d3e2ff;
  font-weight: 500;
}

.color-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 86px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
}

.play-area {
  display: grid;
  grid-template-columns: minmax(180px, 240px) 1fr;
  gap: 12px;
}

.board-panel {
  background: rgba(15, 18, 35, 0.8);
  border-radius: 14px;
  border: 1px solid rgba(160, 189, 255, 0.2);
  padding: 12px;
}

.discard-panel {
  display: grid;
  gap: 10px;
  align-content: start;
}

.table-card {
  border-radius: 14px;
  min-height: 180px;
  background: linear-gradient(155deg, rgba(19, 27, 62, 0.95), rgba(11, 15, 33, 0.95));
  border: 1px solid rgba(148, 182, 255, 0.38);
  display: grid;
  place-content: center;
  text-align: center;
  gap: 8px;
  padding: 12px;
  font-weight: 700;
}

.table-card.empty {
  color: #95a9dc;
}

.players {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}

.player-box {
  background: rgba(30, 37, 73, 0.75);
  border: 1px solid rgba(145, 176, 242, 0.25);
  border-radius: 10px;
  padding: 10px;
}

.player-box.current {
  border-color: #f3dd85;
  box-shadow: 0 0 0 1px rgba(243, 221, 133, 0.35) inset;
}

.player-box.me {
  border-color: #78deae;
}

.player-box.bankrupt {
  opacity: 0.6;
}

.player-top-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.me-badge {
  background: #2cc88b;
  color: #063522;
  border-radius: 999px;
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 700;
}

.player-meta {
  margin-top: 6px;
  color: #c8dbff;
  font-size: 13px;
}

.player-bankrupt {
  margin-top: 6px;
  color: #ff928d;
  font-size: 13px;
  font-weight: 700;
}

.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.cards {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.card-btn {
  border: 1px solid rgba(149, 186, 255, 0.36);
  background: linear-gradient(160deg, rgba(35, 48, 98, 0.95), rgba(15, 20, 42, 0.95));
  color: #fff;
  min-width: 110px;
  min-height: 140px;
  border-radius: 12px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.card-btn.playable:not(:disabled):hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
}

.card-btn:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.card-type {
  font-size: 12px;
  opacity: 0.88;
}

.controls {
  display: flex;
  gap: 10px;
}

.primary-btn,
.accent-btn,
.pick-btn {
  border: none;
  border-radius: 10px;
  padding: 10px 14px;
  font-weight: 700;
  cursor: pointer;
}

.primary-btn {
  background: #71a0ff;
  color: #0b1a46;
}

.accent-btn {
  background: #ffd66f;
  color: #4b3400;
}

.color-picker {
  background: rgba(13, 18, 39, 0.92);
  border: 1px solid rgba(137, 173, 255, 0.25);
  border-radius: 12px;
  padding: 12px;
  display: grid;
  gap: 10px;
}

.color-btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pick-btn.color-red {
  background: #f15a64;
  color: #fff;
}

.pick-btn.color-yellow {
  background: #ffcd4f;
  color: #523b00;
}

.pick-btn.color-green {
  background: #42cc92;
  color: #072f1d;
}

.pick-btn.color-blue {
  background: #6297ff;
  color: #041e51;
}

.chat-box {
  background: rgba(13, 17, 34, 0.72);
  border-radius: 12px;
  border: 1px solid rgba(153, 184, 255, 0.2);
  padding: 12px;
  display: grid;
  gap: 6px;
  max-height: 220px;
  overflow-y: auto;
}

.chat-empty {
  color: #94abde;
  font-size: 13px;
}

.chat-row {
  background: rgba(33, 44, 84, 0.6);
  border-radius: 8px;
  padding: 8px;
}

.result {
  background: rgba(11, 15, 33, 0.9);
  border: 1px solid rgba(179, 202, 255, 0.25);
  border-radius: 12px;
  padding: 12px;
}

.color-red {
  background-color: #d84f5a;
}

.color-yellow {
  background-color: #d9b23f;
  color: #231b00;
}

.color-green {
  background-color: #2f9a6f;
}

.color-blue {
  background-color: #4f79d8;
}

.color-none {
  background-color: rgba(153, 177, 232, 0.5);
}

@media (max-width: 900px) {
  .status-card-wide {
    grid-column: span 1;
  }

  .play-area {
    grid-template-columns: 1fr;
  }

  .table-card {
    min-height: 140px;
  }
}
</style>
