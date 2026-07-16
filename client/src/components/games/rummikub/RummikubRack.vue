<template>
  <section class="rack-panel" aria-labelledby="rummikub-rack-title">
    <header>
      <div>
        <p>MY RACK</p>
        <h2 id="rummikub-rack-title">내 타일 <span>{{ tiles.length }}</span></h2>
      </div>
      <div class="rack-actions">
        <span>타일을 눌러 선택하세요.</span>
        <div class="sort-control" role="group" aria-label="내 타일 정렬 방식">
          <button
            type="button"
            :class="{ active: sortMode === 'color' }"
            :aria-pressed="sortMode === 'color'"
            @click="$emit('sort-change', 'color')"
          >
            색상순
          </button>
          <button
            type="button"
            :class="{ active: sortMode === 'number' }"
            :aria-pressed="sortMode === 'number'"
            @click="$emit('sort-change', 'number')"
          >
            숫자순
          </button>
        </div>
      </div>
    </header>
    <div class="rack-tiles">
      <div v-for="(row, rowIndex) in tileRows" :key="rowIndex" class="rack-row">
        <RummikubTile
          v-for="tile in row"
          :key="tile.id"
          :tile="tile"
          :selected="selectedIds.includes(tile.id)"
          :from-board="boardTileIds.includes(tile.id)"
          @toggle="$emit('toggle', $event)"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import RummikubTile from './RummikubTile.vue';

const props = defineProps({
  tiles: { type: Array, required: true },
  selectedIds: { type: Array, required: true },
  boardTileIds: { type: Array, default: () => [] },
  sortMode: { type: String, default: 'color' },
});
defineEmits(['toggle', 'sort-change']);

const tileRows = computed(() =>
  [props.tiles.slice(0, 17), props.tiles.slice(17)].filter((row) => row.length)
);
</script>

<style scoped>
.rack-panel { min-width: 0; max-width: 100%; padding: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-panel); overflow: hidden; background: #3d2c21; box-shadow: inset 0 -8px 0 rgba(0,0,0,.12); }
.rack-panel header { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin-bottom: 14px; color: rgba(255,255,255,.7); }
.rack-panel header p { margin: 0 0 2px; font-size: 10px; font-weight: 800; letter-spacing: .12em; }
.rack-panel h2 { margin: 0; color: white; font-size: 18px; }
.rack-panel h2 span { color: rgba(255,255,255,.64); font-size: 13px; }
.rack-actions { display: flex; align-items: center; gap: 10px; }
.rack-actions > span { font-size: 11px; }
.sort-control { display: inline-flex; padding: 2px; border-radius: 6px; background: rgba(255,255,255,.1); }
.sort-control button { min-height: 28px; padding: 0 9px; border: 0; border-radius: 4px; background: transparent; color: rgba(255,255,255,.68); cursor: pointer; font-size: 11px; font-weight: 700; }
.sort-control button:hover { color: white; }
.sort-control button.active { background: white; color: #3d2c21; }
.rack-tiles { width: 100%; min-width: 0; min-height: 147px; display: flex; flex-direction: column; justify-content: flex-end; gap: 6px; overflow: hidden; padding: 7px 3px 10px; }
.rack-row { min-width: 0; min-height: 62px; display: flex; align-items: flex-end; gap: 6px; overflow-x: auto; overflow-y: hidden; scrollbar-width: thin; }
@media (max-width: 600px) { .rack-panel header { align-items: flex-start; flex-direction: column; } .rack-actions { width: 100%; justify-content: space-between; } }
</style>
