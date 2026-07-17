<template>
  <div class="backdrop">
    <section class="result" role="dialog" aria-modal="true" aria-labelledby="love-result-title">
      <p>LETTER DELIVERED</p>
      <h2 id="love-result-title">{{ winnerNames }} 승리</h2>
      <ol>
        <li v-for="player in players" :key="player.sessionId">
          <strong>{{ player.rank }}위 · {{ player.nickname }}</strong><span>호감 {{ player.favorTokens }}</span>
        </li>
      </ol>
      <button type="button" @click="$emit('return')">대기방으로 돌아가기</button>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';
const props = defineProps({ players: { type: Array, required: true }, winnerIds: { type: Array, required: true } });
defineEmits(['return']);
const winnerNames = computed(() => props.winnerIds.map((id) => props.players.find((player) => player.sessionId === id)?.nickname || id).join(', '));
</script>

<style scoped>
.backdrop{position:fixed;z-index:80;inset:0;display:grid;place-items:center;padding:20px;background:rgba(32,27,22,.48)}.result{width:min(430px,100%);padding:28px;border-radius:12px;background:white;box-shadow:0 24px 70px rgba(32,27,22,.2)}.result>p{margin:0;color:#8b8580;font-size:10px;font-weight:800;letter-spacing:.12em}.result h2{margin:6px 0 20px;font-size:28px}.result ol{display:grid;gap:1px;margin:0 0 20px;padding:0;list-style:none}.result li{display:flex;justify-content:space-between;padding:12px;background:#f5f3f1;font-size:13px}.result li span{color:#77716b}.result button{width:100%;min-height:46px;border:0;border-radius:6px;background:#3568b8;color:white;font-weight:800;cursor:pointer}
</style>
