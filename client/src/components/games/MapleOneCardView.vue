<template>
  <div class="maple-game">
    <header class="game-topbar">
      <div>
        <p class="eyebrow">플레이 화면</p>
        <h1>메이플 원카드</h1>
      </div>
      <div class="topbar-actions">
        <button class="sound-button" type="button" @click="toggleBgm">
          {{ isBgmEnabled ? '배경음 끄기' : '배경음 켜기' }}
        </button>
        <div class="turn-chip" :class="{ mine: isMyTurn }" role="status">
          <span>현재 턴</span>
          <strong>{{ currentPlayerName }}</strong>
        </div>
      </div>
    </header>

    <div class="game-layout">
      <main class="game-shell">
        <section class="status-strip" aria-label="게임 상태">
          <div class="status-item">
            <p class="status-label">현재 색상</p>
            <p class="status-value color-indicator" :class="`color-${state?.currentColor || 'none'}`">
              {{ colorKoreanName(state?.currentColor) }}
            </p>
          </div>
          <div class="status-item">
            <p class="status-label">누적 공격</p>
            <p class="status-value">{{ state?.pendingAttack ?? 0 }}장</p>
          </div>
          <div class="status-item status-action">
            <p class="status-label">최근 액션</p>
            <p class="status-value">{{ state?.lastAction || '게임을 시작하세요.' }}</p>
          </div>
        </section>

        <section class="board-grid" aria-label="중앙 카드와 플레이어 현황">
          <article class="discard-panel">
            <p class="panel-caption">버린 카드 더미</p>
            <div v-if="topCard" class="game-card top-card" :class="`color-${topCard.color}`">
              <small>{{ cardTypeLabel(topCard) }}</small>
              <b>{{ cardFace(topCard) }}</b>
              <span>{{ formatCard(topCard) }}</span>
            </div>
            <div v-else class="game-card top-card empty-card">
              <small>WAITING</small>
              <b>–</b>
              <span>카드 없음</span>
            </div>
          </article>

          <article class="players-panel">
            <div class="panel-heading">
              <h2>플레이어</h2>
              <span>{{ players.length }}명</span>
            </div>
            <div class="player-list">
              <div
                v-for="player in players"
                :key="player.sessionId"
                class="player-row"
                :class="{
                  current: player.sessionId === state?.currentTurnId,
                  me: player.sessionId === mySessionId,
                  bankrupt: player.bankrupt,
                }"
              >
                <span class="avatar" aria-hidden="true">{{ playerInitial(player.nickname) }}</span>
                <div class="player-copy">
                  <strong>
                    {{ player.nickname }}
                    <span v-if="player.sessionId === mySessionId" class="me-label">나</span>
                  </strong>
                  <small v-if="player.bankrupt">파산</small>
                  <small v-else-if="player.rank">{{ player.rank }}위로 완료</small>
                  <small v-else-if="player.sessionId === state?.currentTurnId">진행 중</small>
                  <small v-else>대기 중</small>
                </div>
                <span class="card-count">{{ player.hand?.length ?? 0 }}장</span>
              </div>
            </div>
          </article>
        </section>

        <section class="hand-panel">
          <div class="panel-heading">
            <h2>내 손패</h2>
            <span>
              {{ myHand.length }}장
              <template v-if="isMyTurn"> · 낼 수 있는 카드 {{ playableCardCount }}장</template>
            </span>
          </div>
          <div v-if="myHand.length" class="hand-scroll">
            <button
              v-for="card in myHand"
              :key="card.id"
              class="game-card hand-card"
              :class="[`color-${card.color}`, { playable: isMyTurn && canPlay(card) }]"
              :disabled="!isMyTurn || !canPlay(card)"
              type="button"
              @click="onClickCard(card)"
            >
              <small>{{ cardTypeLabel(card) }}</small>
              <b>{{ cardFace(card) }}</b>
              <span>{{ formatCard(card) }}</span>
            </button>
          </div>
          <p v-else class="empty-state">아직 받은 카드가 없습니다.</p>
        </section>

        <section class="game-actions" aria-label="게임 동작">
          <button
            v-if="state?.gamePhase === 'waiting' && isHost"
            class="button button-primary"
            :disabled="players.length < 2"
            type="button"
            @click="startGame"
          >
            게임 시작
          </button>
          <p v-else-if="state?.gamePhase === 'waiting'" class="action-note">
            방장이 게임을 시작할 때까지 기다려 주세요. 현재 {{ players.length }}명입니다.
          </p>
          <button
            v-if="state?.gamePhase === 'playing' && isMyTurn"
            class="button button-primary"
            type="button"
            @click="drawCard"
          >
            {{ state?.pendingAttack > 0 ? `${state.pendingAttack}장 받기` : '카드 1장 뽑기' }}
          </button>
          <span v-if="state?.gamePhase === 'playing'" class="action-note">
            {{ isMyTurn ? '같은 색상, 숫자 또는 특수 카드만 낼 수 있습니다.' : '상대의 차례를 기다리고 있습니다.' }}
          </span>
        </section>
      </main>

      <aside class="activity-panel" aria-labelledby="activity-title">
        <div class="panel-heading">
          <h2 id="activity-title">테이블 기록</h2>
          <span>실시간</span>
        </div>
        <div class="activity-log" role="log" aria-live="polite">
          <p v-if="!messages.length" class="empty-activity">아직 기록이 없습니다.</p>
          <p v-for="(msg, index) in messages" :key="index" class="activity-line">
            <strong>{{ msg.clientId }}</strong>
            <span>{{ msg.message }}</span>
          </p>
        </div>
        <p class="rule-note">
          공격이 누적되면 동급 이상의 공격 카드로 대응할 수 있습니다. 색상 선택 카드는 다음 진행 색상을 바꿉니다.
        </p>
      </aside>
    </div>

    <p v-if="bgmError" class="bgm-error" role="alert">{{ bgmError }}</p>

    <div v-if="showColorPicker" class="modal-backdrop" @click.self="cancelColorPicker">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="color-picker-title">
        <p class="eyebrow">색상 선택 카드</p>
        <h2 id="color-picker-title">다음 색상을 선택하세요.</h2>
        <p class="modal-copy">선택한 색상으로 다음 플레이가 이어집니다.</p>
        <div class="color-options">
          <button class="color-option color-red" type="button" @click="submitSelectedCard('red')">빨강</button>
          <button class="color-option color-yellow" type="button" @click="submitSelectedCard('yellow')">노랑</button>
          <button class="color-option color-green" type="button" @click="submitSelectedCard('green')">초록</button>
          <button class="color-option color-blue" type="button" @click="submitSelectedCard('blue')">파랑</button>
        </div>
        <button class="button button-secondary modal-cancel" type="button" @click="cancelColorPicker">
          선택 취소
        </button>
      </section>
    </div>

    <div v-if="state?.gamePhase === 'finished'" class="modal-backdrop">
      <section class="modal result-modal" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <p class="eyebrow">게임 종료</p>
        <h2 id="result-title">최종 순위</h2>
        <ol class="ranking-list">
          <li v-for="sid in state.rankings" :key="sid">{{ getPlayerName(sid) }}</li>
        </ol>
        <button class="button button-primary" type="button" @click="returnToTable">
          멤버 그대로 테이블로 복귀
        </button>
      </section>
    </div>

    <audio ref="audioRef" loop preload="auto" src="/audio/maple-onecard-bgm.mp3" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  gameConnection: { type: Object, required: true },
});
const emit = defineEmits(['move-to-game']);

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
    if (!nextRoom || boundRoomId === nextRoom.roomId) return;

    nextRoom.onStateChange((newState) => {
      state.value = JSON.parse(JSON.stringify(newState));
    });

    nextRoom.onMessage('chat', (data) => {
      messages.value.push(data);
    });

    nextRoom.onMessage('move_room', (data) => {
      emit('move-to-game', data);
    });

    boundRoomId = nextRoom.roomId;
  },
  { immediate: true }
);

