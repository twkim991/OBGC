<template>
  <div class="result-backdrop">
    <section class="result-modal" role="dialog" aria-modal="true" aria-labelledby="lost-result-title">
      <p>FINAL DISCOVERY SCORE</p>
      <h2 id="lost-result-title">{{ winnerNames }} 승리</h2>
      <ol>
        <li v-for="player in players" :key="player.sessionId">
          <strong>{{ player.rank }}위 · {{ player.nickname }}</strong>
          <span>누적 {{ player.totalScore }}점 · 마지막 라운드 {{ player.roundScore }}점</span>
        </li>
      </ol>
      <button type="button" @click="$emit('return')">대기방으로 돌아가기</button>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';
const props = defineProps({ players:{type:Array,default:()=>[]}, winnerIds:{type:Array,default:()=>[]} });
defineEmits(['return']);
const winnerNames = computed(() => props.winnerIds.map((id) => props.players.find((player) => player.sessionId === id)?.nickname || '탐험가').join(', '));
</script>

<style scoped>
.result-backdrop{position:fixed;z-index:70;inset:0;display:grid;place-items:center;padding:20px;background:rgba(25,24,22,.48)}.result-modal{width:min(430px,100%);padding:26px;border-radius:12px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.2)}.result-modal>p{margin:0;color:var(--color-muted);font-size:10px;font-weight:800;letter-spacing:.14em}.result-modal h2{margin:7px 0 18px;font-size:25px}.result-modal ol{display:grid;gap:7px;margin:0;padding:0;list-style:none}.result-modal li{display:flex;justify-content:space-between;gap:12px;padding:12px;border-radius:8px;background:var(--color-surface-muted)}.result-modal li strong{font-size:13px}.result-modal li span{color:var(--color-muted);font-size:11px;text-align:right}.result-modal button{width:100%;min-height:44px;margin-top:18px;border:0;border-radius:5px;background:var(--color-primary);color:#fff;font-weight:800;cursor:pointer}
</style>

