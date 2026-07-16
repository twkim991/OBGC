<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-header-inner">
        <div class="app-brand" aria-label="OBGC 온라인 보드게임 카페">
          <span class="app-brand-mark" aria-hidden="true">OB</span>
          <span>
            <strong>OBGC</strong>
            <small>온라인 보드게임 카페</small>
          </span>
        </div>
        <div class="connection-status" aria-live="polite">
          <span class="connection-dot" :class="{ ready: colyseusClient }" aria-hidden="true"></span>
          {{ colyseusClient ? '게임 서버 준비됨' : '게임 서버 연결 중' }}
        </div>
      </div>
    </header>

    <main class="app-container">
      <div v-if="migrationError" class="app-alert" role="alert">
        <span>{{ migrationError }}</span>
        <button type="button" @click="migrationError = ''">닫기</button>
      </div>

      <LobbyView
        v-if="currentView === 'lobby'"
        :colyseusClient="colyseusClient"
        :playerIdentity="playerIdentity"
        @join-table="handleJoinTable"
        @update-nickname="handleNicknameUpdate"
      />

      <TableRoomView
        v-else-if="currentView === 'table'"
        :key="roomConnection?.sessionId"
        :tableConnection="roomConnection"
        @leave-table="handleLeaveRoom"
        @move-to-game="handleMoveToGame"
      />

      <component
        v-else-if="currentView === 'game' && currentGameComponent"
        :key="roomConnection?.sessionId"
        :is="currentGameComponent"
        :gameConnection="roomConnection"
        @leave-game="handleLeaveRoom"
        @move-to-game="handleMoveToGame"
      />

      <section v-else-if="currentView === 'game'" class="unsupported-game" role="alert">
        <p class="eyebrow">UNSUPPORTED GAME</p>
        <h1>이 게임 화면을 불러올 수 없습니다.</h1>
        <p>클라이언트를 새로고침하거나 로비로 돌아가 다시 시도해주세요.</p>
        <button type="button" @click="handleLeaveRoom">로비로 돌아가기</button>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted, computed, defineAsyncComponent } from 'vue';
import * as Colyseus from 'colyseus.js';

import LobbyView from './components/LobbyView.vue';
import TableRoomView from './components/TableRoomView.vue';
import GameLoadError from './components/games/shared/GameLoadError.vue';
import GameLoading from './components/games/shared/GameLoading.vue';
import {
  CLIENT_PROTOCOL_VERSIONS,
  GAME_CATALOG,
  loadGameCatalog,
} from './games';

const games = Object.fromEntries(
  GAME_CATALOG.map((game) => [
    game.id,
    defineAsyncComponent({
      loader: game.loadView,
      loadingComponent: GameLoading,
      errorComponent: GameLoadError,
      delay: 120,
      timeout: 10000,
    }),
  ])
);

const createPlayerId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const storedPlayerId = localStorage.getItem('obgc.playerId') || createPlayerId();
const storedNickname =
  localStorage.getItem('obgc.nickname') || `플레이어 ${storedPlayerId.slice(0, 4).toUpperCase()}`;

localStorage.setItem('obgc.playerId', storedPlayerId);
localStorage.setItem('obgc.nickname', storedNickname);

const playerNickname = ref(storedNickname);
const playerIdentity = computed(() => ({
  playerId: storedPlayerId,
  nickname: playerNickname.value,
  protocolVersions: CLIENT_PROTOCOL_VERSIONS,
}));

const handleNicknameUpdate = (nickname) => {
  playerNickname.value = nickname;
  localStorage.setItem('obgc.nickname', nickname);
};

const currentView = ref('lobby'); // 'lobby', 'table', 'game'
const currentGameType = ref('');
const colyseusClient = shallowRef(null);
const roomConnection = shallowRef(null);
const migrationError = ref('');
let migrationInProgress = false;
let migrationCancelled = false;
let pendingMigrationRoom = null;

const currentGameComponent = computed(() => games[currentGameType.value] || null);
const MIGRATION_TIMEOUT_MS = 27000;

