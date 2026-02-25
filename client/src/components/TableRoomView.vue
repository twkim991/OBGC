<template>
  <div class="table-screen">
    <div class="header">
      <h1>☕ 테이블 대기실</h1>
      <button @click="leave" class="leave-btn">로비로 나가기</button>
    </div>

    <div v-if="isHost" class="host-controls">
      <h3>👑 방장 권한</h3>
      <div class="game-select">
        <select v-model="selectedGame">
          <option value="yutnori">윷놀이</option>
          <option value="onecard">원카드</option>
        </select>
        <button @click="startGame" class="start-btn">선택한 게임 시작!</button>
      </div>
    </div>

    <div class="chat-container">
      <div class="chat-box" ref="chatBox">
        <div v-for="(msg, index) in messages" :key="index" class="message">
          <strong :class="{ system: msg.clientId === 'System' }">{{ msg.clientId }}:</strong>
          {{ msg.message }}
        </div>
      </div>
      <form @submit.prevent="sendMessage" class="input-area">
        <input v-model="inputMessage" placeholder="메시지를 입력하세요..." />
        <button type="submit">전송</button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';

const props = defineProps(['tableConnection']);
const emit = defineEmits(['leave-table', 'move-to-game']);

const isHost = ref(false);
const selectedGame = ref('yutnori');
const messages = ref([]);
const inputMessage = ref('');
const chatBox = ref(null);

onMounted(() => {
  if (props.tableConnection) {
    setupListeners();
  }
});

const setupListeners = () => {
  const connection = props.tableConnection;

  // 내 상태 확인 (방장 여부)
  connection.onStateChange((state) => {
    const me = state.players.get(connection.sessionId);
    if (me) isHost.value = me.isHost;
  });

  // 채팅 수신
  connection.onMessage('chat', (data) => {
    messages.value.push(data);
    scrollToBottom();
  });

  // 🔥 서버로부터 강제 이주 명령 수신 (App.vue로 이벤트 전달)
  connection.onMessage('move_room', (data) => {
    emit('move-to-game', data);
  });
};

const startGame = () => {
  if (props.tableConnection && isHost.value) {
    props.tableConnection.send('start_game', selectedGame.value);
  }
};

const sendMessage = () => {
  if (!inputMessage.value.trim() || !props.tableConnection) return;
  props.tableConnection.send('chat', inputMessage.value);
  inputMessage.value = '';
};

const leave = () => {
  emit('leave-table');
};

const scrollToBottom = async () => {
  await nextTick();
  if (chatBox.value) {
    chatBox.value.scrollTop = chatBox.value.scrollHeight;
  }
};
</script>

<style scoped>
/* 대기실 전용 스타일 */
.table-screen {
  background: white;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.leave-btn {
  background: #e74c3c;
  padding: 10px 20px;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.host-controls {
  background: #fdfae6;
  border: 2px solid #f1c40f;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}
.game-select {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}
select {
  flex: 1;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid #ddd;
}
.start-btn {
  background: #f39c12;
  color: white;
  font-weight: bold;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
}
.chat-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.chat-box {
  height: 350px;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 15px;
  overflow-y: auto;
  background: #fafafa;
}
.message {
  margin-bottom: 8px;
  line-height: 1.4;
}
.system {
  color: #8e44ad;
  font-weight: bold;
}
.input-area {
  display: flex;
  gap: 10px;
}
input {
  flex: 1;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
}
button[type='submit'] {
  background: #2ecc71;
  color: white;
  border: none;
  padding: 0 25px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}
</style>