const players = computed(() => {
  if (!state.value?.players) return [];
  return Object.values(state.value.players);
});

const myPlayer = computed(() => players.value.find((player) => player.sessionId === mySessionId.value));
const isHost = computed(() => Boolean(myPlayer.value?.isHost));
const myHand = computed(() => myPlayer.value?.hand || []);

const topCard = computed(() => {
  const pile = state.value?.discardPile || [];
  return pile.length ? pile[pile.length - 1] : null;
});

const isMyTurn = computed(() => state.value?.currentTurnId === mySessionId.value);

const currentPlayerName = computed(() => {
  if (!state.value?.currentTurnId) return '-';
  const player = players.value.find((item) => item.sessionId === state.value.currentTurnId);
  return player?.nickname || state.value.currentTurnId;
});

const playableCardCount = computed(() => myHand.value.filter((card) => canPlay(card)).length);

function colorKoreanName(color) {
  const names = { red: '빨강', yellow: '노랑', green: '초록', blue: '파랑', purple: '보라' };
  return names[color] || '없음';
}

function cardTypeLabel(card) {
  if (!card) return 'CARD';
  if (card.type === 'number') return 'NUMBER';
  if (['attack2', 'attack3'].includes(card.type)) return 'ATTACK';
  return card.type.toUpperCase();
}

