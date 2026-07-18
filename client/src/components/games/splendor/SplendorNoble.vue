<template>
  <button v-if="selectable" type="button" class="noble" :class="{selected}" :aria-pressed="selected" @click="$emit('select',noble)"><NobleBody :noble="noble" /></button>
  <article v-else class="noble"><NobleBody :noble="noble" /></article>
</template>
<script setup>
import { defineComponent,h } from 'vue';
defineProps({noble:{type:Object,required:true},selectable:Boolean,selected:Boolean});defineEmits(['select']);
const colors=['white','blue','green','red','black'];
const NobleBody=defineComponent({props:{noble:Object},setup(props){return()=>h('div',{class:'body'},[
  h('div',{class:'top'},[h('strong','귀족 후원자'),h('b',String(props.noble.prestige))]),
  h('div',{class:'req'},colors.filter(c=>props.noble.requirement?.[c]>0).map(c=>h('span',{class:`req-${c}`},[h('i'),String(props.noble.requirement[c])]))),
]);}});
</script>
<style scoped>
.noble{min-width:155px;flex:1 0 155px;display:block;padding:0;border:1px solid rgba(0,0,0,.1);border-radius:8px;background:#f6f5f4;color:#282624;text-align:left}.noble[aria-pressed]{cursor:pointer}.noble.selected{border-color:#0075de;box-shadow:0 0 0 2px rgba(0,117,222,.25)}.body{padding:11px}.top{display:flex;justify-content:space-between;gap:8px}.top strong{font-size:11px}.top b{font:800 17px/1 ui-monospace,monospace}.req{display:flex;gap:4px;margin-top:9px}.req span{min-width:28px;height:22px;display:flex;align-items:center;gap:4px;padding:0 5px;border:1px solid rgba(0,0,0,.12);border-radius:999px;font:700 10px/1 ui-monospace,monospace}.req i{width:7px;height:7px;border-radius:50%;background:#aaa}.req-blue i{background:#0879d9}.req-green i{background:#1a9c3b}.req-red i{background:#d63232}.req-black i{background:#31302e}.req-white i{background:#fff;border:1px solid #aaa}
</style>
