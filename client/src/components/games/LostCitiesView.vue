<template>
  <div class="lost-game">
    <header class="game-topbar">
      <div>
        <p class="eyebrow">FIVE EXPEDITIONS · THREE ROUNDS</p>
        <h1>로스트시티</h1>
        <p>탐험을 시작했다면 더 큰 숫자만 놓을 수 있습니다. 위험을 감수해 가장 값진 원정을 완성하세요.</p>
      </div>
      <TurnTimer :deadline-at="state?.turnDeadlineAt || 0" :active="Boolean(state?.turnDeadlineAt)" :is-mine="isMyTurn" />
      <div class="turn-chip" :class="{ mine: isMyTurn }" role="status">
        <span>{{ turnStatus.label }}</span><strong>{{ turnStatus.title }}</strong><small>{{ turnStatus.description }}</small>
      </div>
    </header>

    <section class="status-strip" aria-label="게임 현황">
      <div><span>현재 라운드</span><strong>{{ state?.roundCount || 0 }} / 3</strong></div>
      <div><span>남은 카드</span><strong>{{ state?.deckCount || 0 }}장</strong></div>
      <div class="mine"><span>내 공개 점수</span><strong>{{ myPlayer?.roundScore || 0 }}점</strong></div>
      <div><span>상대 공개 점수</span><strong>{{ opponent?.roundScore || 0 }}점</strong></div>
    </section>

    <p v-if="errorMessage" class="error-banner" role="alert">{{ errorMessage }}</p>

    <section v-if="state?.gamePhase === 'waiting'" class="waiting-panel">
      <div>
        <strong>{{ isHost ? '두 탐험가가 모두 준비됐나요?' : '방장이 게임을 시작할 때까지 기다려주세요.' }}</strong>
        <span>현재 {{ connectedPlayerCount }}명 · 정확히 2명이 플레이합니다.</span>
      </div>
      <ActionGuard v-if="isHost" :reason="startBlockedReason" label="게임 시작">
        <button type="button" :disabled="Boolean(startBlockedReason)" @click="startGame">게임 시작</button>
      </ActionGuard>
    </section>

    <template v-else>
      <section class="play-grid">
        <article class="board-panel">
          <div class="panel-heading">
            <div><h2>다섯 탐험대</h2><span>상대 탐험 · 버림 더미 · 내 탐험</span></div>
            <small>{{ opponent?.nickname || '상대 탐험가' }} vs {{ myPlayer?.nickname || '나' }}</small>
          </div>
          <div class="expedition-scroll">
            <div class="expeditions">
              <LostCitiesExpedition
                v-for="color in colors"
                :key="color"
                :color="color"
                :label="colorMeta[color].label"
                :mine="myPlayer?.expeditions?.[color] || emptyExpedition"
                :opponent="opponent?.expeditions?.[color] || emptyExpedition"
                :discard="state?.discards?.[color] || emptyDiscard"
                :draw-blocked-reason="discardDrawBlockedReason(color)"
                @draw-discard="drawDiscard"
              />
            </div>
          </div>
          <p class="board-note">각 탐험은 내기 카드부터, 숫자 카드는 작은 수에서 큰 수 순서로만 놓을 수 있습니다.</p>
        </article>

        <aside class="action-panel" aria-labelledby="lost-action-title">
          <div class="panel-heading"><h2 id="lost-action-title">이번 행동</h2><span>PLAY → DRAW</span></div>

          <div class="phase-steps" aria-label="턴 진행 단계">
            <div :class="{ active: state?.actionPhase === 'play' }"><b>1</b><span>카드 내려놓기</span></div>
            <div :class="{ active: state?.actionPhase === 'draw' }"><b>2</b><span>카드 뽑기</span></div>
          </div>

          <div v-if="state?.gamePhase === 'round_result'" class="round-result">
            <p>ROUND {{ state.roundCount }} COMPLETE</p>
            <strong>{{ roundWinnerNames }} 라운드 우세</strong>
            <div v-for="player in players" :key="player.sessionId">
              <span>{{ player.nickname }}</span><b>{{ player.roundScore }}점</b>
            </div>
            <button v-if="isHost" type="button" @click="nextRound">다음 라운드 시작</button>
            <small v-else>방장이 다음 라운드를 시작할 때까지 기다려주세요.</small>
          </div>

          <template v-else>
            <div class="phase-copy">
              <strong>{{ actionCopy.title }}</strong><span>{{ actionCopy.description }}</span>
            </div>

            <div v-if="state?.actionPhase === 'play'" class="selection-summary">
              <span>선택한 카드</span>
              <template v-if="selectedCard">
                <LostCitiesCard :card="selectedCard" mini />
                <strong>{{ colorMeta[selectedCard.color]?.label }} · {{ cardLabel(selectedCard) }}</strong>
              </template>
              <em v-else>아래 손패에서 카드 한 장을 선택하세요.</em>
            </div>

            <div v-if="canPlayCard" class="play-actions">
              <ActionGuard :reason="expeditionBlockedReason" label="탐험대에 놓기">
                <button type="button" class="primary" :disabled="Boolean(expeditionBlockedReason)" @click="playSelected('expedition')">탐험대에 놓기</button>
              </ActionGuard>
              <ActionGuard :reason="discardBlockedReason" label="버리기">
                <button type="button" class="secondary" :disabled="Boolean(discardBlockedReason)" @click="playSelected('discard')">버리기</button>
              </ActionGuard>
              <small v-if="selectedCard && !canPlaySelected">이 탐험에는 더 작은 숫자나 뒤늦은 내기 카드를 놓을 수 없습니다.</small>
            </div>

            <div v-if="canDrawCard" class="draw-actions">
              <ActionGuard :reason="deckDrawBlockedReason" label="덱에서 뽑기" block>
                <button type="button" class="deck-button" :disabled="Boolean(deckDrawBlockedReason)" @click="drawDeck">
                  <i aria-hidden="true"></i><strong>덱에서 뽑기</strong><span>{{ state?.deckCount || 0 }}장 남음</span>
                </button>
              </ActionGuard>
              <p>또는 보드 가운데의 버림 더미를 클릭하세요.<br>방금 버린 색의 더미에서는 뽑을 수 없습니다.</p>
            </div>
          </template>

          <div class="activity-panel" aria-live="polite">
            <span>최근 공개 행동</span><strong>{{ state?.lastAction || '아직 공개된 행동이 없습니다.' }}</strong>
          </div>
        </aside>
      </section>

      <section class="hand-panel" aria-labelledby="lost-hand-title">
        <div class="panel-heading">
          <div><h2 id="lost-hand-title">내 손패</h2><span>나에게만 보이는 카드 · {{ privateHand.cards.length }}장</span></div>
          <small v-if="canPlayCard">카드를 선택한 뒤 오른쪽 행동 패널에서 어디에 놓을지 결정하세요.</small>
        </div>
        <div class="hand-scroll">
          <div class="hand-cards" :class="{ ready: canPlayCard }">
            <ActionGuard
              v-for="card in sortedHand"
              :key="card.id"
              :reason="handCardBlockedReason(card)"
              :label="`${colorMeta[card.color]?.label} ${cardLabel(card)} 선택`"
            >
              <LostCitiesCard
                :card="card"
                :interactive="canPlayCard"
                :selected="selectedCardId === card.id"
                :disabled="Boolean(handCardBlockedReason(card))"
                @select="selectCard"
              />
            </ActionGuard>
            <p v-if="!privateHand.cards.length" class="empty-hand">비공개 손패를 불러오는 중입니다.</p>
          </div>
        </div>
      </section>
    </template>

    <LostCitiesResultModal
      v-if="state?.gamePhase === 'finished'"
      :players="rankingPlayers"
      :winner-ids="state.winnerSessionIds"
      @return="returnToTable"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { showRoomErrorAlert } from '../../game-alerts';
