<template>
  <section class="rack-panel" aria-labelledby="rummikub-rack-title">
    <header>
      <div>
        <p>MY RACK</p>
        <h2 id="rummikub-rack-title">내 타일 <span>{{ tiles.length }}</span></h2>
      </div>
      <span>타일을 눌러 선택하세요.</span>
    </header>
    <div class="rack-tiles">
      <RummikubTile
        v-for="tile in tiles"
        :key="tile.id"
        :tile="tile"
        :selected="selectedIds.includes(tile.id)"
        :from-board="boardTileIds.includes(tile.id)"
        @toggle="$emit('toggle', $event)"
      />
    </div>
  </section>
</template>

<script setup>
import RummikubTile from './RummikubTile.vue';

defineProps({
  tiles: { type: Array, required: true },
  selectedIds: { type: Array, required: true },
  boardTileIds: { type: Array, default: () => [] },
});
defineEmits(['toggle']);
</script>

<style scoped>
.rack-panel { padding: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: #3d2c21; box-shadow: inset 0 -8px 0 rgba(0,0,0,.12); }
.rack-panel header { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin-bottom: 14px; color: rgba(255,255,255,.7); }
.rack-panel header p { margin: 0 0 2px; font-size: 10px; font-weight: 800; letter-spacing: .12em; }
.rack-panel h2 { margin: 0; color: white; font-size: 18px; }
.rack-panel h2 span { color: rgba(255,255,255,.64); font-size: 13px; }
.rack-panel header > span { font-size: 11px; }
.rack-tiles { min-height: 70px; display: flex; align-items: flex-end; gap: 6px; overflow-x: auto; padding: 7px 3px 10px; }
</style>

