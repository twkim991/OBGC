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
              current: player.sessionId === state?.currentTurnId,
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
      <button class="secondary-btn" @click="toggleBgm">
        {{ isBgmEnabled ? '브금 끄기' : '브금 켜기' }}
      </button>
    </section>

    <p v-if="bgmError" class="bgm-error">{{ bgmError }}</p>

    <audio ref="audioRef" loop preload="auto" src="/audio/maple-onecard-bgm.mp3" />

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
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  gameConnection: { type: Object, required: true },
});

const room = computed(() => props.gameConnection ?? null);
const mySessionId = computed(() => props.gameConnection?.sessionId ?? '');

const state = ref(null);
const pendingCard = ref(null);
const showColorPicker = ref(false);
const messages = ref([]);
const audioRef = ref(null);
const isBgmEnabled = ref(true);
const bgmError = ref('');

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
  tryPlayBgm();
  room.value.send('start_game');
}

function drawCard() {
  if (!room.value) return;
  room.value.send('draw_card');
}

function onClickCard(card) {
  if (!room.value) return;
  tryPlayBgm();

  if (card.type === 'wild' || card.type === 'irina') {
    pendingCard.value = card;
    showColorPicker.value = true;
    return;
  }

  room.value.send('play_card', { cardId: card.id });
}

function submitSelectedCard(color) {
  if (!room.value || !pendingCard.value) return;
  tryPlayBgm();

  room.value.send('play_card', {
    cardId: pendingCard.value.id,
    chosenColor: color,
  });

  pendingCard.value = null;
  showColorPicker.value = false;
}

async function tryPlayBgm() {
  if (!isBgmEnabled.value || !audioRef.value) return;

  try {
    await audioRef.value.play();
    bgmError.value = '';
  } catch {
    bgmError.value = '브라우저 정책으로 자동 재생이 차단될 수 있어요. 버튼을 한 번 더 눌러 주세요.';
  }
}

function toggleBgm() {
  isBgmEnabled.value = !isBgmEnabled.value;
  bgmError.value = '';

  if (!audioRef.value) return;

  if (isBgmEnabled.value) {
    tryPlayBgm();
    return;
  }

  audioRef.value.pause();
  audioRef.value.currentTime = 0;
}

function onAudioLoadError() {
  bgmError.value = '브금 파일을 찾을 수 없어요. /client/public/audio/maple-onecard-bgm.mp3 경로를 확인해 주세요.';
}

onMounted(() => {
  const unlockAudio = () => {
    tryPlayBgm();
  };

  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });

  if (audioRef.value) {
    audioRef.value.addEventListener('error', onAudioLoadError);
  }
});

onBeforeUnmount(() => {
  if (audioRef.value) {
    audioRef.value.pause();
    audioRef.value.removeEventListener('error', onAudioLoadError);
  }
});
</script>

<style scoped>
.onecard-wrap {
  padding: 20px;
  color: #2f2a22;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0) 24%),
    radial-gradient(circle at top right, rgba(255, 245, 214, 0.45) 0%, rgba(255, 245, 214, 0) 28%),
    linear-gradient(135deg, #f7f3ea 0%, #ece4d6 32%, #ddd2bf 58%, #f3ede2 100%);
  border: 1px solid rgba(154, 126, 74, 0.28);
  border-radius: 22px;
  display: grid;
  gap: 16px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.75),
    0 18px 40px rgba(76, 60, 31, 0.16);
  position: relative;
  overflow: hidden;
}

.onecard-wrap::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(115deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 22%),
    linear-gradient(155deg, rgba(120, 104, 77, 0.06) 8%, rgba(120, 104, 77, 0) 18%),
    linear-gradient(
      25deg,
      rgba(255, 255, 255, 0) 45%,
      rgba(255, 255, 255, 0.14) 52%,
      rgba(255, 255, 255, 0) 58%
    ),
    linear-gradient(170deg, rgba(145, 128, 99, 0.05) 0%, rgba(145, 128, 99, 0) 35%);
  pointer-events: none;
}

.onecard-wrap > * {
  position: relative;
  z-index: 1;
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
  letter-spacing: 0.18em;
  color: #8a6d3b;
  font-weight: 700;
}

.game-header h2 {
  color: #3a2f22;
}

.turn-chip {
  background: linear-gradient(180deg, rgba(255, 252, 244, 0.92), rgba(236, 226, 206, 0.92));
  border: 1px solid rgba(166, 135, 78, 0.34);
  border-radius: 999px;
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.85),
    0 6px 14px rgba(96, 76, 41, 0.1);
}

.turn-chip.mine {
  border-color: rgba(176, 136, 58, 0.7);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.85),
    0 0 0 1px rgba(176, 136, 58, 0.18),
    0 8px 18px rgba(120, 90, 32, 0.16);
}

.turn-label {
  color: #8d7348;
  font-size: 12px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.status-card {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.82), rgba(241, 235, 223, 0.88));
  border: 1px solid rgba(163, 132, 78, 0.24);
  border-radius: 16px;
  padding: 12px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 10px 22px rgba(91, 72, 38, 0.08);
}

.status-title {
  color: #8a7147;
  margin-bottom: 8px;
  font-size: 13px;
}

.status-value {
  color: #32291f;
  font-weight: 700;
}

.status-value.danger {
  color: #a54d32;
}

.status-value.subdued {
  color: #5b4b38;
  font-weight: 500;
}

.board-panel {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.72), rgba(237, 230, 218, 0.82));
  border-radius: 18px;
  border: 1px solid rgba(163, 132, 78, 0.22);
  padding: 12px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 12px 26px rgba(95, 73, 34, 0.08);
}

.board-panel h3,
.section-title-row h3,
.chat-box h3,
.result h3 {
  color: #3a2f22;
}

