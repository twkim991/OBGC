<template>
  <div class="halli-game">
    <header class="game-topbar">
      <div>
        <p class="eyebrow">FRUIT REACTION</p>
        <h1>할리갈리</h1>
        <p>공개된 맨 위 카드에서 같은 과일이 정확히 5개면 누구보다 먼저 종을 누르세요.</p>
      </div>
      <div class="turn-chip" :class="{ mine: isMyTurn }" role="status">
        <span>{{ turnGuide.label }}</span>
        <strong>{{ turnGuide.title }}</strong>
        <small>{{ turnGuide.description }}</small>
      </div>
    </header>

    <section class="status-strip" aria-label="할리갈리 게임 상태">
      <div><span>라운드</span><strong>{{ state?.roundCount || 0 }}</strong></div>
      <div><span>내 카드</span><strong>{{ myPlayer?.deckCount || 0 }}장</strong></div>
      <div><span>공개 더미</span><strong>{{ totalFaceUpCount }}장</strong></div>
      <div class="last-action"><span>최근 액션</span><strong>{{ state?.lastAction || '게임 시작을 기다리고 있습니다.' }}</strong></div>
    </section>

    <section v-if="state?.gamePhase === 'waiting'" class="waiting-panel">
      <div>
        <strong>{{ isHost ? '과일 카드를 나눌 준비가 됐나요?' : '방장이 게임을 시작할 때까지 기다려주세요.' }}</strong>
        <span>현재 {{ connectedPlayerCount }}명 · 2~6명 플레이</span>
      </div>
      <ActionGuard v-if="isHost" :reason="startBlockedReason" label="게임 시작" block><button type="button" :disabled="Boolean(startBlockedReason)" @click="startGame">게임 시작</button></ActionGuard>
    </section>

    <section v-else class="play-grid">
      <article class="table-panel">
        <div class="panel-heading">
          <h2>게임 테이블</h2>
          <span>각 더미의 맨 위 카드만 합산</span>
        </div>
        <div class="table-stage">
          <div class="opponent-grid" :class="`count-${opponents.length}`">
            <section
              v-for="player in opponents"
              :key="player.sessionId"
              class="seat"
              :class="{ current: player.sessionId === state?.currentTurnId, eliminated: player.eliminated }"
            >
              <div class="seat-meta">
                <strong>{{ player.nickname }}</strong>
                <span>{{ player.eliminated ? '탈락' : `${player.deckCount}장` }}</span>
              </div>
              <HalliGalliCard :card="player.topCard" />
              <small>공개 더미 {{ player.faceUpCount }}장</small>
            </section>
          </div>

          <HalliGalliBell
            :ready="Boolean(state?.exactFiveFruit)"
            :disabled="!canRing"
            :blocked-reason="bellBlockedReason"
            :result="bellResult"
            :hint="bellHint"
            @ring="ringBell"
          />

          <section v-if="myPlayer" class="seat my-seat" :class="{ current: isMyTurn, eliminated: myPlayer.eliminated }">
            <div class="seat-meta">
              <strong>{{ myPlayer.nickname }} <i>나</i></strong>
              <span>{{ myPlayer.eliminated ? '탈락' : `${myPlayer.deckCount}장` }}</span>
            </div>
            <HalliGalliCard :card="myPlayer.topCard" />
            <small>공개 더미 {{ myPlayer.faceUpCount }}장</small>
          </section>
        </div>
      </article>

      <aside class="side-stack">
        <section class="side-panel totals-panel" aria-labelledby="fruit-total-title">
          <div class="panel-heading"><h2 id="fruit-total-title">과일 합계</h2><span>맨 위 카드만</span></div>
          <div class="totals">
            <div v-for="fruit in fruits" :key="fruit.id" class="total-row" :class="{ five: fruit.total === 5 }">
              <span><i :class="`swatch-${fruit.id}`"></i>{{ fruit.label }}</span>
              <strong>{{ fruit.total }}</strong>
            </div>
          </div>
        </section>

        <section class="side-panel action-panel" aria-labelledby="halli-action-title">
          <div class="panel-heading"><h2 id="halli-action-title">이번 행동</h2><span>{{ isMyTurn ? '카드 공개' : '반응 대기' }}</span></div>
          <div class="phase-copy" role="status" aria-live="polite">
            <strong>{{ actionCopy.title }}</strong>
            <span>{{ actionCopy.description }}</span>
          </div>
          <ActionGuard :reason="flipBlockedReason" label="카드 공개" block><button type="button" class="reveal-button" :disabled="Boolean(flipBlockedReason)" @click="flipCard">카드 공개</button></ActionGuard>
        </section>

        <GameActivityPanel :messages="messages" title="게임 기록" title-id="halli-activity-title" />
      </aside>
    </section>

    <HalliGalliResultModal v-if="state?.gamePhase === 'finished'" :players="rankingPlayers" @return="returnToTable" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { showRoomErrorAlert } from '../../game-alerts';
