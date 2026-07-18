<template>
  <Teleport to="body">
    <dialog
      ref="dialogRef"
      class="game-alert"
      :data-tone="gameAlertState.tone"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="game-alert-title"
      aria-describedby="game-alert-message"
      @cancel="handleCancel"
      @click="handleBackdropClick"
    >
      <div class="game-alert__body">
        <span class="game-alert__label">{{ gameAlertState.label }}</span>
        <h2 id="game-alert-title" class="game-alert__title">{{ gameAlertState.title }}</h2>
        <p id="game-alert-message" class="game-alert__message">{{ gameAlertState.message }}</p>
        <p v-if="gameAlertState.note" class="game-alert__note">{{ gameAlertState.note }}</p>
      </div>
      <div class="game-alert__actions">
        <button
          v-if="gameAlertState.secondaryLabel"
          ref="secondaryButtonRef"
          type="button"
          class="game-alert__button"
          @click="settle('secondary')"
        >
          {{ gameAlertState.secondaryLabel }}
        </button>
        <button
          ref="primaryButtonRef"
          type="button"
          class="game-alert__button"
          :class="gameAlertState.destructive ? 'game-alert__button--danger' : 'game-alert__button--primary'"
          @click="settle('primary')"
        >
          {{ gameAlertState.primaryLabel }}
        </button>
      </div>
    </dialog>

    <Transition name="game-alert-toast">
      <div v-if="gameAlertToast.visible" class="game-alert-toast" role="status" aria-live="polite">
        {{ gameAlertToast.message }}
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { gameAlertState, gameAlertToast, resolveGameAlert } from '../game-alerts';

const dialogRef = ref(null);
const primaryButtonRef = ref(null);
const secondaryButtonRef = ref(null);
let previousFocus = null;

watch(
  () => [gameAlertState.open, gameAlertState.revision],
  async ([open]) => {
    await nextTick();
    const dialog = dialogRef.value;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        previousFocus = document.activeElement;
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      }
      const safeChoice = gameAlertState.destructive ? secondaryButtonRef.value : null;
      (safeChoice || primaryButtonRef.value)?.focus({ preventScroll: true });
      return;
    }

    if (dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  },
  { flush: 'post' },
);

function settle(result) {
  resolveGameAlert(result);
}

function handleCancel(event) {
  event.preventDefault();
  if (gameAlertState.dismissible) settle('dismiss');
}

function handleBackdropClick(event) {
  if (event.target === dialogRef.value && gameAlertState.dismissible) settle('dismiss');
}

onBeforeUnmount(() => {
  if (gameAlertState.open) resolveGameAlert('dismiss');
});
</script>

<style scoped>
.game-alert {
  width: min(440px, calc(100% - 24px));
  max-height: calc(100dvh - 32px);
  margin: auto;
  overflow: auto;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
  color: var(--color-ink);
  box-shadow: var(--shadow-card);
}
.game-alert::backdrop {
  background: color-mix(in oklab, var(--color-ink) 28%, transparent);
  backdrop-filter: blur(2px);
}
.game-alert[open] { animation: game-alert-enter 200ms cubic-bezier(.2, 0, 0, 1); }
.game-alert[open]::backdrop { animation: game-alert-backdrop-enter 200ms cubic-bezier(.2, 0, 0, 1); }
.game-alert__body { padding: var(--space-6); }
.game-alert__label {
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  margin-bottom: var(--space-3);
  padding: 0 var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .02em;
}
.game-alert[data-tone='warning'] .game-alert__label { background: color-mix(in oklab, var(--color-warning) 9%, white); color: var(--color-warning); }
.game-alert[data-tone='danger'] .game-alert__label,
.game-alert[data-tone='error'] .game-alert__label { background: color-mix(in oklab, var(--color-danger) 8%, white); color: var(--color-danger); }
.game-alert[data-tone='success'] .game-alert__label { background: color-mix(in oklab, var(--color-success) 8%, white); color: var(--color-success); }
.game-alert[data-tone='info'] .game-alert__label { background: color-mix(in oklab, var(--color-primary) 7%, white); color: var(--color-primary); }
.game-alert__title { margin: 0; font-size: 26px; line-height: 1.2; letter-spacing: -.02em; }
.game-alert__message { margin: var(--space-3) 0 0; color: var(--color-muted); font-size: 16px; line-height: 1.65; }
.game-alert__note {
  margin: var(--space-4) 0 0;
  padding: var(--space-3);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-small);
  background: var(--color-surface-muted);
  color: var(--color-muted);
  font-size: 14px;
  line-height: 1.55;
}
.game-alert__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-border-soft);
  background: var(--color-surface-muted);
}
.game-alert__button {
  min-width: 112px;
  min-height: 44px;
  padding: 0 var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: .02em;
  cursor: pointer;
  transition: background 150ms cubic-bezier(.2, 0, 0, 1), transform 150ms cubic-bezier(.2, 0, 0, 1);
}
.game-alert__button:hover { background: color-mix(in oklab, var(--color-surface-muted) 75%, white); }
.game-alert__button:active { transform: translateY(1px); }
.game-alert__button--primary { border-color: transparent; background: var(--color-primary); color: white; box-shadow: var(--shadow-card); }
.game-alert__button--primary:hover { background: var(--color-primary-hover); }
.game-alert__button--danger { border-color: transparent; background: var(--color-danger); color: white; box-shadow: var(--shadow-card); }
.game-alert__button--danger:hover { background: color-mix(in oklab, var(--color-danger) 86%, var(--color-ink)); }
.game-alert-toast {
  position: fixed;
  right: var(--space-4);
  bottom: var(--space-4);
  z-index: 10001;
  max-width: min(380px, calc(100% - 32px));
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-small);
  background: var(--color-ink);
  color: var(--color-surface);
  box-shadow: var(--shadow-card);
  font-size: 14px;
}
.game-alert-toast-enter-active,
.game-alert-toast-leave-active { transition: opacity 150ms ease, transform 150ms ease; }
.game-alert-toast-enter-from,
.game-alert-toast-leave-to { opacity: 0; transform: translateY(6px); }
@keyframes game-alert-enter { from { opacity: 0; transform: translateY(8px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes game-alert-backdrop-enter { from { opacity: 0; } to { opacity: 1; } }
@media (max-width: 520px) {
  .game-alert__body { padding: var(--space-5) var(--space-4); }
  .game-alert__actions { flex-direction: column; padding: var(--space-3) var(--space-4) var(--space-4); }
  .game-alert__button { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .game-alert[open],
  .game-alert[open]::backdrop { animation-duration: .01ms; }
  .game-alert-toast-enter-active,
  .game-alert-toast-leave-active { transition-duration: .01ms; }
}
</style>
