<template>
  <div class="davinci-game">
    <header class="game-topbar">
      <div>
        <p class="eyebrow">SECRET CODE</p>
        <h1>다빈치 코드</h1>
        <p>공개된 단서와 오름차순 배열을 기억해 상대의 숨은 숫자를 추리하세요.</p>
      </div>
      <div class="turn-chip" :class="{ mine: isMyTurn }" role="status">
        <span>{{ phaseSummary.label }}</span>
        <strong>{{ phaseSummary.title }}</strong>
        <small>{{ phaseSummary.description }}</small>
      </div>
    </header>

    <section class="status-strip" aria-label="다빈치 코드 게임 상태">
      <div><span>남은 흰색</span><strong>{{ state?.lightPoolCount ?? 0 }}개</strong></div>
      <div><span>남은 검정</span><strong>{{ state?.darkPoolCount ?? 0 }}개</strong></div>
      <div><span>턴</span><strong>{{ state?.turnCount ?? 0 }}</strong></div>
      <div class="last-action"><span>최근 액션</span><strong>{{ state?.lastAction || '게임 시작을 기다리고 있습니다.' }}</strong></div>
    </section>

    <section v-if="state?.gamePhase === 'waiting'" class="waiting-panel">
      <div>
        <strong>{{ isHost ? '암호 대결을 시작할 준비가 됐나요?' : '방장이 게임을 시작할 때까지 기다려주세요.' }}</strong>
        <span>현재 {{ connectedPlayerCount }}명 · 2~4명 플레이</span>
      </div>
      <button v-if="isHost" type="button" :disabled="connectedPlayerCount < 2" @click="startGame">
        게임 시작
      </button>
    </section>

    <section v-else-if="state?.gamePhase === 'setup'" class="setup-panel">
      <div class="setup-copy">
        <p class="eyebrow">CODE SETUP</p>
        <h2>{{ myPlayer?.setupComplete ? '다른 플레이어를 기다리는 중' : '시작 타일 색상을 고르세요.' }}</h2>
        <p v-if="!myPlayer?.setupComplete">
          {{ initialCodeSize }}개의 색상을 순서와 관계없이 선택하면 서버가 해당 색상의 숫자 타일을 무작위로 배분합니다.
        </p>
        <p v-else>내 코드는 준비됐습니다. 모든 참가자가 선택을 마치면 첫 턴이 시작됩니다.</p>
      </div>
      <template v-if="!myPlayer?.setupComplete">
        <div class="setup-selection" aria-live="polite">
          <span
            v-for="(color, index) in initialColors"
            :key="index"
            class="setup-token"
            :class="`token-${color}`"
          >
            {{ color === 'dark' ? '검정' : '흰색' }}
          </span>
          <span v-for="index in initialCodeSize - initialColors.length" :key="`empty-${index}`" class="setup-token empty">선택</span>
        </div>
        <div class="setup-actions">
          <button type="button" class="color-choice light" :disabled="initialColors.length >= initialCodeSize" @click="addInitialColor('light')">흰색 추가</button>
          <button type="button" class="color-choice dark" :disabled="initialColors.length >= initialCodeSize" @click="addInitialColor('dark')">검정 추가</button>
          <button type="button" class="secondary" :disabled="!initialColors.length" @click="initialColors = []">초기화</button>
          <button type="button" class="primary" :disabled="initialColors.length !== initialCodeSize || actionPending" @click="submitInitialColors">코드 확정</button>
        </div>
      </template>
      <div v-else class="setup-progress">
        <span v-for="player in players" :key="player.sessionId" :class="{ ready: player.setupComplete }">
          {{ player.nickname }} · {{ player.setupComplete ? '준비 완료' : '선택 중' }}
        </span>
      </div>
    </section>

    <section v-else class="game-grid">
      <article class="code-table">
        <div class="opponents">
          <DavinciCodeRow
            v-for="player in opponents"
            :key="player.sessionId"
            :player="player"
            :tiles="player.code"
            :selectable="canSelectOpponent && !player.eliminated"
            :selected-tile-id="selectedTarget?.playerId === player.sessionId ? selectedTarget.tileId : ''"
            @select="selectTarget"
          />
        </div>
        <DavinciCodeRow
          v-if="myPlayer"
          :player="myPlayer"
          :tiles="ownTiles"
          own
        />
      </article>

      <aside class="side-stack">
        <section class="action-panel" aria-labelledby="davinci-action-title">
          <div class="panel-heading">
            <h2 id="davinci-action-title">이번 턴 행동</h2>
            <span>{{ actionStepLabel }}</span>
          </div>
          <div class="phase-copy" role="status" aria-live="polite">
            <strong>{{ actionCopy.title }}</strong>
            <span>{{ actionCopy.description }}</span>
          </div>

          <div v-if="canDraw" class="draw-pool">
            <button type="button" class="draw-btn light" :disabled="!state.lightPoolCount || actionPending" @click="drawTile('light')">
              흰색 타일<span>남은 타일 {{ state.lightPoolCount }}개</span>
            </button>
            <button type="button" class="draw-btn dark" :disabled="!state.darkPoolCount || actionPending" @click="drawTile('dark')">
              검정 타일<span>남은 타일 {{ state.darkPoolCount }}개</span>
            </button>
          </div>

          <div v-if="privateCode.pendingDraw" class="clue-wrap">
            <DavinciTile :tile="{ ...privateCode.pendingDraw, revealed: false }" own :position="0" />
            <div>
              <strong>이번 턴 단서 타일</strong>
              <span>상대에게는 색상만 보입니다.</span>
            </div>
          </div>

          <form v-if="showGuessForm" class="guess-form" @submit.prevent="submitGuess">
            <p>
              <strong>선택한 타일</strong>
              <span>{{ selectedTargetLabel }}</span>
            </p>
            <label>
              예상 숫자
              <select v-model="guessNumber" aria-label="예상 숫자">
                <option value="">숫자 선택</option>
                <option v-for="number in 12" :key="number - 1" :value="String(number - 1)">{{ number - 1 }}</option>
              </select>
            </label>
            <button type="submit" class="primary" :disabled="!selectedTarget || guessNumber === '' || actionPending">이 숫자로 추리</button>
          </form>

          <div v-if="showDecision" class="decision-actions">
            <button type="button" class="primary" @click="continueGuessing">추리 계속</button>
            <button type="button" class="secondary" :disabled="actionPending" @click="stopGuessing">턴 종료</button>
          </div>
        </section>

        <section class="rule-panel" aria-labelledby="davinci-rule-title">
          <div class="panel-heading">
            <h2 id="davinci-rule-title">추리 원칙</h2>
            <span>메모 없음</span>
          </div>
          <p>공개된 타일과 배열 순서를 기억해 판단하세요.</p>
          <ul>
            <li>숫자는 왼쪽에서 오른쪽으로 커집니다.</li>
            <li>같은 숫자는 검정 타일이 먼저 옵니다.</li>
            <li>정답이면 계속 추리하거나 턴을 끝낼 수 있습니다.</li>
            <li>오답이면 이번 턴에 뽑은 타일이 공개됩니다.</li>
          </ul>
        </section>

        <GameActivityPanel
          :messages="messages"
          title="게임 기록"
          title-id="davinci-activity-title"
        />
      </aside>
    </section>

    <DavinciResultModal
      v-if="state?.gamePhase === 'finished'"
      :players="rankingPlayers"
      @return="returnToTable"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { toSystemErrorMessage } from '../../games/errors';
