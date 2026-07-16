<template>
  <aside class="chat-panel" aria-labelledby="game-chat-title">
    <div class="panel-heading">
      <h2 id="game-chat-title">테이블 채팅</h2>
      <span>{{ messages.length }}개</span>
    </div>
    <div ref="chatLog" class="chat-log" role="log" aria-live="polite">
      <p v-if="!messages.length" class="chat-empty">첫 메시지를 보내 대화를 시작해보세요.</p>
      <p v-for="(message, index) in messages" :key="index" class="message-row">
        <strong :class="{ system: message.clientId === 'System' }">{{ message.clientId }}</strong>
        <span>{{ message.message }}</span>
      </p>
    </div>
    <form class="chat-form" @submit.prevent="submit">
      <input v-model="draft" maxlength="300" aria-label="채팅 메시지" placeholder="메시지를 입력하세요" />
      <button type="submit">전송</button>
    </form>
  </aside>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';

const props = defineProps({ messages: { type: Array, required: true } });
const emit = defineEmits(['send']);
const draft = ref('');
const chatLog = ref(null);

watch(
  () => props.messages.length,
  async () => {
    await nextTick();
    if (chatLog.value) chatLog.value.scrollTop = chatLog.value.scrollHeight;
  }
);

function submit() {
  const message = draft.value.trim();
  if (!message) return;
  emit('send', message);
  draft.value = '';
}
</script>

<style scoped>
.chat-panel {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.panel-heading h2 { font-size: 18px; }
.panel-heading span, .chat-empty { color: var(--color-muted); font-size: 12px; }

.chat-log {
  min-height: 240px;
  max-height: 440px;
  overflow-y: auto;
}

.message-row {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border-soft);
  font-size: 13px;
}

.message-row strong.system { color: var(--color-primary); }

.chat-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.chat-form input {
  min-width: 0;
  min-height: 40px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}

.chat-form button {
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-control);
  color: white;
  background: var(--color-primary);
}
</style>