import { LOST_CITIES_PROTOCOL } from '../../games/lost-cities/protocol';
import { LOST_CITIES_COLORS, projectLostCitiesState } from '../../games/lost-cities/state';
import ActionGuard from './shared/ActionGuard.vue';
import TurnTimer from './shared/TurnTimer.vue';
import LostCitiesCard from './lost-cities/LostCitiesCard.vue';
import LostCitiesExpedition from './lost-cities/LostCitiesExpedition.vue';
import LostCitiesResultModal from './lost-cities/LostCitiesResultModal.vue';

const props = defineProps({ gameConnection: { type: Object, required: true } });
const emit = defineEmits(['move-to-game']);
const colors = LOST_CITIES_COLORS;
const colorMeta = {
  yellow: { label: '황금 사막' }, blue: { label: '심해' }, white: { label: '설산' },
  green: { label: '밀림' }, red: { label: '화산' },
};
const emptyExpedition = Object.freeze({ cards: Object.freeze([]), score: 0 });
const emptyDiscard = Object.freeze({ count: 0, topCard: Object.freeze({ id: '' }) });
const room = computed(() => props.gameConnection ?? null);
const mySessionId = computed(() => props.gameConnection?.sessionId ?? '');
const state = ref(null);
const privateHand = ref({ revision: 0, cards: [] });
const selectedCardId = ref('');
const actionPending = ref(false);
const errorMessage = ref('');
let boundRoom = null;