.discard-panel {
  display: grid;
  gap: 10px;
  align-content: start;
}

.table-card {
  border-radius: 18px;
  min-height: 180px;
  background: linear-gradient(145deg, #f7f2e8, #e7dcc9);
  border: 1px solid rgba(161, 131, 77, 0.28);
  display: grid;
  place-content: center;
  text-align: center;
  gap: 8px;
  padding: 12px;
  font-weight: 700;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.85),
    0 10px 22px rgba(92, 72, 37, 0.08);
}

.table-card.empty {
  color: #8d7550;
}

.player-box {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.84), rgba(239, 232, 221, 0.88));
  border: 1px solid rgba(160, 129, 75, 0.18);
  border-radius: 14px;
  padding: 10px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82);
}

.player-box.current {
  border-color: rgba(184, 145, 63, 0.9);
  box-shadow:
    inset 0 0 0 1px rgba(184, 145, 63, 0.2),
    0 0 0 2px rgba(184, 145, 63, 0.08);
}

.player-box.me {
  border-color: rgba(141, 117, 80, 0.7);
}

.player-meta {
  margin-top: 6px;
  color: #5d4d3a;
  font-size: 13px;
}

.player-bankrupt {
  margin-top: 6px;
  color: #a34c32;
  font-size: 13px;
  font-weight: 700;
}

.me-badge {
  background: #d8c39a;
  color: #43331f;
  border-radius: 999px;
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 700;
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

.my-hand {
  min-width: 0;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
  gap: 10px;
  max-width: 100%;
  max-height: 360px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 4px 6px 0;
}

.card-btn {
  border: 1px solid rgba(149, 186, 255, 0.36);
  color: #fff;
  width: 100%;
  min-width: 0;
  min-height: 0;
  aspect-ratio: 11 / 14;
  border-radius: 12px;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-align: left;
  word-break: break-word;
  overflow: hidden;
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
.secondary-btn,
.pick-btn {
  border: 1px solid rgba(150, 119, 63, 0.28);
  border-radius: 12px;
  padding: 10px 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    0 6px 14px rgba(90, 68, 31, 0.1);
}

.primary-btn {
  background: linear-gradient(180deg, #f6e8bf, #d9bc79);
  color: #4b381d;
}

.accent-btn {
  background: linear-gradient(180deg, #efe6d2, #d8c19c);
  color: #4a3922;
}

.secondary-btn {
  background: linear-gradient(180deg, #f8f4ea, #e6d7be);
  color: #4a3922;
}

.primary-btn:disabled,
.accent-btn:disabled,
.secondary-btn:disabled,
.pick-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.bgm-error {
  margin: 0;
  color: #8a4a2c;
  font-size: 13px;
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
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.8), rgba(240, 233, 222, 0.9));
  border-radius: 16px;
  border: 1px solid rgba(162, 131, 78, 0.2);
  padding: 12px;
  display: grid;
  gap: 6px;
  max-height: 220px;
  overflow-y: auto;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.85),
    0 10px 22px rgba(92, 72, 37, 0.08);
}

.chat-empty {
  color: #8a7556;
  font-size: 13px;
}

.chat-row {
  background: rgba(255, 250, 241, 0.8);
  border: 1px solid rgba(168, 137, 82, 0.12);
  border-radius: 10px;
  padding: 8px;
  color: #3e3122;
}

.result {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.82), rgba(238, 229, 214, 0.92));
  border: 1px solid rgba(166, 136, 82, 0.24);
  border-radius: 16px;
  padding: 12px;
  color: #392d20;
}

.color-red {
  background-color: #d84f5a;
  color: #ffffff;
}

.color-yellow {
  background-color: #f0c94a;
  color: #1f1600;
}

.color-green {
  background-color: #2f9a6f;
  color: #ffffff;
}

.color-blue {
  background-color: #4f79d8;
  color: #ffffff;
}

.color-purple {
  background-color: #7a4fd8;
  color: #ffffff;
}

.color-none {
  background-color: rgba(153, 177, 232, 0.5);
  color: #ffffff;
}

/* 손패 카드 */
.card-btn.color-red {
  background: #d84f5a;
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.18);
}

.card-btn.color-yellow {
  background: #f0c94a;
  color: #1f1600;
  border-color: rgba(78, 58, 0, 0.28);
}

.card-btn.color-green {
  background: #2f9a6f;
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.18);
}

.card-btn.color-blue {
  background: #4f79d8;
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.18);
}

.card-btn.color-purple {
  background: #7a4fd8;
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.18);
}

/* 중앙 카드 */
.table-card.color-red {
  background: #d84f5a;
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.2);
}

.table-card.color-yellow {
  background: #f0c94a;
  color: #1f1600;
  border-color: rgba(78, 58, 0, 0.3);
}

.table-card.color-green {
  background: #2f9a6f;
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.2);
}

.table-card.color-blue {
  background: #4f79d8;
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.2);
}

.table-card.color-purple {
  background: #7a4fd8;
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.2);
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
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.38),
    0 4px 10px rgba(93, 71, 34, 0.08);
}

/* 현재 색상 pill */
.color-pill.color-red {
  background: #d84f5a;
  color: #ffffff;
}

.color-pill.color-yellow {
  background: #f0c94a;
  color: #1f1600;
}

.color-pill.color-green {
  background: #2f9a6f;
  color: #ffffff;
}

.color-pill.color-blue {
  background: #4f79d8;
  color: #ffffff;
}

.color-pill.color-purple {
  background: #7a4fd8;
  color: #ffffff;
}

/* 내부 텍스트 가독성 고정 */
.card-btn .card-type,
.table-card .card-type,
.table-card .card-name {
  opacity: 1;
  color: inherit;
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
