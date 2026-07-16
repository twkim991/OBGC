<template>
  <aside class="activity-panel" :aria-labelledby="titleId">
    <div class="panel-heading">
      <h2 :id="titleId">{{ title }}</h2>
      <span>실시간</span>
    </div>
    <div class="activity-log" role="log" aria-live="polite">
      <p v-if="!messages.length" class="empty-activity">아직 기록이 없습니다.</p>
      <p v-for="(message, index) in messages" :key="index" class="activity-line">
        <strong>{{ message.clientId }}</strong>
        <span>{{ message.message }}</span>
      </p>
    </div>
    <p v-if="note" class="rule-note">{{ note }}</p>
  </aside>
</template>

<script setup>
defineProps({
  messages: { type: Array, required: true },
  title: { type: String, default: '테이블 기록' },
  titleId: { type: String, default: 'activity-title' },
  note: { type: String, default: '' },
});
</script>

<style scoped>
.activity-panel {
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
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.panel-heading h2 {
  font-size: 18px;
}

.panel-heading span {
  color: var(--color-muted);
  font-size: 12px;
}

.activity-log {
  min-height: 180px;
  max-height: 440px;
  overflow-y: auto;
}

.activity-line {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border-soft);
  font-size: 13px;
}

.activity-line span,
.empty-activity,
.rule-note {
  color: var(--color-muted);
}

.rule-note {
  margin-top: auto;
  padding-top: var(--space-4);
  font-size: 12px;
  line-height: 1.6;
}
</style>
