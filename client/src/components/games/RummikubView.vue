<template>
  <div class="rummikub-game">
    <header class="game-topbar">
      <div>
        <p class="eyebrow">TILE TABLE</p>
        <h1>루미큐브</h1>
        <p>조합을 완성하고, 보드를 재구성해 가장 먼저 패를 비우세요.</p>
      </div>
      <div class="turn-chip" :class="{ mine: isMyTurn }" role="status">
        <span>{{ state?.gamePhase === 'waiting' ? '게임 준비' : '현재 턴' }}</span>
        <strong>{{ state?.gamePhase === 'waiting' ? `${players.length}명 참가` : currentPlayerName }}</strong>
      </div>
    </header>

    <section class="status-strip" aria-label="루미큐브 게임 상태">
      <div><span>풀</span><strong>{{ state?.poolCount ?? 0 }}개</strong></div>
      <div><span>보드 버전</span><strong>#{{ state?.boardRevision ?? 0 }}</strong></div>
      <div><span>턴</span><strong>{{ state?.turnCount ?? 0 }}</strong></div>
      <div class="last-action"><span>최근 액션</span><strong>{{ state?.lastAction || '게임 시작을 기다리고 있습니다.' }}</strong></div>
    </section>

    <div class="game-layout">
      <main class="game-main">
        <RummikubBoard
          :melds="visibleMelds"
          :selected-ids="selectedTileIds"
          :editable="canEdit"
          @toggle="toggleTile"
          @add-selected="moveSelectedToMeld"
          @dissolve="dissolveSelectedMeld"
          @reorder="reorderSelectedTile"
        />

        <RummikubRack
          :tiles="visibleRack"
          :selected-ids="selectedTileIds"
          :board-tile-ids="publicBoardTileIds"
          @toggle="toggleTile"
        />

        <RummikubTurnControls
          v-if="state?.gamePhase === 'playing'"
          :editable="canEdit"
          :selected-count="selectedTileIds.length"
          :has-initial-meld="Boolean(myPlayer?.hasInitialMeld)"
          :initial-score="initialMeldScore"
          :all-melds-valid="allMeldsValid"
          :can-undo="draftHistory.length > 0"
          :can-commit="canCommit"
          :pool-empty="(state?.poolCount ?? 0) === 0"
          @new-meld="moveSelectedToNewMeld"
          @to-rack="moveSelectedToRack"
          @undo="undoDraft"
          @reset="resetDraft"
          @draw="drawTile"
          @pass="passTurn"
          @commit="commitTurn"
        />

        <section v-else-if="state?.gamePhase === 'waiting'" class="waiting-panel">
          <div>
            <strong>{{ isHost ? '게임을 시작할 준비가 됐나요?' : '방장이 게임을 시작할 때까지 기다려주세요.' }}</strong>
            <span>2~4명이 참가할 수 있으며 시작 시 각자 타일 14개를 받습니다.</span>
          </div>
          <button v-if="isHost" type="button" :disabled="players.length < 2" @click="startGame">게임 시작</button>
        </section>
      </main>

      <aside class="game-sidebar">
        <RummikubPlayerPanel
          :players="players"
          :current-turn-id="state?.currentTurnId || ''"
          :my-session-id="mySessionId"
        />
        <GameActivityPanel
          :messages="messages"
          title="게임 기록"
          title-id="rummikub-activity-title"
          note="첫 등록은 내 패만으로 30점 이상이어야 합니다. 등록 후에는 기존 조합을 분리하거나 합칠 수 있습니다."
        />
      </aside>
    </div>

    <RummikubResultModal
      v-if="state?.gamePhase === 'finished'"
      :rankings="rankingPlayers"
      @return="returnToTable"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { toSystemErrorMessage } from '../../games/errors';
import {
  analyzeClientMeld,
  cloneRummikubDraft,
  createRummikubDraft,
  dissolveMeld,
  moveTilesToMeld,
  moveTilesToNewMeld,
  moveTilesToRack,
  reorderTile,
  toCommitPayload,
} from '../../games/rummikub/draft';
import { RUMMIKUB_PROTOCOL } from '../../games/rummikub/protocol';
import { projectRummikubState } from '../../games/rummikub/state';
import GameActivityPanel from './shared/GameActivityPanel.vue';
import RummikubBoard from './rummikub/RummikubBoard.vue';
import RummikubPlayerPanel from './rummikub/RummikubPlayerPanel.vue';
import RummikubRack from './rummikub/RummikubRack.vue';
import RummikubResultModal from './rummikub/RummikubResultModal.vue';
import RummikubTurnControls from './rummikub/RummikubTurnControls.vue';