import { toSystemErrorMessage } from '../../games/errors';
import { HALLI_GALLI_PROTOCOL } from '../../games/halli-galli/protocol';
import { projectHalliGalliState } from '../../games/halli-galli/state';
import ActionGuard from './shared/ActionGuard.vue';
import GameActivityPanel from './shared/GameActivityPanel.vue';
import HalliGalliBell from './halli-galli/HalliGalliBell.vue';
import HalliGalliCard from './halli-galli/HalliGalliCard.vue';
import HalliGalliResultModal from './halli-galli/HalliGalliResultModal.vue';

const props = defineProps({ gameConnection: { type: Object, required: true } });
const emit = defineEmits(['move-to-game']);
const room = computed(() => props.gameConnection ?? null);
const mySessionId = computed(() => props.gameConnection?.sessionId ?? '');
const state = ref(null);
const messages = ref([]);
const actionPending = ref(false);
let boundRoom = null;

watch(room, (nextRoom) => {
  if (!nextRoom || boundRoom === nextRoom) return;
  boundRoom = nextRoom;
  const applyState = (nextState) => {
    state.value = projectHalliGalliState(nextState);
    actionPending.value = false;
  };
  nextRoom.onStateChange(applyState);
  if (nextRoom.state) applyState(nextRoom.state);
  nextRoom.onMessage('chat', (data) => messages.value.push(data));
  nextRoom.onMessage('room_error', (data) => {
    actionPending.value = false;
    messages.value.push(toSystemErrorMessage(data));
    void showRoomErrorAlert(data);
  });
  nextRoom.onMessage('move_room', (data) => emit('move-to-game', data));
}, { immediate: true });

const players = computed(() => Object.values(state.value?.players || {}));
const connectedPlayerCount = computed(() => players.value.filter((player) => player.connected).length);
const myPlayer = computed(() => players.value.find((player) => player.sessionId === mySessionId.value));
const opponents = computed(() => players.value.filter((player) => player.sessionId !== mySessionId.value));
const isHost = computed(() => Boolean(myPlayer.value?.isHost));
const isMyTurn = computed(() => state.value?.gamePhase === 'playing' && state.value?.currentTurnId === mySessionId.value);
const canFlip = computed(() => isMyTurn.value && !myPlayer.value?.eliminated && (myPlayer.value?.deckCount || 0) > 0);
const canRing = computed(() => state.value?.gamePhase === 'playing' && !state.value?.bellLocked && !myPlayer.value?.eliminated && !actionPending.value);
const currentPlayer = computed(() => players.value.find((player) => player.sessionId === state.value?.currentTurnId));
const totalFaceUpCount = computed(() => players.value.reduce((sum, player) => sum + (player.faceUpCount || 0), 0));
const startBlockedReason = computed(() => connectedPlayerCount.value < 2 ? '플레이어가 2명 이상 모여야 시작할 수 있습니다.' : '');
const flipBlockedReason = computed(() => {
  if (state.value?.gamePhase !== 'playing') return '게임이 진행 중일 때만 카드를 공개할 수 있습니다.';
  if (myPlayer.value?.eliminated) return '이번 게임에서 탈락하여 카드를 공개할 수 없습니다.';
  if (!isMyTurn.value) return `${currentPlayer.value?.nickname || '다른 플레이어'}님의 카드 공개 차례입니다.`;
  if (!(myPlayer.value?.deckCount || 0)) return '공개할 카드가 남아 있지 않습니다.';
  if (actionPending.value) return '직전 행동을 처리하고 있습니다. 잠시 기다려주세요.';
  return '';
});
const bellBlockedReason = computed(() => {
  if (state.value?.gamePhase === 'finished') return '게임이 종료되어 종을 누를 수 없습니다.';
  if (state.value?.gamePhase !== 'playing') return '게임이 시작된 뒤 종을 누를 수 있습니다.';
  if (myPlayer.value?.eliminated) return '이번 게임에서 탈락하여 종을 누를 수 없습니다.';
  if (state.value?.bellLocked || actionPending.value) return '직전 종 판정을 처리하고 있습니다. 잠시 기다려주세요.';
  return '';
});