watch(room, (nextRoom) => {
  if (!nextRoom || boundRoom === nextRoom) return;
  boundRoom = nextRoom;
  const applyState = (nextState) => {
    state.value = projectLostCitiesState(nextState);
    actionPending.value = false;
  };
  nextRoom.onStateChange(applyState);
  if (nextRoom.state) applyState(nextRoom.state);
  nextRoom.onMessage(LOST_CITIES_PROTOCOL.messages.privateHand, (data) => {
    privateHand.value = {
      revision: Number.isInteger(data?.revision) ? data.revision : 0,
      cards: Array.isArray(data?.cards) ? data.cards : [],
    };
    actionPending.value = false;
  });
  nextRoom.onMessage('room_error', (data) => {
    errorMessage.value = '';
    actionPending.value = false;
    void showRoomErrorAlert(data);
  });
  nextRoom.onMessage('move_room', (data) => emit('move-to-game', data));
  nextRoom.send(LOST_CITIES_PROTOCOL.messages.requestPrivateState);
}, { immediate: true });

const players = computed(() => Object.values(state.value?.players || {}));
const connectedPlayerCount = computed(() => players.value.filter((player) => player.connected).length);
const myPlayer = computed(() => players.value.find((player) => player.sessionId === mySessionId.value));
const opponent = computed(() => players.value.find((player) => player.sessionId !== mySessionId.value));
const isHost = computed(() => Boolean(myPlayer.value?.isHost));
const isMyTurn = computed(() => state.value?.gamePhase === 'playing' && state.value?.currentTurnId === mySessionId.value);
const canPlayCard = computed(() => isMyTurn.value && state.value?.actionPhase === 'play');
const canDrawCard = computed(() => isMyTurn.value && state.value?.actionPhase === 'draw');
const selectedCard = computed(() => privateHand.value.cards.find((card) => card.id === selectedCardId.value));
const sortedHand = computed(() => [...privateHand.value.cards].sort((left, right) => {
  const colorOrder = colors.indexOf(left.color) - colors.indexOf(right.color);
  if (colorOrder) return colorOrder;
  if (left.kind !== right.kind) return left.kind === 'wager' ? -1 : 1;
  return left.value - right.value;
}));
const canPlaySelected = computed(() => {
  if (!selectedCard.value) return false;
  const route = myPlayer.value?.expeditions?.[selectedCard.value.color]?.cards || [];
  if (selectedCard.value.kind === 'wager') return route.every((card) => card.kind === 'wager');
  const lastNumber = [...route].reverse().find((card) => card.kind === 'number');
  return !lastNumber || selectedCard.value.value > lastNumber.value;
});
const startBlockedReason = computed(() => {
  if (actionPending.value) return '이전 요청을 처리하고 있습니다.';
  if (connectedPlayerCount.value !== 2) return '로스트시티는 정확히 두 명이 모여야 시작할 수 있습니다.';
  return '';
});
const handBlockedReason = computed(() => {
  if (actionPending.value) return '이전 행동을 처리하고 있습니다.';
  if (state.value?.gamePhase !== 'playing') return '라운드가 진행 중일 때만 손패를 선택할 수 있습니다.';
  if (!isMyTurn.value) return `${playerName(state.value?.currentTurnId)}님의 차례입니다.`;
  if (state.value?.actionPhase !== 'play') return '카드를 내려놓은 뒤에는 새 카드 한 장을 먼저 뽑아야 합니다.';
  return '';
});
const expeditionBlockedReason = computed(() => {
  if (actionPending.value) return '이전 행동을 처리하고 있습니다.';
  if (!selectedCard.value) return '아래 손패에서 카드 한 장을 먼저 선택하세요.';
  if (canPlaySelected.value) return '';
  const route = myPlayer.value?.expeditions?.[selectedCard.value.color]?.cards || [];
  if (selectedCard.value.kind === 'wager') return '숫자 카드를 놓은 탐험에는 내기 카드를 뒤늦게 놓을 수 없습니다.';
  const lastNumber = [...route].reverse().find((card) => card.kind === 'number');
  return lastNumber
    ? `이 탐험의 마지막 숫자는 ${lastNumber.value}입니다. 그보다 큰 숫자만 놓을 수 있습니다.`
    : '이 카드는 현재 탐험대에 놓을 수 없습니다.';
});
const discardBlockedReason = computed(() => {
  if (actionPending.value) return '이전 행동을 처리하고 있습니다.';
  if (!selectedCard.value) return '아래 손패에서 버릴 카드 한 장을 먼저 선택하세요.';
  return '';
});
const deckDrawBlockedReason = computed(() => {
  if (actionPending.value) return '이전 행동을 처리하고 있습니다.';
  if (!state.value?.deckCount) return '덱에 남은 카드가 없습니다. 버림 더미에서 한 장을 가져오세요.';
  return '';
});
const roundWinnerNames = computed(() => (state.value?.roundWinnerIds || []).map(playerName).join(', ') || '두 탐험가');
const rankingPlayers = computed(() => (state.value?.rankings || []).map((id, index) => ({
  ...(players.value.find((player) => player.sessionId === id) || {}),
  sessionId: id,
  nickname: playerName(id),
  rank: index + 1,
})));
const turnStatus = computed(() => {
  if (state.value?.gamePhase === 'waiting') return { label: '게임 준비', title: '게임 시작을 기다리고 있습니다.', description: `현재 ${connectedPlayerCount.value}명입니다. 두 탐험가가 모이면 게임을 시작할 수 있습니다.` };
  if (state.value?.gamePhase === 'round_result') return { label: '라운드 종료', title: '이번 라운드의 점수를 확인하세요.', description: `이번 라운드 최고 점수: ${roundWinnerNames.value}. 방장이 다음 라운드를 시작할 수 있습니다.` };
  if (state.value?.gamePhase === 'finished') return { label: '게임 종료', title: '세 라운드의 탐험이 끝났습니다.', description: '최종 누적 점수와 순위를 확인하고 대기실로 돌아갈 수 있습니다.' };
  const currentName = playerName(state.value?.currentTurnId);
  if (!isMyTurn.value) return {
    label: `${currentName}님의 차례 · ${state.value?.actionPhase === 'draw' ? '카드 뽑기' : '카드 내려놓기'} 단계`,
    title: state.value?.actionPhase === 'draw' ? `${currentName}님이 카드 한 장을 뽑고 있습니다.` : `${currentName}님이 내려놓을 카드를 선택하고 있습니다.`,
    description: '상대 탐험대와 버림 더미에 어떤 카드가 추가되는지 확인하세요.',
  };
  if (state.value?.actionPhase === 'draw') return {
    label: '내 차례 · 카드 뽑기 단계',
    title: '카드 한 장을 뽑으세요.',
    description: '덱이나 버림 더미에서 가져오면 턴이 끝납니다. 방금 버린 카드는 다시 가져올 수 없습니다.',
  };
  if (selectedCard.value && !canPlaySelected.value) return {
    label: '내 차례 · 카드 내려놓기 단계',
    title: '이 카드는 현재 탐험대에 놓을 수 없습니다.',
    description: '기존 숫자보다 큰 카드만 놓을 수 있습니다. 선택한 카드를 버림 더미에 버릴 수는 있습니다.',
  };
  return {
    label: '내 차례 · 카드 내려놓기 단계',
    title: '손패에서 카드 한 장을 선택하세요.',
    description: '탐험대에 놓거나 같은 색의 버림 더미에 버릴 수 있습니다.',
  };
});
const actionCopy = computed(() => {
  if (!isMyTurn.value) return { title: `${playerName(state.value?.currentTurnId)}님의 행동을 기다리는 중`, description: '상대의 탐험대와 버림 더미 변화를 살펴보세요.' };
  if (state.value?.actionPhase === 'draw') return { title: '카드 한 장을 뽑으세요.', description: '덱 또는 보드의 버림 더미 중 한 곳을 선택하면 턴이 끝납니다.' };
  return { title: '손패에서 카드 한 장을 고르세요.', description: '내 탐험대에 놓거나 같은 색의 버림 더미에 버릴 수 있습니다.' };
});

