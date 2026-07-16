<template>
  <div class="modal-backdrop">
    <section class="result-modal" role="dialog" aria-modal="true" aria-labelledby="rummikub-result-title">
      <p>게임 종료</p>
      <h2 id="rummikub-result-title">루미큐브 결과</h2>
      <ol>
        <li v-for="player in rankings" :key="player.id">
          <strong>{{ player.name }}</strong><span>{{ player.score > 0 ? '+' : '' }}{{ player.score }}점</span>
        </li>
      </ol>
      <button type="button" @click="$emit('return')">멤버 그대로 테이블로 복귀</button>
    </section>
  </div>
</template>

<script setup>
defineProps({ rankings: { type: Array, required: true } });
defineEmits(['return']);
</script>

<style scoped>
.modal-backdrop { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 16px; background: rgba(49,48,46,.45); backdrop-filter: blur(6px); }
.result-modal { width: min(100%,440px); padding: 24px; border-radius: var(--radius-panel); background: white; box-shadow: var(--shadow-card); }
.result-modal > p { margin: 0 0 4px; color: var(--color-muted); font-size: 11px; font-weight: 800; letter-spacing: .1em; }
.result-modal h2 { margin: 0; font-size: 26px; }
.result-modal ol { margin: 20px 0; padding-left: 24px; }
.result-modal li { padding: 9px 0 9px 5px; border-bottom: 1px solid var(--color-border-soft); }
.result-modal li strong { display: inline-block; min-width: 150px; }
.result-modal li span { color: var(--color-muted); }
.result-modal button { width: 100%; min-height: 44px; border: 0; border-radius: var(--radius-control); background: var(--color-primary); color: white; cursor: pointer; font-weight: 700; }
</style>

