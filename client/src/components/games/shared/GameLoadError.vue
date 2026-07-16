<template>
  <section class="game-state-card" role="alert">
    <p class="eyebrow">GAME LOAD ERROR</p>
    <h1>게임 화면을 불러오지 못했습니다.</h1>
    <p>네트워크 상태를 확인한 뒤 로비에서 다시 입장해주세요.</p>
    <button type="button" @click="$emit('leave-game')">로비로 돌아가기</button>
  </section>
</template>

<script setup>
defineEmits(['leave-game']);
</script>

<style scoped>
.game-state-card {
  min-height: 360px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: var(--space-3);
  padding: var(--space-8);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  text-align: center;
}

.game-state-card h1,
.game-state-card p {
  margin: 0;
}

.game-state-card > p:last-of-type {
  color: var(--color-muted);
}

button {
  min-height: 44px;
  margin-top: var(--space-3);
  padding: 0 var(--space-5);
  border: 0;
  border-radius: var(--radius-control);
  background: var(--color-primary);
  color: white;
  cursor: pointer;
  font-weight: 700;
}
</style>
