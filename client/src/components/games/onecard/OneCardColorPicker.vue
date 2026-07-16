<template>
  <div class="modal-backdrop" @click.self="$emit('cancel')">
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="color-picker-title">
      <p class="eyebrow">색상 선택 카드</p>
      <h2 id="color-picker-title">다음 색상을 선택하세요.</h2>
      <p class="modal-copy">선택한 색상으로 다음 플레이가 이어집니다.</p>
      <div class="color-options">
        <button v-for="color in colors" :key="color.id" class="color-option" :class="`color-${color.id}`" type="button" @click="$emit('select', color.id)">{{ color.label }}</button>
      </div>
      <button class="button button-secondary modal-cancel" type="button" @click="$emit('cancel')">선택 취소</button>
    </section>
  </div>
</template>

<script setup>
defineEmits(['select', 'cancel']);
const colors = [
  { id: 'red', label: '빨강' }, { id: 'yellow', label: '노랑' },
  { id: 'green', label: '초록' }, { id: 'blue', label: '파랑' },
];
</script>

<style scoped>
.modal-backdrop { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: var(--space-4); background: rgba(49,48,46,.42); backdrop-filter: blur(6px); }
.modal { width: min(100%, 420px); padding: var(--space-6); border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: var(--color-surface); box-shadow: var(--shadow-card); }
.eyebrow { color: var(--color-muted); font-size: 12px; font-weight: 700; letter-spacing: .08em; }
.modal h2 { margin: 0; font-size: 26px; }
.modal-copy { margin-top: var(--space-2); color: var(--color-muted); }
.color-options { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-2); margin-top: var(--space-5); }
.color-option { min-height: 48px; border: 1px solid currentColor; border-radius: var(--radius-control); font-weight: 700; cursor: pointer; }
.color-red { color: var(--color-danger); background: color-mix(in oklab, var(--color-danger) 8%, white); }
.color-yellow { color: #a67500; background: #fff9e8; }
.color-green { color: #168047; background: #f1faf5; }
.color-blue { color: var(--color-primary); background: color-mix(in oklab, var(--color-primary) 8%, white); }
.modal-cancel { width: 100%; margin-top: var(--space-2); }
</style>
