<template>
  <button
    v-if="interactive"
    type="button"
    class="lost-card"
    :class="[`tone-${card.color}`, { mini, selected, disabled }]"
    :disabled="disabled"
    :aria-pressed="selected"
    :aria-label="ariaLabel"
    @click="$emit('select', card)"
  >
    <span class="card-value">{{ valueLabel }}</span>
    <span v-if="!mini" class="card-place">{{ colorLabel }}</span>
    <span v-if="!mini" class="card-rule">{{ card.kind === 'wager' ? '숫자 전에 놓기' : '오름차순' }}</span>
  </button>
  <article v-else class="lost-card" :class="[`tone-${card.color}`, { mini }]" :aria-label="ariaLabel">
    <span class="card-value">{{ valueLabel }}</span>
    <span v-if="!mini" class="card-place">{{ colorLabel }}</span>
    <span v-if="!mini" class="card-rule">{{ card.kind === 'wager' ? '숫자 전에 놓기' : '오름차순' }}</span>
  </article>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  card: { type: Object, required: true },
  interactive: Boolean,
  selected: Boolean,
  disabled: Boolean,
  mini: Boolean,
});
defineEmits(['select']);

const labels = { yellow:'황금 사막', blue:'심해', white:'설산', green:'밀림', red:'화산' };
const colorLabel = computed(() => labels[props.card.color] || '탐험');
const valueLabel = computed(() => props.card.kind === 'wager' ? '×2' : props.card.value);
const ariaLabel = computed(() => `${colorLabel.value} ${props.card.kind === 'wager' ? '내기' : props.card.value} 카드${props.selected ? ', 선택됨' : ''}`);
</script>

<style scoped>
.lost-card{box-sizing:border-box;width:104px;height:148px;flex:0 0 104px;display:grid;grid-template-rows:auto 1fr auto;padding:12px;border:1px solid color-mix(in srgb,currentColor 32%,var(--color-border));border-radius:8px;background:#fff;color:#31302e;text-align:left;box-shadow:var(--shadow-card)}
button.lost-card{cursor:pointer;transition:transform .15s cubic-bezier(.2,0,0,1),box-shadow .15s cubic-bezier(.2,0,0,1)}button.lost-card:hover:not(:disabled){transform:translateY(-3px)}button.lost-card.selected{box-shadow:0 0 0 2px currentColor,var(--shadow-card);transform:translateY(-4px)}button.lost-card.disabled{opacity:.58;cursor:not-allowed}
.lost-card.mini{width:38px;height:62px;flex-basis:38px;display:grid;place-items:center;padding:0;border-radius:4px;text-align:center}.card-value{font:700 32px/1 ui-monospace,"SF Mono",Consolas,monospace;letter-spacing:-.04em}.mini .card-value{font-size:14px}.card-place{align-self:center;font-size:12px;font-weight:700}.card-rule{font-size:11px;opacity:.72}
.tone-yellow{background:color-mix(in srgb,#dd7900 17%,white);color:#a65300}.tone-blue{background:color-mix(in srgb,#0075de 12%,white);color:#0067c4}.tone-white{background:#fff;color:#31302e}.tone-green{background:color-mix(in srgb,#1aae39 12%,white);color:#14872d}.tone-red{background:color-mix(in srgb,#dc2626 11%,white);color:#bd1f1f}
@media(max-width:760px){.lost-card{width:92px;height:132px;flex-basis:92px}.card-value{font-size:26px}}
</style>