function cardFace(card) {
  if (!card) return '–';
  if (card.type === 'number') return card.number;
  const faces = {
    attack2: '+2',
    attack3: '+3',
    plus1: '+1',
    oz: '+5',
    jump: 'J',
    reverse: 'R',
    wild: 'W',
    ikart: 'W',
  };
  return faces[card.type] || card.type.slice(0, 2).toUpperCase();
}

function formatCard(card) {
  if (!card) return '카드 없음';
  const color = colorKoreanName(card.color);
  if (card.type === 'number') return `${color} ${card.number}`;
  return `${color} ${cardTypeLabel(card)}`;
}

function playerInitial(nickname) {
  return String(nickname || '?').trim().slice(0, 1);
}

function getPlayerName(sessionId) {
  const player = players.value.find((item) => item.sessionId === sessionId);
  return player?.nickname || sessionId;
}

function canPlay(card) {
  if (!state.value || !isMyTurn.value) return false;

  const top = topCard.value;

  if (state.value.pendingAttack > 0) {
    if (!top) return false;
    if (top.type === 'oz') return ['mihile', 'ikart'].includes(card.type);
    if (['mihile', 'ikart'].includes(card.type)) return true;

    const attackValues = { attack2: 2, attack3: 3, oz: 5 };
    if (!(card.type in attackValues)) return false;
    return attackValues[card.type] >= (attackValues[top.type] || 0);
  }

  if (card.type === 'ikart') return true;
  if (!top) return true;
  if (card.color === state.value.currentColor) return true;

  if (card.type === 'number' && top.type === 'number' && card.number === top.number) return true;

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

  if (specialTypes.includes(card.type) && specialTypes.includes(top.type) && card.type === top.type) {
    return true;
  }

  const attackValues = { attack2: 2, attack3: 3, oz: 5 };
  if (card.type in attackValues && top.type in attackValues) {
    return card.color === state.value.currentColor || attackValues[card.type] === attackValues[top.type];
  }

  return false;
}

function startGame() {
  if (!room.value || !isHost.value || players.value.length < 2) return;
  tryPlayBgm();
  room.value.send('start_game');
}

function returnToTable() {
  if (room.value) room.value.send('return_to_table');
}

function drawCard() {
  if (room.value) room.value.send('draw_card');
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

  cancelColorPicker();
}

function cancelColorPicker() {
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
  bgmError.value = '배경음 파일을 찾을 수 없어요. /client/public/audio/maple-onecard-bgm.mp3 경로를 확인해 주세요.';
}

onMounted(() => {
  const unlockAudio = () => tryPlayBgm();
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });

  if (audioRef.value) audioRef.value.addEventListener('error', onAudioLoadError);
});

onBeforeUnmount(() => {
  if (!audioRef.value) return;
  audioRef.value.pause();
  audioRef.value.removeEventListener('error', onAudioLoadError);
});
</script>

<style scoped>
.maple-game {
  display: grid;
  gap: var(--space-5);
  color: var(--color-ink);
}

.game-topbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
}