const props = defineProps({
  gameConnection: { type: Object, required: true },
});
const emit = defineEmits(['move-to-game']);

const room = computed(() => props.gameConnection ?? null);
const mySessionId = computed(() => props.gameConnection?.sessionId ?? '');
const state = ref(null);
const privateRack = ref({ revision: 0, tiles: [] });
const messages = ref([]);
const draft = ref(null);
const draftHistory = ref([]);
const selectedTileIds = ref([]);
const actionPending = ref(false);
const draftTurnId = ref('');
const draftSourceRackKey = ref('');
let boundRoom = null;

watch(
  room,
  (nextRoom) => {
    if (!nextRoom || boundRoom === nextRoom) return;
    boundRoom = nextRoom;

    const applyPublicState = (nextState) => {
      state.value = projectRummikubState(nextState);
      actionPending.value = false;
    };
    nextRoom.onStateChange(applyPublicState);
    if (nextRoom.state) applyPublicState(nextRoom.state);

    nextRoom.onMessage('chat', (data) => messages.value.push(data));
    nextRoom.onMessage(RUMMIKUB_PROTOCOL.messages.privateRack, (data) => {
      actionPending.value = false;
      privateRack.value = {
        revision: Number.isInteger(data?.revision) ? data.revision : 0,
        tiles: Array.isArray(data?.tiles) ? data.tiles : [],
      };
    });
    nextRoom.onMessage('room_error', (data) => {
      actionPending.value = false;
      messages.value.push(toSystemErrorMessage(data));
      if (data?.code === 'STALE_BOARD_REVISION') resetDraft();
    });
    nextRoom.onMessage('move_room', (data) => emit('move-to-game', data));
    nextRoom.send(RUMMIKUB_PROTOCOL.messages.requestPrivateState);
  },
  { immediate: true }
);

const players = computed(() => Object.values(state.value?.players || {}));
const myPlayer = computed(() =>
  players.value.find((player) => player.sessionId === mySessionId.value)
);
const isHost = computed(() => Boolean(myPlayer.value?.isHost));
const isMyTurn = computed(
  () => state.value?.gamePhase === 'playing' && state.value?.currentTurnId === mySessionId.value
);
const canEdit = computed(
  () => isMyTurn.value && Boolean(draft.value) && !actionPending.value
);

const currentPlayerName = computed(() => {
  const player = players.value.find((item) => item.sessionId === state.value?.currentTurnId);
  return player?.nickname || '-';
});

const tileLookup = computed(() => {
  const tiles = new Map();
  (state.value?.melds || []).forEach((meld) => {
    meld.tiles.forEach((tile) => tiles.set(tile.id, tile));
  });
  privateRack.value.tiles.forEach((tile) => tiles.set(tile.id, tile));
  return tiles;
});

const publicBoardTileIds = computed(() =>
  (state.value?.melds || []).flatMap((meld) => meld.tiles.map((tile) => tile.id))
);
const originalRackTileIds = computed(() => privateRack.value.tiles.map((tile) => tile.id));
const sourceRackKey = computed(() => [...originalRackTileIds.value].sort().join('|'));

const draftMelds = computed(() => {
  if (!draft.value) return state.value?.melds || [];
  return draft.value.melds.map((meld) => ({
    id: meld.id,
    tiles: meld.tileIds.map((tileId) => tileLookup.value.get(tileId)).filter(Boolean),
  }));
});

const colorOrder = { red: 0, yellow: 1, blue: 2, black: 3, joker: 4 };
const sortTiles = (tiles) =>
  [...tiles].sort((first, second) => {
    if (first.isJoker !== second.isJoker) return first.isJoker ? 1 : -1;
    const colorDifference = (colorOrder[first.color] ?? 9) - (colorOrder[second.color] ?? 9);
    return colorDifference || first.number - second.number || first.id.localeCompare(second.id);
  });

const draftRackTiles = computed(() => {
  const ids = draft.value?.rackTileIds || originalRackTileIds.value;
  return sortTiles(ids.map((tileId) => tileLookup.value.get(tileId)).filter(Boolean));
});
const visibleMelds = computed(() => (canEdit.value ? draftMelds.value : state.value?.melds || []));
const visibleRack = computed(() => draftRackTiles.value);