watch(() => `${state.value?.turnRevision}:${state.value?.actionPhase}`, () => {
  selectedCardId.value = '';
  errorMessage.value = '';
});

function playerName(id) { return players.value.find((player) => player.sessionId === id)?.nickname || '플레이어'; }
function cardLabel(card) { return card.kind === 'wager' ? '내기 카드' : `${card.value} 카드`; }
function selectCard(card) { if (canPlayCard.value) selectedCardId.value = card.id; }
function startGame() { room.value?.send(LOST_CITIES_PROTOCOL.messages.startGame); }
function playSelected(destination) {
  if (!selectedCard.value || actionPending.value || (destination === 'expedition' && !canPlaySelected.value)) return;
  actionPending.value = true;
  room.value?.send(LOST_CITIES_PROTOCOL.messages.playCard, { cardId: selectedCard.value.id, destination, turnRevision: state.value.turnRevision });
}
function drawDeck() {
  if (!canDrawCard.value || actionPending.value || !state.value?.deckCount) return;
  actionPending.value = true;
  room.value?.send(LOST_CITIES_PROTOCOL.messages.drawCard, { source: 'deck', turnRevision: state.value.turnRevision });
}
function canDrawDiscard(color) {
  return canDrawCard.value && !actionPending.value && color !== state.value?.blockedDiscardColor && Boolean(state.value?.discards?.[color]?.count);
}
function handCardBlockedReason() { return handBlockedReason.value; }
function discardDrawBlockedReason(color) {
  if (actionPending.value) return '이전 행동을 처리하고 있습니다.';
  if (state.value?.gamePhase !== 'playing') return '라운드가 진행 중일 때만 카드를 뽑을 수 있습니다.';
  if (!isMyTurn.value) return `${playerName(state.value?.currentTurnId)}님의 차례입니다.`;
  if (state.value?.actionPhase !== 'draw') return '먼저 손패 한 장을 탐험대에 놓거나 버려야 합니다.';
  if (!state.value?.discards?.[color]?.count) return '이 색의 버림 더미가 비어 있습니다.';
  if (color === state.value?.blockedDiscardColor) return '방금 버린 카드와 같은 색의 버림 더미에서는 바로 가져올 수 없습니다.';
  return '';
}
function drawDiscard(color) {
  if (!canDrawDiscard(color)) return;
  actionPending.value = true;
  room.value?.send(LOST_CITIES_PROTOCOL.messages.drawCard, { source: 'discard', color, turnRevision: state.value.turnRevision });
}
function nextRound() { room.value?.send(LOST_CITIES_PROTOCOL.messages.nextRound); }
function returnToTable() { room.value?.send(LOST_CITIES_PROTOCOL.messages.returnToTable); }
</script>

