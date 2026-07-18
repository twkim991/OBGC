<template>
  <article class="meld" :class="{ invalid: !valid }">
    <div class="meld-heading">
      <span>{{ valid ? `${analysis.kind === 'run' ? '런' : '그룹'} · ${analysis.score}점` : '미완성 조합' }}</span>
      <div v-if="editable" class="meld-actions">
        <ActionGuard :reason="hasSelection ? '' : '먼저 조합에 추가할 타일을 선택하세요.'" label="선택 추가"><button type="button" :disabled="!hasSelection" @click="$emit('add-selected', meld.id)">선택 추가</button></ActionGuard>
        <button type="button" @click="$emit('dissolve', meld.id)">해체</button>
      </div>
    </div>
    <div class="meld-tiles">
      <div v-for="(tile, index) in meld.tiles" :key="tile.id" class="tile-with-order">
        <RummikubTile
          :tile="tile"
          :selected="selectedIds.includes(tile.id)"
          compact
          @toggle="$emit('toggle', $event)"
        />
        <div v-if="editable" class="order-buttons" aria-label="타일 순서 조정">
          <ActionGuard :reason="index === 0 ? '이미 가장 왼쪽에 있는 타일입니다.' : ''" label="왼쪽으로"><button type="button" :disabled="index === 0" aria-label="왼쪽으로" @click="$emit('reorder', meld.id, tile.id, -1)">‹</button></ActionGuard>
          <ActionGuard :reason="index === meld.tiles.length - 1 ? '이미 가장 오른쪽에 있는 타일입니다.' : ''" label="오른쪽으로"><button type="button" :disabled="index === meld.tiles.length - 1" aria-label="오른쪽으로" @click="$emit('reorder', meld.id, tile.id, 1)">›</button></ActionGuard>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import { analyzeClientMeld } from '../../../games/rummikub/draft';
import ActionGuard from '../shared/ActionGuard.vue';
import RummikubTile from './RummikubTile.vue';

const props = defineProps({
  meld: { type: Object, required: true },
  selectedIds: { type: Array, required: true },
  editable: { type: Boolean, default: false },
});
defineEmits(['toggle', 'add-selected', 'dissolve', 'reorder']);

const analysis = computed(() => analyzeClientMeld(props.meld.tiles));
const valid = computed(() => Boolean(analysis.value));
const hasSelection = computed(() => props.selectedIds.length > 0);
</script>

<style scoped>
.meld { min-width: 190px; display: grid; gap: 8px; padding: 10px; border: 1px solid var(--color-border); border-radius: var(--radius-small); background: rgba(255,255,255,.9); }
.meld.invalid { border-color: color-mix(in srgb, var(--color-danger) 45%, var(--color-border)); background: #fff8f7; }
.meld-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--color-muted); font-size: 11px; font-weight: 700; }
.meld-actions { display: flex; gap: 4px; }
.meld-actions button,
.order-buttons button { min-height: 24px; padding: 0 7px; border: 1px solid var(--color-border); border-radius: 4px; background: white; color: var(--color-ink-soft); cursor: pointer; font-size: 10px; }
.meld-actions button:disabled,
.order-buttons button:disabled { opacity: .35; cursor: not-allowed; }
.meld-tiles { display: flex; align-items: flex-start; gap: 5px; overflow-x: auto; padding: 5px 2px 2px; }
.tile-with-order { display: grid; gap: 3px; justify-items: center; }
.order-buttons { display: flex; gap: 2px; }
.order-buttons button { width: 19px; padding: 0; }
</style>
