<template>
  <span ref="guardRef" class="action-guard" :class="{ block, blocked: Boolean(reason) }">
    <span class="action-guard-content" :aria-disabled="reason ? 'true' : undefined"><slot /></span>
    <button
      v-if="reason"
      type="button"
      class="action-guard-trigger"
      :aria-label="`${label || '사용할 수 없는 행동'}: ${reason}`"
      :aria-describedby="tooltipId"
      @pointerenter="show"
      @pointerleave="closeUnlessFocused"
      @focus="handleFocus"
      @blur="handleBlur"
      @click.stop.prevent="showTemporarily"
      @keydown.esc="handleBlur"
    />
    <Teleport to="body">
      <span
        v-if="reason && open"
        :id="tooltipId"
        class="action-guard-tooltip"
        :class="{ below: tooltipBelow }"
        :style="tooltipStyle"
        role="tooltip"
        aria-live="polite"
      >
        <strong>지금은 할 수 없습니다</strong>
        <span>{{ reason }}</span>
      </span>
    </Teleport>
  </span>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, useId } from 'vue';

defineProps({
  reason: { type: String, default: '' },
  label: { type: String, default: '' },
  block: { type: Boolean, default: false },
});

const open = ref(false);
const focused = ref(false);
const guardRef = ref(null);
const tooltipBelow = ref(false);
const tooltipStyle = ref({});
const tooltipId = `action-guard-${useId()}`;
let closeTimer = null;

function clearCloseTimer() {
  if (closeTimer) window.clearTimeout(closeTimer);
  closeTimer = null;
}

function showTemporarily() {
  clearCloseTimer();
  show();
  closeTimer = window.setTimeout(() => {
    if (!focused.value) open.value = false;
  }, 2800);
}

function handleFocus() {
  clearCloseTimer();
  focused.value = true;
  show();
}

function show() {
  open.value = true;
  nextTick(updateTooltipPosition);
}

function updateTooltipPosition() {
  const rect = guardRef.value?.getBoundingClientRect();
  if (!rect) return;
  const halfTooltip = Math.min(140, window.innerWidth * .41);
  const left = Math.max(halfTooltip + 8, Math.min(window.innerWidth - halfTooltip - 8, rect.left + rect.width / 2));
  tooltipBelow.value = rect.top < 108;
  tooltipStyle.value = tooltipBelow.value
    ? { left: `${left}px`, top: `${rect.bottom + 8}px` }
    : { left: `${left}px`, top: `${rect.top - 8}px` };
}

function handleBlur() {
  focused.value = false;
  open.value = false;
}

function closeUnlessFocused() {
  if (!focused.value) open.value = false;
}

onBeforeUnmount(clearCloseTimer);
</script>

<style scoped>
.action-guard {
  position: relative;
  display: inline-grid;
  max-width: 100%;
  vertical-align: top;
}
.action-guard.block { display: grid; width: 100%; }
.action-guard-content,
.action-guard-trigger { grid-area: 1 / 1; }
.action-guard-content { min-width: 0; display: grid; }
.action-guard.block .action-guard-content,
.action-guard.block .action-guard-content :deep(> *) { width: 100%; }
.action-guard-trigger {
  z-index: 4;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: inherit;
  background: transparent;
  cursor: help;
}
.action-guard-trigger::after {
  content: '?';
  position: absolute;
  top: 5px;
  right: 5px;
  width: 17px;
  height: 17px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--color-muted, #777) 34%, white);
  border-radius: 50%;
  background: rgba(255, 255, 255, .94);
  color: var(--color-muted, #6f6964);
  font: 800 10px/1 system-ui, sans-serif;
  box-shadow: 0 2px 7px rgba(24, 21, 18, .12);
}
.action-guard-trigger:focus-visible { outline: 2px solid var(--color-primary, #3568b8); outline-offset: 2px; }
.action-guard-tooltip {
  position: fixed;
  z-index: 10000;
  width: max-content;
  max-width: min(280px, 82vw);
  translate: -50% -100%;
  padding: 9px 11px;
  border: 1px solid rgba(33, 29, 25, .14);
  border-radius: 7px;
  background: #292623;
  color: white;
  box-shadow: 0 9px 26px rgba(28, 24, 20, .2);
  text-align: left;
  pointer-events: none;
}
.action-guard-tooltip.below { translate: -50% 0; }
.action-guard-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  border: 5px solid transparent;
  border-top-color: #292623;
  translate: -50% 0;
}
.action-guard-tooltip.below::after {
  top: auto;
  bottom: 100%;
  border-top-color: transparent;
  border-bottom-color: #292623;
}
.action-guard-tooltip strong,
.action-guard-tooltip span { display: block; }
.action-guard-tooltip strong { font-size: 10px; }
.action-guard-tooltip span { margin-top: 3px; color: #e1ddd8; font-size: 10px; line-height: 1.45; }
@media (max-width: 520px) {
  .action-guard-tooltip { max-width: min(250px, 76vw); }
}
@media (prefers-reduced-motion: reduce) {
  .action-guard-trigger:focus-visible { outline-offset: 1px; }
}
</style>
