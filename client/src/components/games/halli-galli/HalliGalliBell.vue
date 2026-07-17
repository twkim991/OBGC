<template>
  <div class="bell-wrap">
    <button
      type="button"
      class="bell"
      :class="{ ready, wrong: result === 'wrong', correct: result === 'correct' }"
      :disabled="disabled"
      aria-label="할리갈리 종 치기"
      @click="$emit('ring')"
    >
      <span>종 치기</span>
    </button>
    <p>{{ hint }}</p>
  </div>
</template>

<script setup>
defineProps({
  ready: Boolean,
  disabled: Boolean,
  result: { type: String, default: '' },
  hint: { type: String, required: true },
});
defineEmits(['ring']);
</script>

<style scoped>
.bell-wrap { display: grid; justify-items: center; gap: 12px; }
.bell { width: 148px; height: 148px; position: relative; border: 0; border-radius: 50%; background: #31302e; color: white; cursor: pointer; box-shadow: 0 0 0 10px white, 0 0 0 11px var(--color-border), 0 12px 28px rgba(32,27,22,.14); transition: transform 150ms ease, background 150ms ease; }
.bell::before { content: ''; position: absolute; width: 44px; height: 25px; left: 52px; top: 24px; border-radius: 999px 999px 4px 4px; background: white; }
.bell::after { content: ''; position: absolute; width: 90px; height: 6px; left: 29px; bottom: 27px; border-radius: 999px; background: white; }
.bell span { position: relative; z-index: 1; display: block; margin-top: 23px; font-size: 19px; font-weight: 800; }
.bell:hover:not(:disabled) { transform: translateY(-3px); }
.bell:active:not(:disabled) { transform: translateY(4px) scale(.97); }
.bell.ready { background: #dd7900; color: #201b16; }
.bell.correct { background: var(--color-success); }
.bell.wrong { background: var(--color-danger); animation: shake 220ms ease; }
.bell:disabled { cursor: not-allowed; opacity: .45; }
.bell-wrap p { max-width: 230px; margin: 0; color: var(--color-muted); font-size: 12px; text-align: center; }
@keyframes shake { 25% { transform: translateX(-7px); } 50% { transform: translateX(7px); } 75% { transform: translateX(-4px); } }
@media (max-width: 520px) { .bell { width: 126px; height: 126px; } .bell::before { left: 41px; top: 20px; } .bell::after { width: 78px; left: 24px; bottom: 23px; } }
@media (prefers-reduced-motion: reduce) { .bell { transition: none; } .bell.wrong { animation: none; } }
</style>