import { DAVINCI_CODE_PROTOCOL } from '../../games/davinci-code/protocol';
import { projectDavinciCodeState } from '../../games/davinci-code/state';
import DavinciCodeRow from './davinci-code/DavinciCodeRow.vue';
import DavinciResultModal from './davinci-code/DavinciResultModal.vue';
import DavinciTile from './davinci-code/DavinciTile.vue';
import GameActivityPanel from './shared/GameActivityPanel.vue';

const props = defineProps({ gameConnection: { type: Object, required: true } });
const emit = defineEmits(['move-to-game']);

const room = computed(() => props.gameConnection ?? null);
const mySessionId = computed(() => props.gameConnection?.sessionId ?? '');
const state = ref(null);
const privateCode = ref({ revision: 0, tiles: [], pendingDraw: null });
const messages = ref([]);
const actionPending = ref(false);
const initialColors = ref([]);
const selectedTarget = ref(null);
const guessNumber = ref('');
const continuingGuess = ref(false);
let boundRoom = null;

watch(
  room,
  (nextRoom) => {
    if (!nextRoom || boundRoom === nextRoom) return;
    boundRoom = nextRoom;
    const applyState = (nextState) => {
      state.value = projectDavinciCodeState(nextState);
      actionPending.value = false;
    };
    nextRoom.onStateChange(applyState);
    if (nextRoom.state) applyState(nextRoom.state);
    nextRoom.onMessage('chat', (data) => messages.value.push(data));
    nextRoom.onMessage(DAVINCI_CODE_PROTOCOL.messages.privateCode, (data) => {
      actionPending.value = false;
      privateCode.value = {
        revision: Number.isInteger(data?.revision) ? data.revision : 0,
        tiles: Array.isArray(data?.tiles) ? data.tiles : [],
        pendingDraw: data?.pendingDraw || null,
      };
    });
    nextRoom.onMessage('room_error', (data) => {
      actionPending.value = false;
      messages.value.push(toSystemErrorMessage(data));
    });
    nextRoom.onMessage('move_room', (data) => emit('move-to-game', data));
    nextRoom.send(DAVINCI_CODE_PROTOCOL.messages.requestPrivateState);
  },
  { immediate: true }
);