const waitForMigrationReady = (candidateRoom) =>
  new Promise((resolve, reject) => {
    let settled = false;
    let removeAbortListener = null;

    const cleanup = () => {
      clearTimeout(timeoutId);
      candidateRoom.onStateChange.remove(handleStateChange);
      candidateRoom.onLeave.remove(handleCandidateLeave);
      if (typeof removeAbortListener === 'function') removeAbortListener();
    };
    const finish = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(candidateRoom);
    };
    const handleStateChange = (state) => {
      if (state?.migrationReady) finish();
    };
    const handleCandidateLeave = () => {
      finish(new Error('새 방이 이동 준비 중 종료되었습니다.'));
    };
    const timeoutId = setTimeout(() => {
      finish(new Error('방 이동 준비 시간이 초과되었습니다.'));
    }, MIGRATION_TIMEOUT_MS);

    candidateRoom.onStateChange(handleStateChange);
    candidateRoom.onLeave(handleCandidateLeave);
    removeAbortListener = candidateRoom.onMessage('migration_aborted', (data) => {
      finish(new Error(data?.message || '방 이동이 취소되었습니다.'));
    });

    handleStateChange(candidateRoom.state);
  });

onMounted(async () => {
  const socketProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const endpoint = import.meta.env.DEV ? 'ws://localhost:8002' : `${socketProtocol}//${window.location.host}`;

  try {
    await loadGameCatalog();
  } catch (error) {
    console.error('게임 카탈로그 로드 실패:', error);
    migrationError.value = GAME_CATALOG.length
      ? '게임 목록을 갱신하지 못해 기본 목록을 사용합니다.'
      : '현재 서버와 호환되는 게임이 없습니다. 클라이언트를 업데이트해주세요.';
  }

  colyseusClient.value = new Colyseus.Client(endpoint);
});

// 로비에서 방에 접속했을 때 (대기실 진입)
const handleJoinTable = (connection) => {
  roomConnection.value = connection;
  bindRoomLifecycle(connection);
  currentView.value = 'table';
};

const bindRoomLifecycle = (room) => {
  const roomId = room.id;
  const sessionId = room.sessionId;

  room.onLeave(async (code) => {
    if (code === 4000 || roomConnection.value !== room) return;

    migrationError.value = '서버 연결을 복구하고 있습니다.';
    try {
      const reconnectedRoom = await colyseusClient.value.reconnect(roomId, sessionId);
      if (roomConnection.value !== room) {
        reconnectedRoom.leave();
        return;
      }

      roomConnection.value = reconnectedRoom;
      bindRoomLifecycle(reconnectedRoom);
      migrationError.value = '';
    } catch (error) {
      console.error('방 재연결 실패:', error);
      if (roomConnection.value === room) {
        roomConnection.value = null;
        currentView.value = 'lobby';
        migrationError.value = '방 연결이 종료되어 로비로 이동했습니다.';
      }
    }
  });
};

// 방(대기실 또는 게임방)에서 나갈 때
const handleLeaveRoom = () => {
  migrationCancelled = true;
  if (pendingMigrationRoom) {
    pendingMigrationRoom.leave();
    pendingMigrationRoom = null;
  }
  if (roomConnection.value) {
    roomConnection.value.leave();
    roomConnection.value = null;
  }
  currentView.value = 'lobby';
};

// 🔥 강제 이주 신호를 받았을 때 (대기실 가기 & 게임하러 가기 둘 다 처리!)
const handleMoveToGame = async (data) => {
  if (migrationInProgress) return;
  migrationInProgress = true;
  migrationCancelled = false;
  const previousRoom = roomConnection.value;
  let nextRoom = null;
  migrationError.value = '';

  try {
    if (!data?.reservation) throw new Error('좌석 예약 정보가 없습니다.');

    // 새 방 참가가 확인된 뒤에만 기존 방 연결을 종료한다.
    nextRoom = await colyseusClient.value.consumeSeatReservation(data.reservation);
    pendingMigrationRoom = nextRoom;
    await waitForMigrationReady(nextRoom);
    if (migrationCancelled) throw new Error('방 이동이 취소되었습니다.');
    const roomToLeave = roomConnection.value;
    roomConnection.value = nextRoom;
    bindRoomLifecycle(nextRoom);

    // 서버에서 보내준 gameType에 따라 화면 분기 처리
    if (data.gameType === 'table') {
      currentView.value = 'table'; // 🔥 대기실 화면으로 컴백!
    } else {
      currentGameType.value = data.gameType;
      currentView.value = 'game'; // 기존처럼 게임 화면으로 진입
    }

    if (roomToLeave && roomToLeave !== nextRoom) {
      roomToLeave.leave();
    }
  } catch (error) {
    console.error('방 이주 실패:', error);
    if (nextRoom) nextRoom.leave();
    if (migrationCancelled) {
      roomConnection.value = null;
      currentView.value = 'lobby';
      return;
    }
    if (!roomConnection.value || roomConnection.value === nextRoom) {
      roomConnection.value = previousRoom;
    }
    migrationError.value =
      error?.message || '새 방에 참가하지 못했습니다. 현재 방에서 다시 시도해주세요.';
  } finally {
    pendingMigrationRoom = null;
    migrationInProgress = false;
  }
};
</script>

