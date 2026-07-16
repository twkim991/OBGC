<template>
  <div class="lobby-screen">
    <header class="lobby-heading">
      <div>
        <p class="eyebrow"><span class="live-dot" aria-hidden="true"></span> LIVE LOBBY</p>
        <h1>함께할 테이블을 찾아보세요.</h1>
        <p class="lobby-description">열린 방에 바로 입장하거나 새 테이블을 만들어 게임을 시작하세요.</p>
        <div class="nickname-setting">
          <label for="lobby-nickname">내 닉네임</label>
          <input
            id="lobby-nickname"
            v-model="nickname"
            maxlength="40"
            autocomplete="nickname"
            placeholder="닉네임을 입력하세요"
          />
          <span>방 생성과 입장에 사용 · 중복 가능</span>
        </div>
      </div>
      <div class="room-count" aria-live="polite">
        <strong>{{ filteredRooms.length }}</strong>
        <span>{{ selectedFilter === 'all' ? '개의 열린 테이블' : `${gameLabel(selectedFilter)} 방` }}</span>
      </div>
    </header>

    <p v-if="lobbyError" class="lobby-error" role="alert">{{ lobbyError }}</p>
    <aside v-if="GAME_CATALOG_ISSUES.length" class="catalog-warning" role="status">
      <strong>일부 게임을 사용할 수 없습니다.</strong>
      <ul>
        <li v-for="issue in GAME_CATALOG_ISSUES" :key="`${issue.gameId}-${issue.code}`">
          {{ issue.message }}
        </li>
      </ul>
    </aside>

    <section class="create-panel" aria-labelledby="create-room-title">
      <div class="section-copy">
        <p class="section-label">새 테이블</p>
        <h2 id="create-room-title">게임과 방 이름을 정해주세요.</h2>
      </div>
      <div class="room-controls">
        <label class="control-field game-field">
          <span class="field-label">게임</span>
          <select v-model="newRoomGame" aria-label="새 방 게임">
            <option v-for="game in GAME_CATALOG" :key="game.id" :value="game.id">
              {{ game.label }}
            </option>
          </select>
        </label>
        <label class="control-field title-field">
          <span class="field-label">방 제목</span>
          <input
            v-model="newRoomName"
            maxlength="60"
            aria-label="새 방 제목"
            :placeholder="`${gameLabel(newRoomGame)} 같이 하실 분`"
            @keyup.enter="createRoom"
          />
        </label>
        <button
          class="create-button"
          type="button"
          :disabled="!isSupportedGame(newRoomGame)"
          @click="createRoom"
        >
          방 만들기
        </button>
      </div>
    </section>

    <section class="room-panel" aria-labelledby="room-list-title">
      <div class="room-panel-header">
        <div>
          <p class="section-label">공개 테이블</p>
          <h2 id="room-list-title">현재 열려있는 테이블</h2>
        </div>
        <div class="room-toolbar">
          <GameFilterPicker
            v-model="selectedFilter"
            :games="GAME_CATALOG"
            :room-counts="roomCountByGame"
          />
          <span class="auto-refresh">새 방·게임 변경 자동 반영</span>
        </div>
      </div>
      <ul class="room-list">
        <li v-if="filteredRooms.length === 0" class="empty">
          <strong>{{ emptyRoomTitle }}</strong>
          <span>{{ emptyRoomDescription }}</span>
        </li>
        <li v-for="room in displayedRooms" :key="room.roomId" class="room-item">
          <div class="room-main">
            <span class="room-icon" :style="gameTone(room.metadata?.gameType)" aria-hidden="true">
              {{ gameShortLabel(room.metadata?.gameType) }}
            </span>
            <div class="room-copy">
              <div class="room-title-line">
                <span class="game-badge">{{ gameLabel(room.metadata?.gameType) }}</span>
                <strong class="room-title">{{ room.metadata?.roomName || '방 제목 없음' }}</strong>
              </div>
              <span class="room-info">참여 인원 {{ room.clients }} / {{ room.maxClients }}</span>
            </div>
          </div>
          <span class="room-status" :class="{ full: room.clients >= room.maxClients }">
            {{ room.clients >= room.maxClients ? '정원 마감' : '입장 가능' }}
          </span>
          <button
            type="button"
            @click="joinRoom(room.roomId)"
            :disabled="room.clients >= room.maxClients"
            :aria-label="`${gameLabel(room.metadata?.gameType)} ${room.metadata?.roomName || '방 제목 없음'} 입장하기`"
          >
            {{ room.clients >= room.maxClients ? '가득 참' : '입장하기' }}
          </button>
        </li>
      </ul>
      <button v-if="hasMoreRooms" type="button" class="load-more" @click="visibleRoomLimit += 100">
        방 {{ Math.min(100, filteredRooms.length - displayedRooms.length) }}개 더 보기
      </button>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, onUnmounted, watch } from 'vue';