.eyebrow {
  margin: 0 0 var(--space-1);
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.game-topbar h1 {
  margin: 0;
  font-size: clamp(30px, 4vw, 48px);
  line-height: 1;
  letter-spacing: -0.035em;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.sound-button,
.button {
  min-height: 44px;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  padding: 0 var(--space-4);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.sound-button,
.button-secondary {
  border-color: var(--color-border);
  background: var(--color-surface);
  color: var(--color-ink-soft);
}

.sound-button:hover,
.button-secondary:hover {
  background: var(--color-surface-muted);
}

.turn-chip {
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-small);
  background: var(--color-surface);
}

.turn-chip.mine {
  border-color: color-mix(in oklab, var(--color-success), var(--color-border) 70%);
  background: color-mix(in oklab, var(--color-success) 7%, white);
}

.turn-chip span {
  color: var(--color-muted);
  font-size: 13px;
}

.turn-chip.mine strong {
  color: color-mix(in oklab, var(--color-success), var(--color-ink) 38%);
}

.game-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: var(--space-4);
  align-items: start;
}

.game-shell {
  min-width: 0;
  display: grid;
  gap: var(--space-4);
}

.status-strip {
  display: grid;
  grid-template-columns: 140px 140px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
}

.status-item {
  min-height: 76px;
  padding: var(--space-3) var(--space-4);
  border-right: 1px solid var(--color-border-soft);
}

.status-item:last-child {
  border-right: 0;
}

.status-label,
.panel-caption {
  margin: 0;
  color: var(--color-muted);
  font-size: 12px;
}

.status-value {
  margin: var(--space-1) 0 0;
  font-weight: 700;
}

.color-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.color-indicator::before {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: currentColor;
  content: '';
}

.board-grid {
  min-height: 330px;
  display: grid;
  grid-template-columns: minmax(250px, 0.7fr) minmax(320px, 1fr);
  gap: var(--space-4);
}

.discard-panel,
.players-panel,
.hand-panel,
.activity-panel {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
}

.discard-panel {
  display: grid;
  place-items: center;
  align-content: center;
  gap: var(--space-3);
  padding: var(--space-6);
  background: color-mix(in oklab, var(--color-surface-muted) 78%, white);
}

.game-card {
  width: 138px;
  aspect-ratio: 2 / 3;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: var(--space-3);
  border: 1px solid currentColor;
  border-radius: var(--radius-panel);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  color: var(--color-ink);
  text-align: left;
  font-weight: 700;
}

.game-card small {
  font-size: 11px;
  letter-spacing: 0.06em;
}

.game-card b {
  align-self: center;
  font-size: 28px;
}

.top-card {
  pointer-events: none;
}

.empty-card {
  border-color: var(--color-border);
  background: var(--color-surface-muted);
  color: var(--color-meta);
  box-shadow: none;
}

.players-panel,
.hand-panel,
.activity-panel {
  padding: var(--space-4);
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.panel-heading h2 {
  margin: 0;
  font-size: 20px;
  letter-spacing: -0.015em;
}

.panel-heading > span {
  color: var(--color-muted);
  font-size: 13px;
}

.player-list {
  display: grid;
  gap: var(--space-1);
}

.player-row {
  min-height: 58px;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border-soft);
}

.player-row:last-child {
  border-bottom: 0;
}

.player-row.current {
  border-radius: var(--radius-small);
  border-bottom-color: transparent;
  background: var(--color-surface-muted);
}

.player-row.bankrupt {
  opacity: 0.55;
}

.avatar {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--color-surface-muted);
  font-size: 13px;
  font-weight: 800;
}

.player-copy {
  min-width: 0;
}

.player-copy strong,
.player-copy small {
  display: block;
}

.player-copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-copy small {
  color: var(--color-muted);
}

.me-label {
  margin-left: 4px;
  color: var(--color-focus);
  font-size: 11px;
}

.card-count {
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 13px;
  font-weight: 700;
}

.hand-panel {
  overflow: hidden;
}

.hand-scroll {
  display: flex;
  gap: var(--space-3);
  overflow-x: auto;
  padding: var(--space-2) var(--space-1) var(--space-3);
  scrollbar-width: thin;
}

