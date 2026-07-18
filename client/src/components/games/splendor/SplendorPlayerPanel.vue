<template>
  <section class="player" :class="{current,disconnected:!player.connected,own}">
    <div class="head"><strong>{{ player.nickname }} <i v-if="own">나</i></strong><b>{{ player.prestige }}점</b></div>
    <div class="meta"><span>카드 {{ player.developmentCount }}</span><span>토큰 {{ tokenTotal }}</span><span>예약 {{ player.reservedCount }}</span></div>
    <div class="bonuses"><span v-for="color in colors" :key="color" :class="`bonus-${color}`">{{ player.bonuses[color] }}</span></div>
  </section>
</template>
<script setup>
import {computed} from 'vue';
const props=defineProps({player:{type:Object,required:true},current:Boolean,own:Boolean});
const colors=['white','blue','green','red','black'];
const tokenTotal=computed(()=>Object.values(props.player.tokens||{}).reduce((a,b)=>a+b,0));
</script>
<style scoped>
.player{min-width:0;padding:11px;border:1px solid rgba(0,0,0,.1);border-radius:8px;background:#fff}.player.current{border-color:#0075de;box-shadow:0 0 0 2px rgba(0,117,222,.13)}.player.disconnected{opacity:.46}.head,.meta{display:flex;align-items:center;justify-content:space-between;gap:8px}.head strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.head strong i{color:#0075de;font-size:9px;font-style:normal}.head b{font:800 13px/1 ui-monospace,monospace}.meta{margin-top:7px;color:#8a847e;font-size:9px}.bonuses{display:flex;gap:4px;margin-top:8px}.bonuses span{width:21px;height:21px;display:grid;place-items:center;border:1px solid rgba(0,0,0,.13);border-radius:50%;font:800 9px/1 ui-monospace,monospace}.bonus-blue{background:#0879d9;color:#fff}.bonus-green{background:#1a9c3b;color:#fff}.bonus-red{background:#d63232;color:#fff}.bonus-black{background:#31302e;color:#fff}.bonus-white{background:#fff;color:#222}
</style>