const fruitMeta = [
  { id: 'strawberry', label: '딸기' },
  { id: 'banana', label: '바나나' },
  { id: 'lime', label: '라임' },
  { id: 'plum', label: '자두' },
];
const fruits = computed(() => fruitMeta.map((fruit) => ({
  ...fruit,
  total: players.value.reduce((sum, player) => player.topCard?.fruit === fruit.id ? sum + player.topCard.count : sum, 0),
})));
const exactFruitLabel = computed(() => fruitMeta.find((fruit) => fruit.id === state.value?.exactFiveFruit)?.label || '');
const bellResult = computed(() => state.value?.lastBellResult || '');
const bellHint = computed(() => {
  if (state.value?.gamePhase === 'finished') return '게임이 종료되었습니다.';
  if (state.value?.exactFiveFruit) return `${exactFruitLabel.value} 정확히 5개 · 먼저 누르세요.`;
  if (state.value?.lastBellResult === 'wrong') return '정확히 5개가 아니었습니다.';
  return '정확히 5개가 아니라면 오답 페널티를 받습니다.';
});
const turnGuide = computed(() => {
  if (state.value?.gamePhase === 'waiting') {
    return {
      label: '게임 준비',
      title: '게임 시작을 기다리고 있습니다.',
      description: `현재 ${connectedPlayerCount.value}명입니다. 시작하면 각자 과일 카드 더미를 받습니다.`,
    };
  }
  if (state.value?.gamePhase === 'finished') {
    return {
      label: '게임 종료',
      title: state.value.lastAction || '종 대결이 끝났습니다.',
      description: '최종 카드 수와 순위를 확인하고 대기실로 돌아갈 수 있습니다.',
    };
  }
  if (myPlayer.value?.eliminated) {
    return {
      label: '관전 중',
      title: '이번 게임에서 탈락했습니다.',
      description: '남은 플레이어가 카드를 공개하고 종을 누르는 과정을 지켜볼 수 있습니다.',
    };
  }
  if (state.value?.exactFiveFruit) {
    return {
      label: `${state.value?.finalRound ? '최종 라운드 · ' : ''}종을 칠 기회`,
      title: `${exactFruitLabel.value} 합계가 정확히 5개입니다.`,
      description: '누구의 차례인지와 관계없이 중앙 종을 먼저 누르세요.',
    };
  }
  if (isMyTurn.value) {
    return {
      label: `${state.value?.finalRound ? '최종 라운드 · ' : ''}내 차례 · 카드 공개 단계`,
      title: '카드 한 장을 공개하세요.',
      description: '카드를 공개한 직후 같은 과일의 합이 정확히 5개인지 확인하세요.',
    };
  }
  return {
    label: `${state.value?.finalRound ? '최종 라운드 · ' : ''}${currentPlayer.value?.nickname || '플레이어'}님의 차례`,
    title: '공개될 카드를 지켜보세요.',
    description: '차례와 관계없이 같은 과일이 정확히 5개가 되는 순간 종을 누를 수 있습니다.',
  };
});
const actionCopy = computed(() => {
  if (state.value?.gamePhase === 'finished') return { title: '게임이 종료되었습니다.', description: '최종 카드 수와 순위를 확인하세요.' };
  if (myPlayer.value?.eliminated) return { title: '이번 게임에서 탈락했습니다.', description: '남은 플레이어의 종 대결을 관전할 수 있습니다.' };
  if (isMyTurn.value) return { title: '내 카드 한 장을 공개하세요.', description: '공개 직후 과일 합계를 확인하고, 정확히 5개면 중앙 종을 누르세요.' };
  return { title: '상대가 카드를 공개할 차례입니다.', description: '종은 차례와 관계없이 모든 플레이어가 언제든 먼저 누를 수 있습니다.' };
});
const rankingPlayers = computed(() => (state.value?.rankings || []).map((sessionId, index) => {
  const player = players.value.find((candidate) => candidate.sessionId === sessionId);
  return {
    ...player,
    sessionId,
    nickname: player?.nickname || sessionId,
    rank: player?.rank || index + 1,
    totalCount: (player?.deckCount || 0) + (player?.faceUpCount || 0),
  };
}));