<style>
:root {
  font-family:
    Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', Helvetica, Arial,
    sans-serif;
  color: rgba(0, 0, 0, 0.95);
  background: #f6f5f4;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;

  --color-canvas: #f6f5f4;
  --color-surface: #ffffff;
  --color-surface-muted: #f6f5f4;
  --color-ink: rgba(0, 0, 0, 0.95);
  --color-ink-soft: #31302e;
  --color-muted: #615d59;
  --color-meta: #8f8984;
  --color-border: rgba(0, 0, 0, 0.1);
  --color-border-soft: rgba(0, 0, 0, 0.06);
  --color-primary: #0075de;
  --color-primary-hover: #005bab;
  --color-focus: #097fe8;
  --color-success: #1aae39;
  --color-warning: #dd5b00;
  --color-danger: #c9362b;
  --color-purple: #6d4aff;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  --radius-control: 4px;
  --radius-small: 8px;
  --radius-panel: 12px;
  --radius-large: 16px;
  --radius-pill: 9999px;

  --shadow-card:
    rgba(0, 0, 0, 0.04) 0 4px 18px, rgba(0, 0, 0, 0.027) 0 2px 8px,
    rgba(0, 0, 0, 0.02) 0 1px 3px;
  --focus-ring: 0 0 0 3px rgba(9, 127, 232, 0.28);
}

* {
  box-sizing: border-box;
}

html {
  min-width: 320px;
  min-height: 100%;
  background: var(--color-canvas);
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: var(--color-canvas);
  color: var(--color-ink);
}

button,
input,
select {
  font: inherit;
}

button,
input,
select,
[role='button'] {
  -webkit-tap-highlight-color: transparent;
}

button:focus-visible,
input:focus-visible,
select:focus-visible,
[role='button']:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

button:disabled {
  cursor: not-allowed;
}

h1,
h2,
h3,
h4,
p {
  margin-top: 0;
}

h1,
h2,
h3,
h4 {
  color: var(--color-ink);
  letter-spacing: -0.025em;
  text-wrap: balance;
}

p {
  text-wrap: pretty;
}

.app-shell {
  min-height: 100vh;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid var(--color-border-soft);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(16px);
}

.app-header-inner {
  width: min(calc(100% - 48px), 1180px);
  min-height: 68px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.app-brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
}

.app-brand-mark {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-small);
  background: var(--color-ink);
  color: white;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.app-brand strong,
.app-brand small {
  display: block;
}

.app-brand strong {
  font-size: 15px;
  line-height: 1.2;
}

.app-brand small {
  margin-top: 2px;
  color: var(--color-muted);
  font-size: 12px;
}

.connection-status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 600;
}

.connection-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-meta);
}

.connection-dot.ready {
  background: var(--color-success);
  box-shadow: 0 0 0 4px rgba(26, 174, 57, 0.1);
}

.app-container {
  width: min(calc(100% - 48px), 1180px);
  margin: 0 auto;
  padding: var(--space-10) 0 var(--space-12);
}

.app-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
  padding: var(--space-3) var(--space-4);
  border: 1px solid color-mix(in srgb, var(--color-danger) 35%, transparent);
  border-radius: var(--radius-small);
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 8%, white);
}

.app-alert button,
.unsupported-game button {
  min-height: 36px;
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-control);
  color: white;
  background: var(--color-primary);
  cursor: pointer;
}

.unsupported-game {
  padding: var(--space-10);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
}

.unsupported-game p:not(.eyebrow) {
  margin: var(--space-3) 0 var(--space-6);
  color: var(--color-muted);
}

@media (max-width: 700px) {
  .app-header-inner,
  .app-container {
    width: min(calc(100% - 24px), 1180px);
  }

  .app-header-inner {
    min-height: 60px;
  }

  .app-brand small,
  .connection-status {
    font-size: 11px;
  }

  .app-container {
    padding-top: var(--space-6);
  }
}

@media (max-width: 430px) {
  .app-brand small {
    display: none;
  }

  .connection-status {
    max-width: 120px;
    justify-content: flex-end;
    text-align: right;
  }
}
</style>