.hand-card {
  flex: 0 0 118px;
  cursor: pointer;
  transition:
    translate 150ms cubic-bezier(0.2, 0, 0, 1),
    box-shadow 150ms cubic-bezier(0.2, 0, 0, 1);
}

.hand-card.playable:not(:disabled):hover {
  translate: 0 -6px;
}

.hand-card:disabled {
  cursor: not-allowed;
  filter: grayscale(0.35);
  opacity: 0.44;
  box-shadow: none;
}

.color-red {
  color: var(--color-danger);
  background: color-mix(in oklab, var(--color-danger) 8%, white);
}

.color-yellow {
  color: #a67500;
  background: #fff9e8;
}

.color-green {
  color: #168047;
  background: #f1faf5;
}

.color-blue {
  color: var(--color-primary);
  background: color-mix(in oklab, var(--color-primary) 8%, white);
}

.color-purple {
  color: var(--color-purple);
  background: #f7f5ff;
}

.color-none {
  color: var(--color-meta);
}

.game-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.button-primary {
  background: var(--color-primary);
  color: white;
  box-shadow: var(--shadow-card);
}

.button-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.action-note,
.empty-state,
.empty-activity,
.rule-note,
.modal-copy {
  margin: 0;
  color: var(--color-muted);
  font-size: 14px;
}

.activity-panel {
  position: sticky;
  top: 84px;
}

.activity-log {
  display: grid;
  gap: var(--space-3);
}

.activity-line {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr);
  gap: var(--space-2);
  margin: 0;
  color: var(--color-muted);
  font-size: 14px;
}

.activity-line::before {
  width: 6px;
  height: 6px;
  margin-top: 8px;
  border-radius: 50%;
  background: var(--color-border);
  content: '';
}

.activity-line strong,
.activity-line span {
  grid-column: 2;
}

.activity-line strong {
  color: var(--color-ink-soft);
}

.rule-note {
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border-soft);
  line-height: 1.55;
}

.bgm-error {
  margin: 0;
  color: var(--color-danger);
  font-size: 13px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: rgba(49, 48, 46, 0.42);
  backdrop-filter: blur(6px);
}

.modal {
  width: min(100%, 420px);
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.modal h2 {
  margin: 0;
  font-size: 26px;
}

.modal-copy {
  margin-top: var(--space-2);
}

.color-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
  margin-top: var(--space-5);
}

.color-option {
  min-height: 48px;
  border: 1px solid currentColor;
  border-radius: var(--radius-control);
  font-weight: 700;
  cursor: pointer;
}

.modal-cancel,
.result-modal .button-primary {
  width: 100%;
  margin-top: var(--space-2);
}

.ranking-list {
  margin: var(--space-5) 0;
  padding-left: var(--space-6);
}

.ranking-list li {
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border-soft);
}

@media (max-width: 980px) {
  .game-layout {
    grid-template-columns: 1fr;
  }

  .activity-panel {
    position: static;
  }
}

@media (max-width: 720px) {
  .game-topbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .topbar-actions {
    width: 100%;
    align-items: stretch;
  }

  .sound-button,
  .turn-chip {
    flex: 1;
  }

  .status-strip {
    grid-template-columns: 1fr 1fr;
  }

  .status-item:nth-child(2) {
    border-right: 0;
  }

  .status-action {
    grid-column: 1 / -1;
    border-top: 1px solid var(--color-border-soft);
  }

  .board-grid {
    grid-template-columns: 1fr;
  }

  .discard-panel {
    min-height: 290px;
  }

  .game-actions .button {
    flex: 1 1 160px;
  }
}

@media (max-width: 480px) {
  .topbar-actions {
    flex-direction: column;
  }

  .turn-chip {
    justify-content: space-between;
  }

  .status-strip {
    grid-template-columns: 1fr;
  }

  .status-item,
  .status-item:nth-child(2) {
    border-right: 0;
    border-bottom: 1px solid var(--color-border-soft);
  }

  .status-action {
    grid-column: auto;
    border-top: 0;
    border-bottom: 0;
  }

  .color-options {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hand-card {
    transition: none;
  }
}
</style>
