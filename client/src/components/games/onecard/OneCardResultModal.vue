<template>
  <div class="modal-backdrop">
    <section class="result-modal" role="dialog" aria-modal="true" aria-labelledby="onecard-result-title">
      <p class="eyebrow">게임 종료</p>
      <h2 id="onecard-result-title">최종 순위</h2>
      <ol class="ranking-list"><li v-for="player in rankings" :key="player.id">{{ player.name }}</li></ol>
      <button class="button button-primary" type="button" @click="$emit('return')">멤버 그대로 테이블로 복귀</button>
    </section>
  </div>
</template>

<script setup>
defineProps({ rankings: { type: Array, required: true } });
defineEmits(['return']);
</script>

<style scoped>
.modal-backdrop { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: var(--space-4); background: rgba(49,48,46,.42); backdrop-filter: blur(6px); }
.result-modal { width: min(100%, 420px); padding: var(--space-6); border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: var(--color-surface); box-shadow: var(--shadow-card); }
.eyebrow { color: var(--color-muted); font-size: 12px; font-weight: 700; letter-spacing: .08em; }
.result-modal h2 { margin: 0; font-size: 26px; }
.ranking-list { margin: var(--space-5) 0; padding-left: var(--space-6); }
.ranking-list li { padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border-soft); }
.button { width: 100%; }
</style>
