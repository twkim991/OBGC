<template>
  <div class="lobby-screen">
    <h1>🎲 보드게임 카페 로비</h1>
    <div class="room-controls">
      <input v-model="newRoomName" placeholder="방 제목 입력..." @keyup.enter="createRoom" />
      <button @click="createRoom">방 만들기</button>
    </div>

    <h2>현재 열려있는 테이블</h2>
    <ul class="room-list">
      <li v-if="availableRooms.length === 0" class="empty">현재 열려있는 방이 없습니다.</li>
      <li v-for="room in availableRooms" :key="room.roomId" class="room-item">
        <span class="room-title">{{ room.metadata?.roomName || '방 제목 없음' }}</span>
        <span class="room-info">({{ room.clients }} / {{ room.maxClients }})</span>
        <button @click="joinRoom(room.roomId)" :disabled="room.clients >= room.maxClients">
          입장하기
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps(['colyseusClient']);
const emit = defineEmits(['join-table']);

const availableRooms = ref([]);
const newRoomName = ref('');
let lobbyConnection = null;

// props.colyseusClient가 초기화된 후 로비 접속
watch(
  () => props.colyseusClient,
  async (client) => {
    if (client) {
      try {
        lobbyConnection = await client.joinOrCreate('lobby');

        lobbyConnection.onMessage('rooms', (rooms) => (availableRooms.value = rooms));
        lobbyConnection.onMessage('+', ([roomId, room]) => {
          const exists = availableRooms.value.findIndex((r) => r.roomId === roomId);
          if (exists !== -1) availableRooms.value[exists] = room;
          else availableRooms.value.push(room);
        });
        lobbyConnection.onMessage('-', (roomId) => {
          availableRooms.value = availableRooms.value.filter((r) => r.roomId !== roomId);
        });
      } catch (e) {
        console.error('로비 접속 에러:', e);
      }
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  if (lobbyConnection) lobbyConnection.leave();
});

const createRoom = async () => {
  if (!newRoomName.value.trim()) {
    return alert('방 제목을 입력하세요!');
  }
  if (!props.colyseusClient) return;
  try {
    const connection = await props.colyseusClient.create('table_room', {
      roomName: newRoomName.value,
    });
    emit('join-table', connection); // 부모에게 접속 정보 전달
  } catch (e) {
    console.error('방 생성 에러:', e);
  }
};

const joinRoom = async (roomId) => {
  if (!props.colyseusClient) return;
  try {
    const connection = await props.colyseusClient.joinById(roomId);
    emit('join-table', connection);
  } catch (e) {
    console.error('방 입장 에러:', e);
  }
};
</script>

<style scoped>
/* 로비 전용 스타일 */
.lobby-screen {
  background: white;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
.room-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
}
input {
  flex: 1;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
}
button {
  padding: 12px 24px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
}
button:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}
.room-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.room-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid #eee;
}
.room-item:last-child {
  border-bottom: none;
}
.room-title {
  font-weight: bold;
  font-size: 1.1em;
}
</style>
