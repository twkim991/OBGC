<template>
  <div class="table-screen">
    <div class="header">
      <div>
        <p class="eyebrow">WAITING TABLE</p>
        <h1>테이블 대기실</h1>
        <p class="header-description">게임을 선택하고 함께할 사람들과 준비하세요.</p>
      </div>
      <button @click="leave" class="leave-btn">로비로 나가기</button>
    </div>

    <section v-if="isHost" class="host-controls">
      <div class="host-heading">
        <span class="host-badge">방장</span>
        <div>
          <h2>플레이할 게임을 선택하세요.</h2>
          <p>시작하면 테이블의 모든 참여자가 게임방으로 이동합니다.</p>
        </div>
      </div>
      <div class="game-select">
        <select v-model="selectedGame" aria-label="게임 선택">
          <option value="yutnori">윷놀이</option>
          <option value="onecard">원카드</option>
        </select>
        <button @click="startGame" class="start-btn">선택한 게임 시작</button>
      </div>
    </section>

    <section v-else class="guest-notice">
      <span class="guest-badge">참여자</span>
      <p>방장이 게임을 선택하고 있습니다. 채팅하며 잠시 기다려주세요.</p>
    </section>

    <section class="chat-container" aria-labelledby="table-chat-title">
      <div class="chat-heading">
        <div>
          <p class="section-label">실시간 대화</p>
          <h2 id="table-chat-title">테이블 채팅</h2>
        </div>
        <span>{{ messages.length }}개의 메시지</span>
      </div>
      <div class="chat-box" ref="chatBox" aria-live="polite">
        <div v-if="messages.length === 0" class="chat-empty">
          첫 메시지를 보내 대화를 시작해보세요.
        </div>
        <div v-for="(msg, index) in messages" :key="index" class="message">
          <strong :class="{ system: msg.clientId === 'System' }">{{ msg.clientId }}</strong>
          <span>{{ msg.message }}</span>
        </div>
      </div>
      <form @submit.prevent="sendMessage" class="input-area">
        <input v-model="inputMessage" aria-label="채팅 메시지" placeholder="메시지를 입력하세요" />
        <button type="submit">전송</button>
      </form>
    </section>
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
.table-screen {
  display: grid;
  gap: var(--space-6);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-6);
}

.eyebrow,
.section-label {
  margin-bottom: var(--space-2);
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.09em;
}

.header h1 {
  margin-bottom: var(--space-2);
  font-size: clamp(34px, 5vw, 52px);
  line-height: 1.04;
  letter-spacing: -0.045em;
}

.header-description {
  margin-bottom: 0;
  color: var(--color-muted);
  font-size: 17px;
}

.leave-btn {
  min-height: 44px;
  flex: 0 0 auto;
  padding: 0 var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-danger);
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
}

.leave-btn:hover {
  background: #fff7f6;
  border-color: rgba(201, 54, 43, 0.28);
}

.host-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.8fr);
  align-items: end;
  gap: var(--space-8);
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.host-heading {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.host-heading h2 {
  margin-bottom: var(--space-2);
  font-size: 23px;
}

.host-heading p {
  margin-bottom: 0;
  color: var(--color-muted);
  line-height: 1.55;
}

.host-badge,
.guest-badge {
  display: inline-flex;
  min-height: 26px;
  align-items: center;
  padding: 0 9px;
  border-radius: var(--radius-pill);
  background: #f2f9ff;
  color: var(--color-focus);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.game-select {
  display: flex;
  gap: var(--space-2);
}

select {
  flex: 1;
  min-width: 0;
  min-height: 46px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-ink);
}

select:focus {
  border-color: var(--color-primary);
}

.start-btn {
  min-height: 46px;
  padding: 0 var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  background: var(--color-primary);
  color: white;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
}

.start-btn:hover {
  background: var(--color-primary-hover);
}

.guest-notice {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-small);
  background: var(--color-surface-muted);
}

.guest-notice p {
  margin: 0;
  color: var(--color-muted);
}

.guest-badge {
  background: rgba(0, 0, 0, 0.05);
  color: var(--color-ink-soft);
}

.chat-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-height: 500px;
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.chat-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
}

.chat-heading h2 {
  margin-bottom: 0;
  font-size: 23px;
}

.chat-heading > span {
  color: var(--color-meta);
  font-size: 12px;
}

.chat-box {
  flex: 1;
  min-height: 320px;
  max-height: 480px;
  padding: var(--space-4);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-small);
  overflow-y: auto;
  background: var(--color-surface-muted);
  scrollbar-color: var(--color-meta) transparent;
}

.message {
  display: grid;
  grid-template-columns: minmax(90px, 0.25fr) minmax(0, 1fr);
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border-soft);
  line-height: 1.5;
}

.message:last-child {
  border-bottom: 0;
}

.message strong {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
}

.system {
  color: var(--color-focus);
}

.chat-empty {
  min-height: 100%;
  display: grid;
  place-items: center;
  color: var(--color-meta);
  text-align: center;
}

.input-area {
  display: flex;
  gap: var(--space-2);
}

input {
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

input:focus {
  border-color: var(--color-primary);
}

button[type='submit'] {
  min-width: 76px;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  background: var(--color-ink);
  color: white;
  cursor: pointer;
  font-weight: 700;
}

button[type='submit']:hover {
  background: var(--color-ink-soft);
}

@media (max-width: 820px) {
  .host-controls {
    grid-template-columns: 1fr;
    gap: var(--space-5);
  }
}

@media (max-width: 600px) {
  .header {
    flex-direction: column;
  }

  .leave-btn {
    align-self: stretch;
  }

  .host-controls,
  .chat-container {
    padding: var(--space-4);
  }

  .host-heading {
    flex-direction: column;
  }

  .game-select,
  .input-area {
    flex-direction: column;
  }

  .game-select button,
  .input-area button {
    width: 100%;
    min-height: 46px;
  }

  .message {
    grid-template-columns: 1fr;
    gap: var(--space-1);
  }
}
</style>
