<template>
  <section class="turn-controls" aria-label="루미큐브 턴 조작">
    <div class="selection-summary">
      <strong>{{ selectedCount }}개 선택</strong>
      <span v-if="!hasInitialMeld">첫 등록 예상 {{ initialScore }} / 30점</span>
      <span v-else>{{ allMeldsValid ? '모든 조합이 유효합니다.' : '미완성 조합을 정리해주세요.' }}</span>
    </div>
    <div class="edit-actions">
      <ActionGuard :reason="selectionActionReason" label="새 조합"><button type="button" :disabled="Boolean(selectionActionReason)" @click="$emit('new-meld')">새 조합</button></ActionGuard>
      <ActionGuard :reason="selectionActionReason" label="패로 이동"><button type="button" :disabled="Boolean(selectionActionReason)" @click="$emit('to-rack')">패로 이동</button></ActionGuard>
      <ActionGuard :reason="undoReason" label="실행 취소"><button type="button" :disabled="Boolean(undoReason)" @click="$emit('undo')">실행 취소</button></ActionGuard>
      <ActionGuard :reason="resetReason" label="처음으로"><button type="button" :disabled="Boolean(resetReason)" @click="$emit('reset')">처음으로</button></ActionGuard>
    </div>
    <div class="submit-actions">
      <ActionGuard :reason="editableReason" :label="poolEmpty ? '패스' : '타일 1개 가져오기'">
        <button class="draw" type="button" :disabled="Boolean(editableReason)" @click="$emit(poolEmpty ? 'pass' : 'draw')">
          {{ poolEmpty ? '패스' : '타일 1개 가져오기' }}
        </button>
      </ActionGuard>
      <ActionGuard :reason="commitReason" label="턴 확정"><button class="commit" type="button" :disabled="Boolean(commitReason)" @click="$emit('commit')">턴 확정</button></ActionGuard>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import ActionGuard from '../shared/ActionGuard.vue';

const props = defineProps({
  editable: { type: Boolean, default: false },
  selectedCount: { type: Number, default: 0 },
  hasInitialMeld: { type: Boolean, default: false },
  initialScore: { type: Number, default: 0 },
  allMeldsValid: { type: Boolean, default: false },
  canUndo: { type: Boolean, default: false },
  canCommit: { type: Boolean, default: false },
  poolEmpty: { type: Boolean, default: false },
  editableReason: { type: String, default: '' },
  commitReason: { type: String, default: '' },
});
defineEmits(['new-meld', 'to-rack', 'undo', 'reset', 'draw', 'pass', 'commit']);

const selectionActionReason = computed(() => props.editableReason || (!props.selectedCount ? '먼저 이동할 타일을 하나 이상 선택하세요.' : ''));
const undoReason = computed(() => props.editableReason || (!props.canUndo ? '아직 취소할 변경 사항이 없습니다.' : ''));
const resetReason = computed(() => props.editableReason || (!props.canUndo ? '현재 배치를 변경하지 않았습니다.' : ''));
</script>

<style scoped>
.turn-controls { display: grid; grid-template-columns: minmax(150px,.8fr) auto auto; align-items: center; gap: 12px; padding: 13px; border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: var(--color-surface); }
.selection-summary strong,
.selection-summary span { display: block; }
.selection-summary strong { font-size: 13px; }
.selection-summary span { margin-top: 2px; color: var(--color-muted); font-size: 11px; }
.edit-actions,
.submit-actions { display: flex; gap: 6px; }
.turn-controls button { min-height: 38px; padding: 0 12px; border: 1px solid var(--color-border); border-radius: var(--radius-control); background: white; color: var(--color-ink-soft); cursor: pointer; font-size: 12px; font-weight: 700; }
.turn-controls button:disabled { opacity: .38; cursor: not-allowed; }
.turn-controls .draw { border-color: color-mix(in srgb, var(--color-warning) 35%, var(--color-border)); }
.turn-controls .commit { border-color: transparent; background: var(--color-primary); color: white; }
@media (max-width: 820px) { .turn-controls { grid-template-columns: 1fr; } .edit-actions,.submit-actions { flex-wrap: wrap; } .submit-actions button { flex: 1; } }
</style>
