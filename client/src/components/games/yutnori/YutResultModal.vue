<template>
  <div class="modal-backdrop">
    <section class="result-modal" role="dialog" aria-modal="true" aria-labelledby="yut-result-title">
      <p class="eyebrow">게임 종료</p>
      <template v-if="won"><h2 id="yut-result-title">승리했습니다.</h2><p>모든 말을 먼저 완주했습니다.</p></template>
      <template v-else><h2 id="yut-result-title">게임이 끝났습니다.</h2><p>승리자: <strong>{{ winnerName }}</strong></p></template>
      <div class="result-actions">
        <button class="button button-primary" type="button" @click="$emit('return')">멤버 그대로 테이블로 복귀</button>
        <button class="button button-secondary" type="button" @click="$emit('leave')">로비로 나가기</button>
      </div>
    </section>
  </div>
</template>

<script setup>
defineProps({ won: { type: Boolean, required: true }, winnerName: { type: String, required: true } });
defineEmits(['return', 'leave']);
</script>

<style scoped>
.modal-backdrop { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: var(--space-4); background: rgba(49,48,46,.42); backdrop-filter: blur(6px); }
.result-modal { width: min(100%, 520px); padding: clamp(28px,6vw,48px); border: 1px solid var(--color-border); border-radius: var(--radius-large); background: var(--color-surface); box-shadow: var(--shadow-card); }
.eyebrow { color: var(--color-muted); font-size: 12px; font-weight: 700; letter-spacing: .08em; }
.result-modal h2 { margin: 0; font-size: clamp(30px,6vw,44px); letter-spacing: -.035em; }
.result-modal > p:not(.eyebrow) { margin: var(--space-3) 0 0; color: var(--color-muted); }
.result-actions { display: grid; gap: var(--space-2); margin-top: var(--space-6); }
.result-actions .button-secondary { color: var(--color-muted); }
</style>
