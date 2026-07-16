<template>
  <section class="hand-panel">
    <div class="panel-heading">
      <h2>내 손패</h2>
      <span>
        {{ cards.length }}장
        <template v-if="isMyTurn"> · 낼 수 있는 카드 {{ playableCount }}장</template>
      </span>
    </div>
    <div v-if="cards.length" class="hand-scroll">
      <button
        v-for="card in cards"
        :key="card.id"
        class="game-card hand-card"
        :class="[`color-${card.color}`, { playable: isMyTurn && card.playable }]"
        :disabled="!isMyTurn || !card.playable"
        type="button"
        @click="$emit('select', card)"
      >
        <small>{{ cardTypeLabel(card) }}</small>
        <b>{{ cardFace(card) }}</b>
        <span>{{ formatCard(card) }}</span>
      </button>
    </div>
    <p v-else class="empty-state">아직 받은 카드가 없습니다.</p>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { cardFace, cardTypeLabel, formatCard } from '../../../games/onecard/presentation';

const props = defineProps({
  cards: { type: Array, required: true },
  isMyTurn: { type: Boolean, required: true },
});
defineEmits(['select']);
const playableCount = computed(() => props.cards.filter((card) => card.playable).length);
</script>

<style scoped>
.hand-panel { overflow: hidden; padding: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: var(--color-surface); }
.panel-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-3); }
.panel-heading h2 { margin: 0; font-size: 20px; }
.panel-heading span { color: var(--color-muted); font-size: 13px; }
.hand-scroll { display: flex; gap: var(--space-3); overflow-x: auto; padding: var(--space-2) var(--space-1) var(--space-3); scrollbar-width: thin; }
.game-card { width: 138px; aspect-ratio: 2 / 3; display: flex; flex-direction: column; justify-content: space-between; padding: var(--space-3); border: 1px solid currentColor; border-radius: var(--radius-panel); background: var(--color-surface); box-shadow: var(--shadow-card); color: var(--color-ink); text-align: left; font-weight: 700; }
.game-card small { font-size: 11px; letter-spacing: .06em; }
.game-card b { align-self: center; font-size: 28px; }
.hand-card { flex: 0 0 118px; cursor: pointer; transition: translate 150ms cubic-bezier(.2,0,0,1), box-shadow 150ms cubic-bezier(.2,0,0,1); }
.hand-card.playable:not(:disabled):hover { translate: 0 -6px; }
.hand-card:disabled { cursor: not-allowed; filter: grayscale(.35); opacity: .44; box-shadow: none; }
.color-red { color: var(--color-danger); background: color-mix(in oklab, var(--color-danger) 8%, white); }
.color-yellow { color: #a67500; background: #fff9e8; }
.color-green { color: #168047; background: #f1faf5; }
.color-blue { color: var(--color-primary); background: color-mix(in oklab, var(--color-primary) 8%, white); }
.color-purple { color: var(--color-purple); background: #f7f5ff; }
.empty-state { color: var(--color-muted); }
</style>
