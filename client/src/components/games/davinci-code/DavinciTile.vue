<template>
  <button
    type="button"
    class="davinci-tile"
    :class="[
      `tile-${tile.color}`,
      { hidden: !own && !tile.revealed, revealed: tile.revealed, selected },
    ]"
    :disabled="!selectable"
    :aria-pressed="selectable ? selected : undefined"
    :aria-label="label"
    @click="$emit('select', tile.id)"
  >
    <strong>{{ own || tile.revealed ? tile.number : '?' }}</strong>
  </button>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  tile: { type: Object, required: true },
  own: { type: Boolean, default: false },
  selectable: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  ownerName: { type: String, default: '' },
  position: { type: Number, default: 0 },
});
defineEmits(['select']);

const colorLabel = computed(() => (props.tile.color === 'dark' ? '검정' : '흰색'));
const label = computed(() => {
  const owner = props.own ? '내' : `${props.ownerName}님의`;
  const value = props.own || props.tile.revealed ? ` ${props.tile.number}` : ', 숨김';
  return `${owner} ${props.position + 1}번째 ${colorLabel.value} 타일${value}`;
});
</script>

<style scoped>
.davinci-tile { width: 66px; height: 98px; flex: 0 0 auto; display: grid; place-items: center; padding: 0; border: 1px solid #31302e; border-radius: 4px; background: #fff; color: #1f1f1e; box-shadow: var(--shadow-card); cursor: default; font: 700 26px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; transition: transform 150ms cubic-bezier(.2,0,0,1), box-shadow 150ms cubic-bezier(.2,0,0,1), opacity 150ms ease; }
.davinci-tile.tile-dark { background: #31302e; color: white; }
.davinci-tile:enabled { cursor: pointer; }
.davinci-tile:enabled:hover { transform: translateY(-4px); }
.davinci-tile.selected { transform: translateY(-4px); box-shadow: var(--focus-ring), var(--shadow-card); }
.davinci-tile.revealed { opacity: .68; transform: translateY(7px); }
.davinci-tile:disabled { opacity: 1; }
.davinci-tile.revealed:disabled { opacity: .68; }
@media (max-width: 720px) { .davinci-tile { width: 58px; height: 86px; } }
@media (prefers-reduced-motion: reduce) { .davinci-tile { transition-duration: .01ms; } }
</style>
