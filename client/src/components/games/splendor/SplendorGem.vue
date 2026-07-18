<template>
  <span class="gem" :class="`gem-${color}`" :aria-label="label" :title="label">{{ short }}</span>
</template>
<script setup>
import { computed } from 'vue';
const props = defineProps({ color: { type:String, required:true } });
const names={white:'다이아몬드',blue:'사파이어',green:'에메랄드',red:'루비',black:'오닉스',gold:'황금'};
const marks={white:'D',blue:'S',green:'E',red:'R',black:'O',gold:'★'};
const label=computed(()=>names[props.color]||props.color);
const short=computed(()=>marks[props.color]||'?');
</script>
<style scoped>
.gem{width:32px;height:32px;display:inline-grid;place-items:center;flex:0 0 auto;border:1px solid rgba(0,0,0,.13);border-radius:50%;font:800 10px/1 ui-monospace,monospace;box-shadow:inset 0 0 0 3px rgba(255,255,255,.2)}.gem-white{background:#fff;color:#282624}.gem-blue{background:#0879d9;color:#fff}.gem-green{background:#1a9c3b;color:#fff}.gem-red{background:#d63232;color:#fff}.gem-black{background:#31302e;color:#fff}.gem-gold{background:#dd7900;color:#fff}
</style>