const meldAnalyses = computed(() =>
  draftMelds.value.map((meld) => analyzeClientMeld(meld.tiles))
);
const allMeldsValid = computed(
  () => draftMelds.value.length > 0 && meldAnalyses.value.every(Boolean)
);
const initialMeldScore = computed(() => {
  if (myPlayer.value?.hasInitialMeld) return 0;
  const previousCount = state.value?.melds?.length || 0;
  return meldAnalyses.value
    .slice(previousCount)
    .reduce((total, analysis) => total + (analysis?.score || 0), 0);
});
const hasRackTileOnBoard = computed(() => {
  const rackIds = new Set(originalRackTileIds.value);
  return (draft.value?.melds || []).some((meld) =>
    meld.tileIds.some((tileId) => rackIds.has(tileId))
  );
});
const allPublicBoardTilesPresent = computed(() => {
  const draftBoardIds = new Set(
    (draft.value?.melds || []).flatMap((meld) => meld.tileIds)
  );
  return publicBoardTileIds.value.every((tileId) => draftBoardIds.has(tileId));
});
const preservesBoardBeforeInitialMeld = computed(() => {
  if (myPlayer.value?.hasInitialMeld) return true;
  const publicMelds = state.value?.melds || [];
  return publicMelds.every((meld, index) => {
    const draftIds = draft.value?.melds?.[index]?.tileIds || [];
    const publicIds = meld.tiles.map((tile) => tile.id);
    return (
      draftIds.length === publicIds.length &&
      publicIds.every((tileId, tileIndex) => draftIds[tileIndex] === tileId)
    );
  });
});
const canCommit = computed(
  () =>
    canEdit.value &&
    allMeldsValid.value &&
    hasRackTileOnBoard.value &&
    allPublicBoardTilesPresent.value &&
    preservesBoardBeforeInitialMeld.value &&
    (myPlayer.value?.hasInitialMeld || initialMeldScore.value >= 30)
);

const rankingPlayers = computed(() =>
  (state.value?.rankings || []).map((sessionId) => {
    const player = players.value.find((item) => item.sessionId === sessionId);
    return {
      id: sessionId,
      name: player?.nickname || sessionId,
      score: player?.score || 0,
    };
  })
);

watch(
  [
    () => state.value?.boardRevision,
    () => state.value?.currentTurnId,
    () => state.value?.gamePhase,
    sourceRackKey,
  ],
  () => {
    if (!isMyTurn.value) {
      draft.value = null;
      draftHistory.value = [];
      selectedTileIds.value = [];
      return;
    }
    if (
      !draft.value ||
      draft.value.baseRevision !== state.value?.boardRevision ||
      draftTurnId.value !== state.value?.currentTurnId ||
      draftSourceRackKey.value !== sourceRackKey.value
    ) {
      resetDraft();
    }
  },
  { immediate: true }
);

function resetDraft() {
  if (!state.value || !isMyTurn.value) return;
  draft.value = createRummikubDraft(
    state.value.melds || [],
    privateRack.value.tiles,
    state.value.boardRevision || 0
  );
  draftHistory.value = [];
  selectedTileIds.value = [];
  draftTurnId.value = state.value.currentTurnId;
  draftSourceRackKey.value = sourceRackKey.value;
}

function mutateDraft(mutator) {
  if (!draft.value || !canEdit.value) return;
  draftHistory.value.push(cloneRummikubDraft(draft.value));
  mutator(draft.value);
  selectedTileIds.value = [];
}

function toggleTile(tileId) {
  if (!canEdit.value) return;
  selectedTileIds.value = selectedTileIds.value.includes(tileId)
    ? selectedTileIds.value.filter((id) => id !== tileId)
    : [...selectedTileIds.value, tileId];
}

function moveSelectedToNewMeld() {
  mutateDraft((value) => moveTilesToNewMeld(value, selectedTileIds.value));
}

function moveSelectedToMeld(meldId) {
  mutateDraft((value) => moveTilesToMeld(value, meldId, selectedTileIds.value));
}

function moveSelectedToRack() {
  mutateDraft((value) => moveTilesToRack(value, selectedTileIds.value));
}

function dissolveSelectedMeld(meldId) {
  mutateDraft((value) => dissolveMeld(value, meldId));
}

