<template>
  <button
    class="rummikub-tile"
    :class="[`tile-${tile.color}`, { selected, compact, 'from-board': fromBoard }]"
    type="button"
    :aria-pressed="selected"
    :aria-label="tileLabel"
    @click="$emit('toggle', tile.id)"
  >
    <span v-if="tile.isJoker" class="joker-mark">★</span>
    <strong v-else>{{ tile.number }}</strong>
    <small v-if="fromBoard">보드</small>
  </button>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  tile: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
  fromBoard: { type: Boolean, default: false },
});
defineEmits(['toggle']);

const colorNames = { red: '빨강', blue: '파랑', yellow: '노랑', black: '검정', joker: '조커' };
const tileLabel = computed(() =>
  props.tile.isJoker
    ? `조커${props.selected ? ', 선택됨' : ''}`
    : `${colorNames[props.tile.color] || props.tile.color} ${props.tile.number}${props.selected ? ', 선택됨' : ''}`
);
</script>

<style scoped>
.rummikub-tile {
  position: relative;
  width: 44px;
  height: 62px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  padding: 4px;
  border: 1px solid color-mix(in srgb, currentColor 42%, var(--color-border));
  border-radius: 7px;
  background: #fffdf8;
  color: var(--tile-color, var(--color-ink));
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.08);
  cursor: pointer;
}

.rummikub-tile strong,
.joker-mark { font-size: 22px; line-height: 1; }
.rummikub-tile small { position: absolute; right: 3px; bottom: 2px; color: var(--color-muted); font-size: 8px; }
.rummikub-tile.selected { transform: translateY(-5px); box-shadow: 0 0 0 3px rgba(0,117,222,.22), 0 5px 10px rgba(0,0,0,.12); }
.rummikub-tile.compact { width: 38px; height: 54px; }
.tile-red { --tile-color: #c9362b; }
.tile-blue { --tile-color: #006cc9; }
.tile-yellow { --tile-color: #a56a00; }
.tile-black { --tile-color: #242321; }
.tile-joker { --tile-color: #6d4aff; background: #f7f5ff; }
.from-board { background: #fff9e8; }
</style>

