<template>
  <section class="game-state-card" role="status" aria-live="polite">
    <p class="eyebrow">LOADING GAME</p>
    <h1>게임 화면을 준비하고 있습니다.</h1>
    <p>잠시만 기다려주세요.</p>
  </section>
</template>

<style scoped>
.game-state-card {
  min-height: 360px;
  display: grid;
  place-content: center;
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

.game-state-card > p:last-child {
  color: var(--color-muted);
}
</style>