<style scoped>
.lost-game{display:grid;gap:16px;color:var(--color-ink)}.game-topbar{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.eyebrow{margin:0 0 5px;color:var(--color-meta);font-size:9px;font-weight:800;letter-spacing:.14em}.game-topbar h1{margin:0;font-size:32px;letter-spacing:-.04em}.game-topbar>div>p:last-child{margin:5px 0 0;color:var(--color-muted);font-size:12px}.turn-chip{min-width:230px;padding:11px 14px;border:1px solid var(--color-border);border-radius:7px;background:#fff}.turn-chip span,.turn-chip strong{display:block}.turn-chip span{color:var(--color-meta);font-size:9px}.turn-chip strong{margin-top:3px;font-size:12px}.turn-chip.mine{border-color:#a65300;background:#fff8ef}.status-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;overflow:hidden;border:1px solid var(--color-border);border-radius:8px;background:var(--color-border-soft)}.status-strip>div{padding:11px 14px;background:#fff}.status-strip>div.mine{background:#fff8ef}.status-strip span{display:block;color:var(--color-meta);font-size:9px}.status-strip strong{display:block;margin-top:3px;font:800 15px/1.2 ui-monospace,monospace}.error-banner{margin:0;padding:10px 12px;border:1px solid #ecc8c8;border-radius:6px;background:#fff5f5;color:#a52d2d;font-size:11px}.waiting-panel{display:flex;align-items:center;justify-content:space-between;padding:24px;border:1px solid var(--color-border);border-radius:10px;background:#fff}.waiting-panel strong,.waiting-panel span{display:block}.waiting-panel span{margin-top:5px;color:var(--color-muted);font-size:11px}.waiting-panel button,.primary,.round-result button{min-height:42px;padding:0 17px;border:0;border-radius:6px;background:#a65300;color:#fff;font-weight:800;cursor:pointer}.waiting-panel button:disabled,.play-actions button:disabled,.deck-button:disabled{opacity:.42;cursor:not-allowed}.play-grid{display:grid;grid-template-columns:minmax(0,1.75fr) 320px;gap:16px}.board-panel,.action-panel,.hand-panel{min-width:0;padding:14px;border:1px solid var(--color-border);border-radius:10px;background:#fff}.panel-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.panel-heading h2{margin:0;font-size:13px}.panel-heading span,.panel-heading small{display:block;margin-top:3px;color:var(--color-meta);font-size:9px}.expedition-scroll{overflow-x:auto;margin-top:12px;padding-bottom:4px}.expeditions{min-width:760px;display:grid;grid-template-columns:repeat(5,minmax(136px,1fr));gap:7px}.board-note{margin:10px 0 0;color:var(--color-muted);font-size:10px}.phase-steps{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:13px}.phase-steps>div{display:flex;align-items:center;gap:7px;min-height:39px;padding:7px;border:1px solid var(--color-border-soft);border-radius:6px;color:var(--color-meta)}.phase-steps b{width:22px;height:22px;display:grid;place-items:center;border-radius:50%;background:var(--color-surface-muted);font:800 10px/1 ui-monospace,monospace}.phase-steps span{font-size:10px;font-weight:700}.phase-steps .active{border-color:#c58b51;background:#fff8ef;color:#874500}.phase-steps .active b{background:#a65300;color:#fff}.phase-copy,.selection-summary,.activity-panel{margin-top:12px;padding:12px;border-radius:7px;background:var(--color-surface-muted)}.phase-copy strong,.phase-copy span,.activity-panel span,.activity-panel strong{display:block}.phase-copy strong{font-size:12px}.phase-copy span{margin-top:4px;color:var(--color-muted);font-size:10px;line-height:1.45}.selection-summary{min-height:78px;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:7px 10px}.selection-summary>span{grid-column:1/-1;color:var(--color-meta);font-size:9px}.selection-summary strong{font-size:11px}.selection-summary em{grid-column:1/-1;color:var(--color-muted);font-size:10px;font-style:normal}.play-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px}.play-actions :deep(.action-guard),.play-actions button{width:100%}.play-actions button{min-height:42px;border-radius:6px;font-weight:800;cursor:pointer}.secondary{border:1px solid var(--color-border);background:#fff;color:var(--color-ink)}.play-actions small{grid-column:1/-1;color:#a22c2c;font-size:9px;line-height:1.4}.draw-actions{margin-top:12px}.deck-button{width:100%;min-height:88px;display:grid;grid-template-columns:42px 1fr;grid-template-rows:1fr 1fr;align-items:end;column-gap:10px;padding:13px;border:1px solid #c58b51;border-radius:7px;background:#fff8ef;color:#874500;text-align:left;cursor:pointer}.deck-button i{grid-row:1/3;width:38px;height:54px;border:1px solid #a65300;border-radius:4px;background:repeating-linear-gradient(45deg,#fff8ef,#fff8ef 4px,#efdcc5 4px,#efdcc5 8px);box-shadow:3px -3px 0 #fff,4px -4px 0 #c58b51}.deck-button strong{align-self:end;font-size:12px}.deck-button span{align-self:start;color:#9a7048;font-size:9px}.draw-actions p{margin:9px 0 0;color:var(--color-muted);font-size:9px;line-height:1.5}.activity-panel{margin-top:14px;border-left:3px solid #a65300}.activity-panel span{color:var(--color-meta);font-size:8px;text-transform:uppercase;letter-spacing:.08em}.activity-panel strong{margin-top:4px;font-size:10px;line-height:1.45}.round-result{display:grid;gap:7px;margin-top:12px;padding:14px;border-radius:7px;background:#fff8ef}.round-result>p{margin:0;color:#a65300;font-size:9px;font-weight:800;letter-spacing:.1em}.round-result>strong{font-size:14px}.round-result>div{display:flex;justify-content:space-between;padding-top:6px;border-top:1px solid #ead9c5;font-size:11px}.round-result>small{color:var(--color-muted);font-size:9px}.hand-panel{padding-bottom:12px}.hand-panel>.panel-heading>small{max-width:390px;text-align:right}.hand-scroll{overflow-x:auto;padding:12px 2px 4px}.hand-cards{min-height:154px;display:flex;align-items:flex-end;justify-content:center;gap:11px}.hand-cards :deep(.action-guard){flex:0 0 auto}.hand-cards.ready :deep(button.lost-card){animation:lost-hand-invite 2.8s ease-in-out infinite}.hand-cards.ready :deep(button.lost-card:hover),.hand-cards.ready :deep(button.lost-card.selected){animation:none}.empty-hand{margin:auto;color:var(--color-muted);font-size:11px}@keyframes lost-hand-invite{0%,100%{translate:0 0}50%{translate:0 -3px}}@media(prefers-reduced-motion:reduce){.hand-cards.ready :deep(button.lost-card){animation:none}}
.turn-chip{width:min(360px,100%);min-width:300px}.turn-chip strong{font-size:13px}.turn-chip small{display:block;margin-top:4px;color:var(--color-muted);font-size:10px;line-height:1.4}
@media(max-width:1080px){.play-grid{grid-template-columns:1fr}.action-panel{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.action-panel>.panel-heading,.phase-steps,.activity-panel{grid-column:1/-1}.hand-cards{justify-content:flex-start}}
@media(max-width:760px){.game-topbar{align-items:flex-start;flex-direction:column}.turn-chip{width:100%;min-width:0}.status-strip{grid-template-columns:1fr 1fr}.action-panel{display:block}.waiting-panel{align-items:flex-start;flex-direction:column;gap:15px}.waiting-panel button{width:100%}.hand-panel>.panel-heading{align-items:flex-start;flex-direction:column}.hand-panel>.panel-heading>small{text-align:left}}
@media(max-width:430px){.status-strip>div{padding:9px}.board-panel,.action-panel,.hand-panel{padding:11px}.play-actions{grid-template-columns:1fr}.play-actions small{grid-column:1}.game-topbar h1{font-size:28px}}
</style>