const players = computed(() => Object.values(state.value?.players || {}));
const connectedPlayerCount = computed(() => players.value.filter((player) => player.connected).length);
const myPlayer = computed(() => players.value.find((player) => player.sessionId === mySessionId.value));
const opponents = computed(() => players.value.filter((player) => player.sessionId !== mySessionId.value));
const isHost = computed(() => Boolean(myPlayer.value?.isHost));
const isMyTurn = computed(() => state.value?.gamePhase === 'playing' && state.value?.currentTurnId === mySessionId.value);
const initialCodeSize = computed(() => (players.value.length === 4 ? 3 : 4));
const ownTiles = computed(() => privateCode.value.tiles);
const canDraw = computed(() => isMyTurn.value && state.value?.turnPhase === 'draw');
const showDecision = computed(() => isMyTurn.value && state.value?.turnPhase === 'decision' && !continuingGuess.value);
const showGuessForm = computed(
  () =>
    isMyTurn.value &&
    (state.value?.turnPhase === 'guess' ||
      (state.value?.turnPhase === 'decision' && continuingGuess.value))
);
const canSelectOpponent = computed(() => showGuessForm.value && !actionPending.value);

const currentPlayer = computed(() => players.value.find((player) => player.sessionId === state.value?.currentTurnId));
const phaseSummary = computed(() => {
  if (state.value?.gamePhase === 'waiting') {
    return {
      label: '게임 준비',
      title: '게임 시작을 기다리고 있습니다.',
      description: `현재 ${players.value.length}명입니다. 방장이 시작하면 각자 비밀 코드를 만듭니다.`,
    };
  }
  if (state.value?.gamePhase === 'setup') {
    if (myPlayer.value?.setupComplete) {
      return {
        label: '시작 코드 준비',
        title: '내 시작 코드가 준비되었습니다.',
        description: `현재 ${players.value.filter((player) => player.setupComplete).length} / ${players.value.length}명이 준비를 마쳤습니다.`,
      };
    }
    return {
      label: '시작 코드 준비',
      title: `시작할 타일의 색상을 ${initialCodeSize.value}개 선택하세요.`,
      description: '선택한 타일은 숫자순으로 정렬되어 나만 볼 수 있는 시작 코드가 됩니다.',
    };
  }
  if (state.value?.gamePhase === 'finished') {
    return {
      label: '게임 종료',
      title: state.value.lastAction || '암호 대결이 끝났습니다.',
      description: '최종 순위를 확인하고 대기실로 돌아갈 수 있습니다.',
    };
  }
  const playerName = currentPlayer.value?.nickname || '플레이어';
  if (!isMyTurn.value) {
    return {
      label: `${playerName}님의 차례`,
      title: state.value?.turnPhase === 'draw' ? '새 타일을 고르고 있습니다.' : '숨은 숫자를 추리하고 있습니다.',
      description: '공개되는 타일과 코드의 정렬 위치를 주의 깊게 살펴보세요.',
    };
  }
  if (state.value?.turnPhase === 'draw') {
    return {
      label: '내 차례 · 타일 뽑기 단계',
      title: '검정 또는 흰색 타일을 뽑으세요.',
      description: '뽑은 타일을 확인한 뒤 상대의 숨은 숫자를 추리하게 됩니다.',
    };
  }
  if (state.value?.turnPhase === 'decision' && !continuingGuess.value) {
    return {
      label: '내 차례 · 계속 여부 선택 단계',
      title: '계속 추리할지 결정하세요.',
      description: '지금 멈추면 새 타일을 숨긴 채 넣습니다. 계속하다 틀리면 새 타일이 공개됩니다.',
    };
  }
  return {
    label: '내 차례 · 숫자 추리 단계',
    title: '상대의 숨은 타일을 추리하세요.',
    description: '맞히면 해당 타일이 공개되고 계속 추리할 수 있습니다. 틀리면 턴이 끝납니다.',
  };
});

