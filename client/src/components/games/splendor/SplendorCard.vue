<template>
  <component
    :is="interactive ? 'button' : 'article'"
    :type="interactive ? 'button' : undefined"
    class="development-card"
    :class="[{ selected, affordable }, `tier-${card.tier}`]"
    :aria-pressed="interactive ? selected : undefined"
    @click="interactive && $emit('select', card)"
  >
    <div class="card-body">
      <div class="card-top"><strong>{{ card.prestige }}</strong><SplendorGem :color="card.bonus" /></div>
      <span class="card-name">{{ card.tier }}단계 · {{ names[card.bonus] }} 개발</span>
      <div class="cost-list">
        <span v-for="color in visibleCosts" :key="color" class="cost" :class="`cost-${color}`"><i></i>{{ card.cost[color] }}</span>
      </div>
    </div>
  </component>
</template>
<script setup>
import { computed } from 'vue';
import SplendorGem from './SplendorGem.vue';
const props=defineProps({ card:{type:Object,required:true},interactive:Boolean,selected:Boolean,affordable:Boolean });
defineEmits(['select']);
const colors=['white','blue','green','red','black'];
const names={white:'다이아몬드',blue:'사파이어',green:'에메랄드',red:'루비',black:'오닉스'};
const visibleCosts=computed(()=>colors.filter(color=>props.card.cost?.[color]>0));
</script>
<style scoped>
.development-card{min-height:136px;position:relative;display:block;padding:0;border:1px solid rgba(0,0,0,.11);border-radius:8px;background:#fff;color:#272522;text-align:left;box-shadow:0 3px 12px rgba(34,30,27,.05)}button.development-card{cursor:pointer;transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease}button.development-card:hover{transform:translateY(-2px)}.development-card.selected{border-color:#262421;box-shadow:0 0 0 2px #262421}.development-card.affordable::after{content:'구매 가능';position:absolute;right:7px;bottom:7px;padding:2px 7px;border-radius:999px;background:#edf8f0;color:#178531;font-size:9px;font-weight:800}.card-body{height:100%;min-height:134px;display:grid;grid-template-rows:auto 1fr auto;padding:11px}.card-top{display:flex;align-items:flex-start;justify-content:space-between}.card-top strong{font:800 22px/1 ui-monospace,monospace}.card-name{align-self:center;color:#6f6a65;font-size:11px}.cost-list{display:flex;flex-wrap:wrap;gap:4px}.cost{min-width:26px;height:22px;display:inline-flex;align-items:center;gap:4px;padding:0 5px;border:1px solid rgba(0,0,0,.12);border-radius:999px;font:700 10px/1 ui-monospace,monospace}.cost i{width:7px;height:7px;border-radius:50%;background:#aaa}.cost-blue i{background:#0879d9}.cost-green i{background:#1a9c3b}.cost-red i{background:#d63232}.cost-black i{background:#31302e}.cost-white i{background:#fff;border:1px solid #aaa}.tier-2{background:#fbfaf8}.tier-3{background:#f7f5f1}
</style>
