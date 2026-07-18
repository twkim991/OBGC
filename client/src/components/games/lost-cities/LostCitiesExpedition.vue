<template>
  <article class="expedition-lane">
    <div class="lane-title"><strong>{{ label }}</strong><span>{{ mine.cards.length }}장</span></div>
    <div class="route opponent-route">
      <LostCitiesCard v-for="card in opponent.cards" :key="card.id" :card="card" mini />
      <span v-if="!opponent.cards.length" class="route-empty">미개척</span>
    </div>
    <ActionGuard :reason="drawBlockedReason" :label="`${label} 버림 더미에서 뽑기`" block>
      <button
        type="button"
        class="discard-button"
        :class="`tone-${color}`"
        :disabled="Boolean(drawBlockedReason)"
        :aria-label="discardLabel"
        @click="$emit('draw-discard', color)"
      >
        <strong>{{ discard.topCard?.id ? valueLabel(discard.topCard) : '—' }}</strong>
        <span>버림 더미 · {{ discard.count }}장</span>
      </button>
    </ActionGuard>
    <div class="route my-route">
      <LostCitiesCard v-for="card in mine.cards" :key="card.id" :card="card" mini />
      <span v-if="!mine.cards.length" class="route-empty">미개척</span>
    </div>
    <div class="score-line"><span>상대 {{ opponent.score }}점</span><strong>나 {{ mine.score }}점</strong></div>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import ActionGuard from '../shared/ActionGuard.vue';
import LostCitiesCard from './LostCitiesCard.vue';

const props = defineProps({
  color: { type: String, required: true },
  label: { type: String, required: true },
  mine: { type: Object, required: true },
  opponent: { type: Object, required: true },
  discard: { type: Object, required: true },
  drawBlockedReason: { type: String, default: '' },
});
defineEmits(['draw-discard']);

const valueLabel = (card) => card.kind === 'wager' ? '×2' : card.value;
const discardLabel = computed(() => `${props.label} 버림 더미${props.discard.topCard?.id ? `, 맨 위 ${valueLabel(props.discard.topCard)}` : ', 비어 있음'}`);
</script>

<style scoped>
.expedition-lane{min-width:0;border:1px solid var(--color-border);border-radius:8px;background:var(--color-surface-muted);overflow:hidden}.lane-title{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid var(--color-border-soft);background:#fff}.lane-title strong{font-size:12px}.lane-title span{color:var(--color-muted);font:600 12px/1 ui-monospace,monospace}.route{min-height:86px;display:flex;align-items:flex-end;justify-content:flex-start;gap:3px;overflow-x:auto;padding:12px 8px;scrollbar-width:thin}.opponent-route{align-items:flex-start}.route-empty{align-self:center;margin:auto;color:var(--color-meta);font-size:12px}.discard-button{width:calc(100% - 16px);min-height:68px;margin:0 8px;display:grid;place-items:center;gap:2px;border:1px dashed currentColor;border-radius:4px;background:#fff;color:var(--color-muted);cursor:pointer}.discard-button strong{font:700 20px/1 ui-monospace,monospace}.discard-button span{font-size:11px}.discard-button:not(:disabled):hover{border-style:solid;filter:saturate(1.25)}.discard-button:disabled{cursor:not-allowed;opacity:.42}.score-line{display:flex;justify-content:space-between;gap:8px;padding:8px 12px;border-top:1px solid var(--color-border-soft);background:#fff;color:var(--color-muted);font-size:11px}.score-line strong{color:var(--color-ink);font-family:ui-monospace,monospace}.tone-yellow{color:#a65300}.tone-blue{color:#0067c4}.tone-white{color:#31302e}.tone-green{color:#14872d}.tone-red{color:#bd1f1f}
</style>