import GameFilterPicker from './GameFilterPicker.vue';
import {
  DEFAULT_GAME_ID,
  GAME_CATALOG,
  GAME_CATALOG_ISSUES,
  gameLabel,
  gameShortLabel,
  gameTone,
  isSupportedGame,
} from '../games';

const props = defineProps(['colyseusClient', 'playerIdentity']);
const emit = defineEmits(['join-table', 'update-nickname']);

const availableRooms = ref([]);
const nickname = ref(props.playerIdentity?.nickname || '');
const newRoomName = ref('');
const newRoomGame = ref(DEFAULT_GAME_ID);
const selectedFilter = ref('all');
const lobbyError = ref('');
const visibleRoomLimit = ref(100);
let lobbyConnection = null;
let lobbyMetricPending = false;
let pendingMetricSource = 'initial';

const scheduleLobbyMetric = (source) => {
  pendingMetricSource = source;
  if (lobbyMetricPending) return;

  const startedAt = performance.now();
  lobbyMetricPending = true;
  nextTick(() => {
    window.requestAnimationFrame(() => {
      lobbyMetricPending = false;
      console.info(
        JSON.stringify({
          level: 'info',
          event: 'lobby.rooms_rendered',
          source: pendingMetricSource,
          receivedRoomCount: availableRooms.value.length,
          filteredRoomCount: filteredRooms.value.length,
          renderedRoomCount: displayedRooms.value.length,
          durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
        })
      );
    });
  });
};

const roomCountByGame = computed(() => {
  const counts = Object.fromEntries(GAME_CATALOG.map((game) => [game.id, 0]));

  availableRooms.value.forEach((room) => {
    const gameType = room.metadata?.gameType;
    if (isSupportedGame(gameType)) counts[gameType] += 1;
  });

  return counts;
});

const filteredRooms = computed(() => {
  if (selectedFilter.value === 'all') return availableRooms.value;
  return availableRooms.value.filter((room) => room.metadata?.gameType === selectedFilter.value);
});

const displayedRooms = computed(() => filteredRooms.value.slice(0, visibleRoomLimit.value));
const hasMoreRooms = computed(() => displayedRooms.value.length < filteredRooms.value.length);

watch(
  () => GAME_CATALOG.map((game) => game.id).join(','),
  () => {
    if (!isSupportedGame(newRoomGame.value)) {
      newRoomGame.value = GAME_CATALOG[0]?.id || '';
    }
    if (selectedFilter.value !== 'all' && !isSupportedGame(selectedFilter.value)) {
      selectedFilter.value = 'all';
    }
  },
  { immediate: true }
);

watch(selectedFilter, () => {
  visibleRoomLimit.value = 100;
});

watch(
  () => props.playerIdentity?.nickname,
  (value) => {
    if (value && value !== nickname.value) nickname.value = value;
  }
);

const emptyRoomTitle = computed(() =>
  availableRooms.value.length === 0
    ? '아직 열린 테이블이 없습니다.'
    : `${gameLabel(selectedFilter.value)} 방이 없습니다.`
);

const emptyRoomDescription = computed(() =>
  availableRooms.value.length === 0
    ? '첫 테이블을 만들어 친구를 초대해보세요.'
    : '다른 게임을 선택하거나 새 테이블을 만들어보세요.'
);

