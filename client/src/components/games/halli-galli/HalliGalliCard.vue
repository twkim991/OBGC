<template>
  <div class="card-stack" :class="{ empty: !card?.id }">
    <article
      v-if="card?.id"
      class="fruit-card"
      :class="`fruit-${card.fruit}`"
      :aria-label="`${fruitName} ${card.count}개`"
    >
      <strong>{{ card.count }}</strong>
      <div class="fruit-cluster" aria-hidden="true">
        <i v-for="index in card.count" :key="index"></i>
      </div>
      <span>{{ fruitName }}</span>
    </article>
    <article v-else class="fruit-card card-back" aria-label="아직 공개된 카드 없음">
      <span>OBGC</span>
      <small>공개 대기</small>
    </article>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({ card: { type: Object, default: null } });
const names = { strawberry: '딸기', banana: '바나나', lime: '라임', plum: '자두' };
const fruitName = computed(() => names[props.card?.fruit] || '과일');
</script>

<style scoped>
.card-stack { position: relative; width: 112px; height: 154px; }
.card-stack:not(.empty)::before { content: ''; position: absolute; inset: 5px -5px -5px 5px; border: 1px solid var(--color-border); border-radius: 8px; background: white; }
.fruit-card { position: relative; width: 112px; height: 154px; display: grid; grid-template-rows: auto 1fr auto; padding: 10px; overflow: hidden; border: 1px solid var(--color-border); border-radius: 8px; background: white; box-shadow: 0 8px 24px rgba(32,27,22,.08); }
.fruit-card strong { font: 800 22px/1 ui-monospace, monospace; }
.fruit-card > span { color: var(--color-muted); font-size: 10px; font-weight: 800; letter-spacing: .04em; text-align: right; }
.fruit-cluster { display: flex; flex-wrap: wrap; align-content: center; justify-content: center; gap: 6px; padding: 6px; }
.fruit-cluster i { width: 22px; height: 22px; position: relative; display: block; border-radius: 45% 55% 52% 48%; background: #dc2626; }
.fruit-cluster i::after { content: ''; position: absolute; width: 8px; height: 4px; top: -2px; left: 8px; border-radius: 999px; background: #1a9c42; transform: rotate(-28deg); }
.fruit-banana .fruit-cluster i { width: 26px; height: 12px; margin-block: 5px; border-radius: 999px; background: #dd7900; transform: rotate(-24deg); }
.fruit-lime .fruit-cluster i { border-radius: 50%; background: #1aae39; box-shadow: inset 0 0 0 4px rgba(255,255,255,.32); }
.fruit-plum .fruit-cluster i { border-radius: 50%; background: #3972c9; }
.card-back { place-items: center; grid-template-rows: 1fr auto; background: #31302e; color: white; box-shadow: none; }
.card-back::before { content: ''; position: absolute; inset: 9px; border: 1px solid rgba(255,255,255,.2); border-radius: 5px; }
.card-back span { align-self: end; color: white; font: 800 12px/1 ui-monospace, monospace; letter-spacing: .12em; text-align: center; }
.card-back small { align-self: start; margin-top: 7px; color: rgba(255,255,255,.58); font-size: 9px; }
@media (max-width: 520px) { .card-stack, .fruit-card { width: 92px; height: 128px; } .fruit-card { padding: 8px; } .fruit-cluster i { width: 18px; height: 18px; } }
</style>
