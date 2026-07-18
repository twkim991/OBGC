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
          <span>{{ turnGuide.label }}</span>
          <strong>{{ turnGuide.title }}</strong>
          <small>{{ turnGuide.description }}</small>
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

          <OneCardPlayerPanel :players="players" :current-turn-id="state?.currentTurnId || ''" :my-session-id="mySessionId" />
        </section>

        <OneCardHandPanel :cards="myHand" :is-my-turn="isMyTurn" :blocked-reason="cardBlockedReason" @select="onClickCard" />

        <section class="game-actions" aria-label="게임 동작">
          <ActionGuard v-if="state?.gamePhase === 'waiting' && isHost" :reason="startBlockedReason" label="게임 시작" block>
            <button
              class="button button-primary"
              :disabled="Boolean(startBlockedReason)"
              type="button"
              @click="startGame"
            >
              게임 시작
            </button>
          </ActionGuard>
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

      <GameActivityPanel
        :messages="messages"
        note="공격이 누적되면 동급 이상의 공격 카드로 대응할 수 있습니다. 색상 선택 카드는 다음 진행 색상을 바꿉니다."
      />
    </div>

    <p v-if="bgmError" class="bgm-error" role="alert">{{ bgmError }}</p>

    <OneCardColorPicker v-if="showColorPicker" @select="submitSelectedCard" @cancel="cancelColorPicker" />
    <OneCardResultModal v-if="state?.gamePhase === 'finished'" :rankings="rankingPlayers" @return="returnToTable" />

    <audio ref="audioRef" loop preload="auto" src="/audio/maple-onecard-bgm.mp3" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { showRoomErrorAlert } from '../../game-alerts';
import ActionGuard from './shared/ActionGuard.vue';
import GameActivityPanel from './shared/GameActivityPanel.vue';
import OneCardColorPicker from './onecard/OneCardColorPicker.vue';
import OneCardHandPanel from './onecard/OneCardHandPanel.vue';
import OneCardPlayerPanel from './onecard/OneCardPlayerPanel.vue';
import OneCardResultModal from './onecard/OneCardResultModal.vue';
import { ONECARD_PROTOCOL } from '../../games/onecard/protocol';
import { toSystemErrorMessage } from '../../games/errors';
import { cardFace, cardTypeLabel, colorKoreanName, formatCard } from '../../games/onecard/presentation';
import { projectOneCardState } from '../../games/onecard/state';

const props = defineProps({
  gameConnection: { type: Object, required: true },
});
const emit = defineEmits(['move-to-game']);

const room = computed(() => props.gameConnection ?? null);
const mySessionId = computed(() => props.gameConnection?.sessionId ?? '');

const state = ref(null);
const privateHand = ref([]);
const pendingCard = ref(null);
const showColorPicker = ref(false);
const messages = ref([]);
const audioRef = ref(null);
const isBgmEnabled = ref(true);
const bgmError = ref('');

let boundRoom = null;

watch(
  room,
  (nextRoom) => {
    if (!nextRoom || boundRoom === nextRoom) return;
    boundRoom = nextRoom;

    const applyPublicState = (newState) => {
      state.value = projectOneCardState(newState);
    };
    nextRoom.onStateChange(applyPublicState);
    if (nextRoom.state) applyPublicState(nextRoom.state);

    nextRoom.onMessage('chat', (data) => {
      messages.value.push(data);
    });

    nextRoom.onMessage(ONECARD_PROTOCOL.messages.privateHand, (data) => {
      privateHand.value = Array.isArray(data?.cards) ? data.cards : [];
    });

    nextRoom.onMessage('room_error', (data) => {
      messages.value.push(toSystemErrorMessage(data));
      void showRoomErrorAlert(data);
    });

    nextRoom.onMessage('move_room', (data) => {
      emit('move-to-game', data);
    });

    nextRoom.send(ONECARD_PROTOCOL.messages.requestPrivateState);

  },
  { immediate: true }
);

const players = computed(() => {
  if (!state.value?.players) return [];
  return Object.values(state.value.players);
});

const myPlayer = computed(() => players.value.find((player) => player.sessionId === mySessionId.value));
const isHost = computed(() => Boolean(myPlayer.value?.isHost));
const myHand = computed(() => privateHand.value);

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

const startBlockedReason = computed(() => players.value.length < 2 ? '플레이어가 2명 이상 모여야 시작할 수 있습니다.' : '');