// props.colyseusClient가 초기화된 후 로비 접속
watch(
  () => props.colyseusClient,
  async (client) => {
    if (client) {
      try {
        lobbyConnection = await client.joinOrCreate('lobby');
        lobbyError.value = '';

        lobbyConnection.onMessage('rooms', (rooms) => {
          availableRooms.value = rooms;
          scheduleLobbyMetric('snapshot');
        });
        lobbyConnection.onMessage('+', ([roomId, room]) => {
          const exists = availableRooms.value.findIndex((r) => r.roomId === roomId);
          if (exists !== -1) availableRooms.value[exists] = room;
          else availableRooms.value.push(room);
          scheduleLobbyMetric(exists === -1 ? 'room_added' : 'room_updated');
        });
        lobbyConnection.onMessage('-', (roomId) => {
          availableRooms.value = availableRooms.value.filter((r) => r.roomId !== roomId);
          scheduleLobbyMetric('room_removed');
        });
      } catch (e) {
        console.error('로비 접속 에러:', e);
        lobbyError.value = '실시간 방 목록에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.';
      }
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  if (lobbyConnection) lobbyConnection.leave();
});

const getPlayerIdentity = () => {
  const normalizedNickname = nickname.value.trim();
  if (!normalizedNickname) {
    lobbyError.value = '방을 만들거나 입장하려면 닉네임을 입력해주세요.';
    return null;
  }

  nickname.value = normalizedNickname;
  emit('update-nickname', normalizedNickname);
  return {
    ...props.playerIdentity,
    nickname: normalizedNickname,
  };
};

const createRoom = async () => {
  if (!newRoomName.value.trim()) {
    return alert('방 제목을 입력하세요!');
  }
  if (!isSupportedGame(newRoomGame.value)) {
    return alert('플레이할 게임을 선택하세요!');
  }
  if (!props.colyseusClient) return;
  const playerIdentity = getPlayerIdentity();
  if (!playerIdentity) return;
  try {
    lobbyError.value = '';
    const connection = await props.colyseusClient.create('table_room', {
      roomName: newRoomName.value.trim(),
      gameType: newRoomGame.value,
      ...playerIdentity,
    });
    emit('join-table', connection); // 부모에게 접속 정보 전달
  } catch (e) {
    console.error('방 생성 에러:', e);
    lobbyError.value = '방을 만들지 못했습니다. 입력 내용과 서버 연결을 확인해주세요.';
  }
};

const joinRoom = async (roomId) => {
  if (!props.colyseusClient) return;
  const playerIdentity = getPlayerIdentity();
  if (!playerIdentity) return;
  try {
    lobbyError.value = '';
    const connection = await props.colyseusClient.joinById(roomId, playerIdentity);
    emit('join-table', connection);
  } catch (e) {
    console.error('방 입장 에러:', e);
    lobbyError.value = '방에 입장하지 못했습니다. 방이 시작되었거나 인원이 가득 찼을 수 있습니다.';
  }
};
</script>

<style scoped>
.lobby-screen {
  display: grid;
  gap: var(--space-8);
}

.lobby-error {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border: 1px solid color-mix(in srgb, var(--color-danger) 35%, transparent);
  border-radius: var(--radius-small);
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 8%, white);
}

.catalog-warning {
  padding: var(--space-3) var(--space-4);
  border: 1px solid color-mix(in srgb, var(--color-warning) 35%, transparent);
  border-radius: var(--radius-small);
  background: color-mix(in srgb, var(--color-warning) 7%, white);
  color: var(--color-ink-soft);
}

.catalog-warning strong {
  display: block;
  margin-bottom: var(--space-1);
}

.catalog-warning ul {
  margin: 0;
  padding-left: var(--space-5);
  color: var(--color-muted);
  font-size: 13px;
}

.load-more {
  display: block;
  min-height: 42px;
  margin: var(--space-4) auto 0;
  padding: 0 var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-ink-soft);
  background: var(--color-surface);
  cursor: pointer;
}

.room-item {
  content-visibility: auto;
  contain-intrinsic-size: 88px;
}

.lobby-heading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: var(--space-8);
}

.eyebrow,
.section-label {
  margin-bottom: var(--space-3);
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.09em;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-success);
  box-shadow: 0 0 0 4px rgba(26, 174, 57, 0.1);
}

.lobby-heading h1 {
  max-width: 720px;
  margin-bottom: var(--space-4);
  font-size: clamp(34px, 5vw, 56px);
  line-height: 1.04;
  letter-spacing: -0.045em;
}

.lobby-description {
  max-width: 58ch;
  margin-bottom: 0;
  color: var(--color-muted);
  font-size: clamp(16px, 2vw, 19px);
  line-height: 1.55;
}

.nickname-setting {
  width: min(100%, 480px);
  display: grid;
  grid-template-columns: auto minmax(160px, 1fr) auto;
  align-items: center;
  gap: var(--space-2) var(--space-3);
  margin-top: var(--space-5);
}

.nickname-setting label {
  color: var(--color-ink-soft);
  font-size: 13px;
  font-weight: 700;
}

.nickname-setting input {
  min-height: 40px;
  font-size: 14px;
}

.nickname-setting span {
  color: var(--color-muted);
  font-size: 12px;
  white-space: nowrap;
}

.room-count {
  min-width: 160px;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-small);
  background: var(--color-surface);
}

.room-count strong,
.room-count span {
  display: block;
}

.room-count strong {
  font-size: 24px;
  line-height: 1.1;
}

.room-count span {
  margin-top: var(--space-1);
  color: var(--color-muted);
  font-size: 13px;
}

