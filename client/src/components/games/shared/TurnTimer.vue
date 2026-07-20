<template>
  <div
    v-if="active && deadlineAt > 0"
    class="turn-timer"
    :class="{ mine: isMine, warning: secondsLeft <= 10, danger: secondsLeft <= 5 }"
    role="timer"
    aria-live="polite"
    :aria-label="`턴 제한시간 ${secondsLeft}초 남음`"
  >
    <span>남은 시간</span>
    <strong>{{ secondsLeft }}초</strong>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps({
  deadlineAt: { type: Number, default: 0 },
  active: { type: Boolean, default: false },
  isMine: { type: Boolean, default: false },
});

const now = ref(Date.now());
let intervalId = null;

const secondsLeft = computed(() =>
  Math.max(0, Math.ceil((props.deadlineAt - now.value) / 1000)),
);

onMounted(() => {
  intervalId = window.setInterval(() => {
    now.value = Date.now();
  }, 250);
});

onBeforeUnmount(() => {
  if (intervalId !== null) window.clearInterval(intervalId);
});
</script>

<style scoped>
.turn-timer {
  min-width: 82px;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.72);
  color: #e2e8f0;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.turn-timer span {
  display: block;
  margin-bottom: 2px;
  font-size: 0.7rem;
  color: #94a3b8;
}

.turn-timer strong {
  font-size: 1rem;
}

.turn-timer.mine {
  border-color: rgba(96, 165, 250, 0.6);
}

.turn-timer.warning {
  border-color: #f59e0b;
  color: #fde68a;
}

.turn-timer.danger {
  border-color: #ef4444;
  color: #fecaca;
  animation: timer-pulse 0.8s ease-in-out infinite alternate;
}

@keyframes timer-pulse {
  to { transform: scale(1.04); }
}

@media (prefers-reduced-motion: reduce) {
  .turn-timer.danger { animation: none; }
}
</style>