function reorderSelectedTile(meldId, tileId, direction) {
  mutateDraft((value) => reorderTile(value, meldId, tileId, direction));
}

function undoDraft() {
  const previous = draftHistory.value.pop();
  if (previous) draft.value = previous;
  selectedTileIds.value = [];
}

function startGame() {
  if (room.value && isHost.value && players.value.length >= 2) {
    room.value.send(RUMMIKUB_PROTOCOL.messages.startGame);
  }
}

function commitTurn() {
  if (!room.value || !draft.value || !canCommit.value) return;
  actionPending.value = true;
  room.value.send(RUMMIKUB_PROTOCOL.messages.commitTurn, toCommitPayload(draft.value));
}

function drawTile() {
  if (!room.value || !canEdit.value) return;
  actionPending.value = true;
  room.value.send(RUMMIKUB_PROTOCOL.messages.drawTile);
}

function passTurn() {
  if (!room.value || !canEdit.value) return;
  actionPending.value = true;
  room.value.send(RUMMIKUB_PROTOCOL.messages.passTurn);
}

function returnToTable() {
  if (room.value) room.value.send(RUMMIKUB_PROTOCOL.messages.returnToTable);
}
</script>

<style scoped>
.rummikub-game { display: grid; gap: var(--space-5); color: var(--color-ink); }
.game-topbar { display: flex; align-items: end; justify-content: space-between; gap: var(--space-4); }
.eyebrow { margin: 0 0 4px; color: var(--color-muted); font-size: 11px; font-weight: 800; letter-spacing: .12em; }
.game-topbar h1 { margin: 0; font-size: clamp(34px,5vw,52px); line-height: 1; letter-spacing: -.045em; }
.game-topbar > div > p:last-child { margin: 10px 0 0; color: var(--color-muted); font-size: 14px; }
.turn-chip { min-width: 180px; padding: 11px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-small); background: white; }
.turn-chip span,
.turn-chip strong { display: block; }
.turn-chip span { color: var(--color-muted); font-size: 11px; }
.turn-chip strong { margin-top: 2px; }
.turn-chip.mine { border-color: color-mix(in srgb, var(--color-success) 42%, var(--color-border)); background: color-mix(in srgb, var(--color-success) 7%, white); }
.status-strip { display: grid; grid-template-columns: 110px 110px 90px minmax(0,1fr); border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: white; overflow: hidden; }
.status-strip > div { min-height: 68px; padding: 13px 15px; border-right: 1px solid var(--color-border-soft); }
.status-strip > div:last-child { border: 0; }
.status-strip span,
.status-strip strong { display: block; }
.status-strip span { color: var(--color-muted); font-size: 11px; }
.status-strip strong { margin-top: 5px; font-size: 14px; }
.last-action strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.game-layout { display: grid; grid-template-columns: minmax(0,1fr) 280px; align-items: start; gap: var(--space-4); }
.game-main,
.game-sidebar { min-width: 0; display: grid; gap: var(--space-4); }
.waiting-panel { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px; border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: white; }
.waiting-panel strong,
.waiting-panel span { display: block; }
.waiting-panel span { margin-top: 4px; color: var(--color-muted); font-size: 12px; }
.waiting-panel button { min-height: 42px; padding: 0 18px; border: 0; border-radius: var(--radius-control); background: var(--color-primary); color: white; cursor: pointer; font-weight: 700; }
.waiting-panel button:disabled { opacity: .4; cursor: not-allowed; }
@media (max-width: 1000px) { .game-layout { grid-template-columns: 1fr; } .game-sidebar { grid-template-columns: minmax(240px,.7fr) minmax(280px,1.3fr); } }
@media (max-width: 720px) { .game-topbar { align-items: stretch; flex-direction: column; } .turn-chip { min-width: 0; } .status-strip { grid-template-columns: 1fr 1fr 1fr; } .last-action { grid-column: 1/-1; border-top: 1px solid var(--color-border-soft); } .game-sidebar { grid-template-columns: 1fr; } }
@media (max-width: 480px) { .status-strip { grid-template-columns: 1fr 1fr; } .status-strip > div:nth-child(2) { border-right: 0; } .status-strip > div:nth-child(3) { border-top: 1px solid var(--color-border-soft); } .last-action { grid-column: auto; } .waiting-panel { align-items: stretch; flex-direction: column; } }
</style>
