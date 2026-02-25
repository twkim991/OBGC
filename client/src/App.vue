<template>
  <div class="app-container">
    <LobbyView
      v-if="currentView === 'lobby'"
      :colyseusClient="colyseusClient"
      @join-table="handleJoinTable"
    />

    <TableRoomView
      v-else-if="currentView === 'table'"
      :tableConnection="roomConnection"
      @leave-table="handleLeaveRoom"
      @move-to-game="handleMoveToGame"
    />

    <component
      v-else-if="currentView === 'game'"
      :is="currentGameComponent"
      :gameConnection="roomConnection"
      @leave-game="handleLeaveRoom"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, defineAsyncComponent } from 'vue';
import * as Colyseus from 'colyseus.js';

import LobbyView from './components/LobbyView.vue';
import TableRoomView from './components/TableRoomView.vue';

// 동적 컴포넌트 로딩 (게임이 추가될 때마다 여기에 등록)
const games = {
  yutnori: defineAsyncComponent(() => import('./components/games/YutnoriView.vue')),
  onecard: defineAsyncComponent(() => import('./components/games/OneCardView.vue')),
};

const currentView = ref('lobby'); // 'lobby', 'table', 'game'
const currentGameType = ref('');
const colyseusClient = ref(null);
const roomConnection = ref(null);

const currentGameComponent = computed(() => games[currentGameType.value] || null);

onMounted(() => {
  const endpoint = import.meta.env.DEV ? 'ws://localhost:3000' : `ws://${window.location.host}`;
  colyseusClient.value = new Colyseus.Client(endpoint);
});

// 로비에서 방에 접속했을 때 (대기실 진입)
const handleJoinTable = (connection) => {
  roomConnection.value = connection;
  currentView.value = 'table';
};

// 방(대기실 또는 게임방)에서 나갈 때
const handleLeaveRoom = () => {
  if (roomConnection.value) {
    roomConnection.value.leave();
    roomConnection.value = null;
  }
  currentView.value = 'lobby';
};

// 강제 이주(게임 시작) 신호를 받았을 때
const handleMoveToGame = async (data) => {
  if (roomConnection.value) {
    roomConnection.value.leave(); // 기존 대기실 연결 종료
  }

  try {
    roomConnection.value = await colyseusClient.value.joinById(data.roomId);
    currentGameType.value = data.gameType;
    currentView.value = 'game';
  } catch (error) {
    console.error('게임방 이주 실패:', error);
    handleLeaveRoom(); // 실패 시 로비로 복귀
  }
};
</script>

<style>
/* 전역 스타일 (reset 등) */
body {
  margin: 0;
  padding: 0;
  background-color: #f4f4f9;
}
.app-container {
  max-width: 800px;
  margin: 40px auto;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}
</style>