.create-panel,
.room-panel {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.create-panel {
  display: grid;
  grid-template-columns: minmax(220px, 0.7fr) minmax(320px, 1.3fr);
  align-items: end;
  gap: var(--space-8);
  padding: var(--space-6);
}

.section-copy h2,
.room-panel-header h2 {
  margin-bottom: 0;
  font-size: clamp(21px, 3vw, 27px);
  line-height: 1.2;
}

.room-controls {
  display: grid;
  grid-template-columns: minmax(160px, 0.65fr) minmax(220px, 1.35fr) auto;
  align-items: end;
  gap: var(--space-2);
}

.control-field {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.field-label {
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 700;
}

input,
select {
  flex: 1;
  min-width: 0;
  min-height: 46px;
  padding: 0 var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 16px;
}

input::placeholder {
  color: var(--color-meta);
}

input:focus,
select:focus {
  border-color: var(--color-primary);
}

button {
  min-height: 46px;
  padding: 0 var(--space-5);
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  background: var(--color-primary);
  color: white;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  transition:
    background 150ms ease,
    transform 150ms ease;
}

button:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

button:active:not(:disabled) {
  transform: scale(0.98);
}

button:disabled {
  background: var(--color-surface-muted);
  color: var(--color-meta);
  border-color: var(--color-border);
}

.create-button {
  min-width: 104px;
}

.room-panel {
  overflow: visible;
}

.room-panel-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--color-border-soft);
  border-radius: var(--radius-panel) var(--radius-panel) 0 0;
  background: var(--color-surface-muted);
}

.room-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.auto-refresh {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-pill);
  background: #f2f9ff;
  color: var(--color-focus);
  font-size: 12px;
  font-weight: 700;
}

.room-list {
  list-style: none;
  overflow: hidden;
  padding: 0;
  margin: 0;
  border-radius: 0 0 var(--radius-panel) var(--radius-panel);
}

.room-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 112px;
  align-items: center;
  gap: var(--space-5);
  min-height: 88px;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--color-border-soft);
  transition: background 150ms ease;
}

.room-item:hover {
  background: rgba(246, 245, 244, 0.58);
}

.room-item:last-child {
  border-bottom: none;
}

.room-main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.room-copy {
  min-width: 0;
}

.room-icon {
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-small);
  background: var(--game-surface);
  color: var(--game-color);
  font-size: 12px;
  font-weight: 800;
}

.room-title-line {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.game-badge {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  color: var(--color-muted);
  font-size: 11px;
  font-weight: 700;
}

.room-title {
  display: block;
  overflow: hidden;
  color: var(--color-ink);
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-info {
  display: block;
  margin-top: var(--space-1);
  color: var(--color-muted);
  font-size: 13px;
}

.room-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-success);
  font-size: 12px;
  font-weight: 700;
}

.room-status::before {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  content: '';
}

.room-status.full {
  color: var(--color-meta);
}

.empty {
  min-height: 220px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: var(--space-2);
  padding: var(--space-8);
  color: var(--color-muted);
  text-align: center;
}

.empty strong {
  color: var(--color-ink);
  font-size: 18px;
}

@media (max-width: 980px) {
  .room-panel-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .room-toolbar {
    width: 100%;
    align-items: flex-start;
    justify-content: space-between;
  }
}

@media (max-width: 760px) {
  .lobby-heading,
  .create-panel {
    grid-template-columns: 1fr;
  }

  .room-count {
    width: fit-content;
  }

  .create-panel,
  .room-panel-header,
  .room-item {
    padding-left: var(--space-4);
    padding-right: var(--space-4);
  }

  .room-item {
    grid-template-columns: minmax(0, 1fr) 104px;
  }

  .room-controls {
    grid-template-columns: minmax(140px, 0.7fr) minmax(0, 1.3fr);
  }

  .create-button {
    grid-column: 1 / -1;
  }

  .room-status {
    display: none;
  }
}

@media (max-width: 520px) {
  .lobby-screen {
    gap: var(--space-6);
  }

  .lobby-heading h1 {
    font-size: 34px;
  }

  .nickname-setting {
    grid-template-columns: 1fr;
  }

  .nickname-setting span {
    margin-top: calc(var(--space-1) * -1);
    white-space: normal;
  }

  .create-panel {
    gap: var(--space-5);
  }

  .room-controls {
    grid-template-columns: 1fr;
  }

  .create-button {
    grid-column: auto;
    width: 100%;
  }

  .room-panel-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .room-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .auto-refresh {
    width: fit-content;
  }

  .room-title-line {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-1);
  }

  .room-item {
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }

  .room-item > button {
    width: 100%;
  }
}
</style>
