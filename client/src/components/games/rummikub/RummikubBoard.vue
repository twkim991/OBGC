<template>
  <section class="rummikub-board" aria-labelledby="rummikub-board-title">
    <header>
      <div>
        <p>TABLE</p>
        <h2 id="rummikub-board-title">공개 보드</h2>
      </div>
      <span>{{ melds.length }}개 조합</span>
    </header>
    <div v-if="melds.length" class="meld-grid">
      <RummikubMeld
        v-for="meld in melds"
        :key="meld.id"
        :meld="meld"
        :selected-ids="selectedIds"
        :editable="editable"
        @toggle="$emit('toggle', $event)"
        @add-selected="$emit('add-selected', $event)"
        @dissolve="$emit('dissolve', $event)"
        @reorder="(...args) => $emit('reorder', ...args)"
      />
    </div>
    <div v-else class="empty-board">
      <strong>아직 공개된 조합이 없습니다.</strong>
      <span>첫 등록은 내 패만 사용해 30점 이상을 만들어야 합니다.</span>
    </div>
  </section>
</template>

<script setup>
import RummikubMeld from './RummikubMeld.vue';

defineProps({
  melds: { type: Array, required: true },
  selectedIds: { type: Array, required: true },
  editable: { type: Boolean, default: false },
});
defineEmits(['toggle', 'add-selected', 'dissolve', 'reorder']);
</script>

<style scoped>
.rummikub-board { min-height: 330px; padding: var(--space-5); border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: #f2f5f0; }
.rummikub-board > header { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.rummikub-board header p { margin: 0 0 3px; color: var(--color-muted); font-size: 10px; font-weight: 800; letter-spacing: .12em; }
.rummikub-board h2 { margin: 0; font-size: 20px; }
.rummikub-board header > span { color: var(--color-muted); font-size: 12px; }
.meld-grid { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 10px; }
.empty-board { min-height: 230px; display: grid; place-content: center; justify-items: center; gap: 6px; color: var(--color-muted); text-align: center; }
.empty-board strong { color: var(--color-ink-soft); }
.empty-board span { font-size: 13px; }
</style>