const actionStepLabel = computed(() => {
  if (!isMyTurn.value) return '상대 턴';
  if (state.value?.turnPhase === 'draw') return '1 / 2';
  if (state.value?.turnPhase === 'decision' && !continuingGuess.value) return '정답';
  return '2 / 2';
});

const actionCopy = computed(() => {
  if (!isMyTurn.value) return { title: '상대 차례를 기다리는 중입니다.', description: '공개되는 코드와 새 타일의 위치를 주의 깊게 보세요.' };
  if (state.value?.turnPhase === 'draw') return { title: '단서 타일을 뽑으세요.', description: '흰색 또는 검정 타일 더미 중 하나를 선택합니다.' };
  if (state.value?.turnPhase === 'decision' && !continuingGuess.value) return { title: '추리가 맞았습니다.', description: '계속 추리하면 위험도 커집니다. 지금 멈출 수도 있어요.' };
  return { title: '상대의 숨은 타일을 추리하세요.', description: '타일 하나를 지목하고 예상 숫자를 고르세요.' };
});

const selectedTargetLabel = computed(() => {
  if (!selectedTarget.value) return '상대 타일을 선택하세요.';
  const player = players.value.find((candidate) => candidate.sessionId === selectedTarget.value.playerId);
  return `${player?.nickname || '상대'} · ${selectedTarget.value.index + 1}번째 타일`;
});

const rankingPlayers = computed(() =>
  (state.value?.rankings || []).map((sessionId, index) => {
    const player = players.value.find((candidate) => candidate.sessionId === sessionId);
    return { ...player, sessionId, nickname: player?.nickname || sessionId, rank: player?.rank || index + 1 };
  })
);

watch(
  () => state.value?.turnRevision,
  () => {
    selectedTarget.value = null;
    guessNumber.value = '';
    continuingGuess.value = false;
  }
);

function startGame() {
  if (room.value && isHost.value && connectedPlayerCount.value >= 2) {
    room.value.send(DAVINCI_CODE_PROTOCOL.messages.startGame);
  }
}

function addInitialColor(color) {
  if (initialColors.value.length < initialCodeSize.value) initialColors.value.push(color);
}

function submitInitialColors() {
  if (!room.value || initialColors.value.length !== initialCodeSize.value) return;
  actionPending.value = true;
  room.value.send(DAVINCI_CODE_PROTOCOL.messages.chooseInitialColors, { colors: [...initialColors.value] });
}

function drawTile(color) {
  if (!room.value || !canDraw.value) return;
  actionPending.value = true;
  room.value.send(DAVINCI_CODE_PROTOCOL.messages.drawTile, {
    color,
    turnRevision: state.value.turnRevision,
  });
}