watch(() => state.value?.lastBellResult, (result, previous) => {
  if (result === 'wrong' && result !== previous) playBellSound(false);
});

function startGame() {
  if (room.value && isHost.value && connectedPlayerCount.value >= 2) room.value.send(HALLI_GALLI_PROTOCOL.messages.startGame);
}

function flipCard() {
  if (!room.value || !canFlip.value) return;
  actionPending.value = true;
  room.value.send(HALLI_GALLI_PROTOCOL.messages.flipCard, { boardRevision: state.value.boardRevision });
}

function ringBell() {
  if (!room.value || !canRing.value) return;
  actionPending.value = true;
  playBellSound(true);
  room.value.send(HALLI_GALLI_PROTOCOL.messages.ringBell, { boardRevision: state.value.boardRevision });
}

function returnToTable() {
  room.value?.send(HALLI_GALLI_PROTOCOL.messages.returnToTable);
}

function playBellSound(bright) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(bright ? 880 : 220, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(bright ? 520 : 120, context.currentTime + .16);
  gain.gain.setValueAtTime(.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(.18, context.currentTime + .008);
  gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .24);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + .25);
  oscillator.addEventListener('ended', () => context.close());
}
</script>

<style scoped>
.halli-game { display: grid; gap: var(--space-5); color: var(--color-ink); }
.game-topbar { display: flex; align-items: end; justify-content: space-between; gap: var(--space-4); }
.eyebrow { margin: 0 0 4px; color: var(--color-muted); font-size: 11px; font-weight: 800; letter-spacing: .12em; }
.game-topbar h1 { margin: 0; font-size: clamp(34px,5vw,52px); line-height: 1; letter-spacing: -.045em; }
.game-topbar > div > p:last-child { margin: 10px 0 0; color: var(--color-muted); font-size: 14px; }
.turn-chip { width: min(360px,100%); min-width: 300px; padding: 11px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-small); background: white; }
.turn-chip span,.turn-chip strong,.turn-chip small { display: block; }
.turn-chip span { color: var(--color-muted); font-size: 10px; }
.turn-chip strong { margin-top: 3px; font-size: 13px; }
.turn-chip small { margin-top: 4px; color: var(--color-muted); font-size: 10px; line-height: 1.4; }
.turn-chip.mine { border-color: color-mix(in srgb,#dd7900 36%,var(--color-border)); background: color-mix(in srgb,#dd7900 7%,white); }
.status-strip { display: grid; grid-template-columns: 100px 110px 110px minmax(0,1fr); overflow: hidden; border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: white; }
.status-strip > div { min-height: 68px; padding: 13px 15px; border-right: 1px solid var(--color-border-soft); }
.status-strip > div:last-child { border: 0; }
.status-strip span, .status-strip strong { display: block; }
.status-strip span { color: var(--color-muted); font-size: 11px; }
.status-strip strong { margin-top: 5px; font-size: 14px; }
.last-action strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.waiting-panel { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px; border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: white; }
.waiting-panel strong, .waiting-panel span { display: block; }
.waiting-panel span { margin-top: 4px; color: var(--color-muted); font-size: 12px; }
.waiting-panel button, .reveal-button { min-height: 46px; padding: 0 18px; border: 0; border-radius: var(--radius-control); background: var(--color-primary); color: white; cursor: pointer; font-weight: 800; }
button:disabled { cursor: not-allowed; opacity: .42; }
.play-grid { display: grid; grid-template-columns: minmax(0,1fr) 340px; align-items: start; gap: var(--space-4); }
.table-panel, .side-panel { border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: white; }
.table-panel { min-width: 0; padding: 16px; }
.panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.panel-heading h2 { margin: 0; font-size: 18px; }
.panel-heading span { color: var(--color-muted); font-size: 12px; }
.table-stage { min-height: 680px; margin-top: 12px; padding: 20px; display: grid; grid-template-rows: minmax(190px,auto) 1fr minmax(190px,auto); align-items: center; gap: 18px; border-radius: var(--radius-small); background: var(--color-surface-muted); }
.opponent-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(132px,1fr)); align-items: start; justify-items: center; gap: 16px; }
.seat { min-width: 128px; display: grid; justify-items: center; gap: 7px; opacity: .82; }
.seat.current { opacity: 1; }
.seat.eliminated { filter: grayscale(1); opacity: .4; }
.seat-meta { min-width: 126px; display: flex; justify-content: space-between; gap: 8px; }
.seat-meta strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.seat-meta span, .seat > small { color: var(--color-muted); font: 600 10px/1.2 ui-monospace, monospace; }
.seat-meta i { padding: 2px 5px; border-radius: 999px; background: #31302e; color: white; font-size: 8px; font-style: normal; }
.my-seat { justify-self: center; opacity: 1; }
.side-stack { min-width: 0; display: grid; gap: var(--space-4); }
.side-panel { padding: 16px; }
.totals { display: grid; margin-top: 10px; }
.total-row { min-height: 44px; display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px; padding: 8px 10px; border-bottom: 1px solid var(--color-border-soft); }
.total-row:last-child { border-bottom: 0; }
.total-row.five { border-radius: 4px; border-bottom-color: transparent; background: color-mix(in srgb,var(--color-success) 9%,white); }
.total-row > span { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; }
.total-row i { width: 11px; height: 11px; border-radius: 50%; background: #dc2626; }
.total-row i.swatch-banana { background: #dd7900; } .total-row i.swatch-lime { background: #1aae39; } .total-row i.swatch-plum { background: #3972c9; }
.total-row strong { font: 800 18px/1 ui-monospace, monospace; }
.phase-copy { margin-top: 12px; padding: 12px; border-radius: var(--radius-small); background: var(--color-surface-muted); }
.phase-copy strong, .phase-copy span { display: block; }
.phase-copy span { margin-top: 4px; color: var(--color-muted); font-size: 12px; }
.reveal-button { width: 100%; margin-top: 12px; }
@media (max-width: 1080px) { .play-grid { grid-template-columns: 1fr; } .side-stack { grid-template-columns: 1fr 1fr; } .side-stack > :last-child { grid-column: 1 / -1; } }
@media (max-width: 760px) {
  .game-topbar { align-items: flex-start; flex-direction: column; }
  .turn-chip { width: 100%; min-width: 0; }
  .status-strip { grid-template-columns: 1fr 1fr; }
  .status-strip > div:nth-child(2) { border-right: 0; }
  .status-strip > div:nth-child(-n+2) { border-bottom: 1px solid var(--color-border-soft); }
  .table-stage { min-height: 620px; padding: 14px; }
  .side-stack { grid-template-columns: 1fr; }
  .side-stack > :last-child { grid-column: auto; }
}
@media (max-width: 520px) { .opponent-grid { grid-template-columns: repeat(2,minmax(100px,1fr)); } .table-stage { min-height: 570px; } .table-panel { padding: 12px; } }
</style>