function cardBlockedReason(card) {
  if (showColorPicker.value) return '먼저 다음 진행 색상을 선택하세요.';
  if (!isMyTurn.value) return `${currentPlayerName.value}님의 차례입니다. 지금은 카드를 낼 수 없습니다.`;
  if (card.playable) return '';
  if ((state.value?.pendingAttack || 0) > 0) {
    if (topCard.value?.type === 'oz') return '오즈 공격은 미하일 또는 이카르트 카드로만 막을 수 있습니다.';
    return `누적 공격 ${state.value.pendingAttack}장을 막으려면 동급 이상의 공격 카드나 방어 카드가 필요합니다.`;
  }
  return `현재 ${colorKoreanName(state.value?.currentColor)} 카드와 색상·숫자·특수 효과가 일치하지 않습니다.`;
}

const turnGuide = computed(() => {
  if (state.value?.gamePhase === 'waiting') {
    return {
      label: '게임 준비',
      title: '게임 시작을 기다리고 있습니다.',
      description: `현재 ${players.value.length}명입니다. 방장이 시작하면 각자 카드를 받습니다.`,
    };
  }
  if (state.value?.gamePhase === 'finished') {
    return {
      label: '게임 종료',
      title: state.value.lastAction || '게임이 끝났습니다.',
      description: '최종 순위를 확인하고 대기실로 돌아갈 수 있습니다.',
    };
  }
  if (!isMyTurn.value) {
    return {
      label: `${currentPlayerName.value}님의 차례`,
      title: '낼 카드를 고르고 있습니다.',
      description: '상대가 낸 카드에 따라 진행 색상과 누적 공격이 달라질 수 있습니다.',
    };
  }
  if (showColorPicker.value) {
    return {
      label: '내 차례 · 색상 선택 단계',
      title: '다음 진행 색상을 선택하세요.',
      description: '색상을 고르면 특수 카드가 공개되고 다음 플레이어는 그 색상을 따라야 합니다.',
    };
  }
  if ((state.value?.pendingAttack || 0) > 0) {
    return {
      label: '내 차례 · 공격 대응 단계',
      title: `공격 카드로 막거나 ${state.value.pendingAttack}장을 받으세요.`,
      description: '대응 가능한 공격 카드를 내면 공격이 다음 플레이어에게 누적됩니다.',
    };
  }
  return {
    label: '내 차례 · 카드 내기 단계',
    title: '낼 카드 한 장을 선택하세요.',
    description: '현재 카드와 색상이나 숫자가 같은 카드를 내세요. 낼 카드가 없다면 한 장을 뽑으세요.',
  };
});

const rankingPlayers = computed(() =>
  (state.value?.rankings || []).map((id) => ({ id, name: getPlayerName(id) }))
);

function getPlayerName(sessionId) {
  const player = players.value.find((item) => item.sessionId === sessionId);
  return player?.nickname || sessionId;
}

function startGame() {
  if (!room.value || !isHost.value || players.value.length < 2) return;
  tryPlayBgm();
  room.value.send(ONECARD_PROTOCOL.messages.startGame);
}

function returnToTable() {
  if (room.value) room.value.send(ONECARD_PROTOCOL.messages.returnToTable);
}

function drawCard() {
  if (room.value) room.value.send(ONECARD_PROTOCOL.messages.drawCard);
}

function onClickCard(card) {
  if (!room.value) return;
  tryPlayBgm();

  if (card.type === 'wild' || card.type === 'irina') {
    pendingCard.value = card;
    showColorPicker.value = true;
    return;
  }

  room.value.send(ONECARD_PROTOCOL.messages.playCard, { cardId: card.id });
}

function submitSelectedCard(color) {
  if (!room.value || !pendingCard.value) return;
  tryPlayBgm();

  room.value.send(ONECARD_PROTOCOL.messages.playCard, {
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
  width: min(360px, 100%);
  min-height: 72px;
  padding: var(--space-3) var(--space-4);
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
  font-size: 10px;
}

.turn-chip strong,
.turn-chip small {
  display: block;
}

.turn-chip strong {
  margin-top: 3px;
  font-size: 13px;
}

.turn-chip small {
  margin-top: 4px;
  color: var(--color-muted);
  font-size: 10px;
  line-height: 1.4;
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

.discard-panel {
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

.action-note {
  margin: 0;
  color: var(--color-muted);
  font-size: 14px;
}

.bgm-error {
  margin: 0;
  color: var(--color-danger);
  font-size: 13px;
}

@media (max-width: 980px) {
  .game-layout {
    grid-template-columns: 1fr;
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
    width: 100%;
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

}
</style>