function selectTarget(target) {
  if (!canSelectOpponent.value) return;
  selectedTarget.value = target;
}

function submitGuess() {
  if (!room.value || !selectedTarget.value || guessNumber.value === '') return;
  actionPending.value = true;
  room.value.send(DAVINCI_CODE_PROTOCOL.messages.guessTile, {
    targetSessionId: selectedTarget.value.playerId,
    tileId: selectedTarget.value.tileId,
    guessedNumber: Number(guessNumber.value),
    turnRevision: state.value.turnRevision,
  });
}

function continueGuessing() {
  continuingGuess.value = true;
  selectedTarget.value = null;
  guessNumber.value = '';
}

function stopGuessing() {
  if (!room.value || !showDecision.value) return;
  actionPending.value = true;
  room.value.send(DAVINCI_CODE_PROTOCOL.messages.stopGuessing, {
    turnRevision: state.value.turnRevision,
  });
}

function returnToTable() {
  room.value?.send(DAVINCI_CODE_PROTOCOL.messages.returnToTable);
}
</script>

<style scoped>
.davinci-game { display: grid; gap: var(--space-5); color: var(--color-ink); }
.game-topbar { display: flex; align-items: end; justify-content: space-between; gap: var(--space-4); }
.eyebrow { margin: 0 0 4px; color: var(--color-muted); font-size: 11px; font-weight: 800; letter-spacing: .12em; }
.game-topbar h1 { margin: 0; font-size: clamp(34px,5vw,52px); line-height: 1; letter-spacing: -.045em; }
.game-topbar > div > p:last-child { margin: 10px 0 0; color: var(--color-muted); font-size: 14px; }
.turn-chip { width: min(360px,100%); min-width: 300px; padding: 11px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-small); background: white; }
.turn-chip span,.turn-chip strong,.turn-chip small { display: block; }
.turn-chip span { color: var(--color-muted); font-size: 10px; }
.turn-chip strong { margin-top: 3px; font-size: 13px; }
.turn-chip small { margin-top: 4px; color: var(--color-muted); font-size: 10px; line-height: 1.4; }
.turn-chip.mine { border-color: color-mix(in srgb,var(--color-primary) 34%,var(--color-border)); background: color-mix(in srgb,var(--color-primary) 6%,white); }
.status-strip { display: grid; grid-template-columns: 110px 110px 90px minmax(0,1fr); border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: white; overflow: hidden; }
.status-strip > div { min-height: 68px; padding: 13px 15px; border-right: 1px solid var(--color-border-soft); }
.status-strip > div:last-child { border: 0; }
.status-strip span, .status-strip strong { display: block; }
.status-strip span { color: var(--color-muted); font-size: 11px; }
.status-strip strong { margin-top: 5px; font-size: 14px; }
.last-action strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.waiting-panel { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px; border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: white; }
.waiting-panel strong, .waiting-panel span { display: block; }
.waiting-panel span { margin-top: 4px; color: var(--color-muted); font-size: 12px; }
.waiting-panel button, .primary { min-height: 44px; padding: 0 18px; border: 0; border-radius: var(--radius-control); background: var(--color-primary); color: white; cursor: pointer; font-weight: 700; }
.waiting-panel button:disabled, button:disabled { cursor: not-allowed; opacity: .42; }
.setup-panel { display: grid; gap: 20px; padding: 24px; border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: white; }
.setup-copy h2 { margin: 0; font-size: 24px; }
.setup-copy > p:last-child { margin: 8px 0 0; color: var(--color-muted); }
.setup-selection { display: flex; flex-wrap: wrap; gap: 8px; }
.setup-token { min-width: 64px; min-height: 86px; display: grid; place-items: center; border: 1px solid #31302e; border-radius: 4px; background: white; font-size: 12px; font-weight: 700; }
.setup-token.token-dark { background: #31302e; color: white; }
.setup-token.empty { border-style: dashed; border-color: var(--color-border); color: var(--color-meta); }
.setup-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.color-choice, .secondary { min-height: 44px; padding: 0 14px; border: 1px solid var(--color-border); border-radius: var(--radius-control); background: white; color: var(--color-ink); cursor: pointer; font-weight: 700; }
.color-choice.dark { border-color: #31302e; background: #31302e; color: white; }
.setup-actions .primary { margin-left: auto; }
.setup-progress { display: grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap: 8px; }
.setup-progress span { padding: 12px; border-radius: var(--radius-small); background: var(--color-surface-muted); color: var(--color-muted); font-size: 13px; }
.setup-progress span.ready { color: var(--color-success); font-weight: 700; }
.game-grid { display: grid; grid-template-columns: minmax(0,1fr) 340px; align-items: start; gap: var(--space-4); }
.code-table { min-width: 0; display: grid; gap: 24px; padding: 20px; border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: white; }
.opponents { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 18px; }
.side-stack { min-width: 0; display: grid; gap: var(--space-4); }
.action-panel, .rule-panel { padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: white; }
.panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.panel-heading h2 { margin: 0; font-size: 18px; }
.panel-heading span { color: var(--color-muted); font-size: 12px; }
.phase-copy { padding: 12px; border-radius: var(--radius-small); background: var(--color-surface-muted); }
.phase-copy strong, .phase-copy span { display: block; }
.phase-copy span { margin-top: 4px; color: var(--color-muted); font-size: 12px; }
.draw-pool { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 16px; }
.draw-btn { min-height: 76px; border: 1px solid var(--color-border); border-radius: var(--radius-small); background: white; color: var(--color-ink); cursor: pointer; font-weight: 700; }
.draw-btn.dark { border-color: #31302e; background: #31302e; color: white; }
.draw-btn span { display: block; margin-top: 4px; font-size: 11px; opacity: .68; }
.clue-wrap { display: grid; grid-template-columns: 66px minmax(0,1fr); align-items: center; gap: 12px; margin-top: 16px; padding: 12px; border: 1px dashed var(--color-border); border-radius: var(--radius-small); }
.clue-wrap strong, .clue-wrap span { display: block; }
.clue-wrap span { color: var(--color-muted); font-size: 12px; }
.guess-form { display: grid; gap: 12px; margin-top: 16px; }
.guess-form p { margin: 0; }
.guess-form p strong, .guess-form p span { display: block; }
.guess-form p span { color: var(--color-muted); font-size: 12px; }
.guess-form label { font-size: 13px; font-weight: 700; }
.guess-form select { width: 100%; min-height: 44px; margin-top: 4px; padding: 0 12px; border: 1px solid var(--color-border); border-radius: var(--radius-control); background: white; color: var(--color-ink); }
.decision-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 16px; }
.decision-actions .primary, .decision-actions .secondary { min-height: 46px; }
.rule-panel p { margin: 0; color: var(--color-muted); font-size: 13px; }
.rule-panel ul { margin: 12px 0 0; padding-left: 20px; color: var(--color-muted); font-size: 12px; }
.rule-panel li + li { margin-top: 7px; }
@media (max-width: 1000px) { .game-grid { grid-template-columns: 1fr; } .side-stack { grid-template-columns: 1fr 1fr; } .side-stack :deep(.activity-panel) { grid-column: 1/-1; } }
@media (max-width: 720px) { .game-topbar { align-items: stretch; flex-direction: column; } .turn-chip { min-width: 0; } .status-strip { grid-template-columns: 1fr 1fr 1fr; } .last-action { grid-column: 1/-1; border-top: 1px solid var(--color-border-soft); } .opponents, .side-stack { grid-template-columns: 1fr; } .side-stack :deep(.activity-panel) { grid-column: auto; } .code-table { padding: 14px; } }
@media (max-width: 480px) { .status-strip { grid-template-columns: 1fr 1fr; } .last-action { grid-column: auto; } .waiting-panel { align-items: stretch; flex-direction: column; } .setup-actions .primary { width: 100%; margin-left: 0; } .decision-actions { grid-template-columns: 1fr; } }
</style>
