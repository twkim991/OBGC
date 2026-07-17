<template>
  <div class="backdrop" role="presentation">
    <section class="result" role="dialog" aria-modal="true" aria-labelledby="halli-result-title">
      <p>GAME FINISHED</p>
      <h2 id="halli-result-title">{{ players[0]?.nickname || '플레이어' }} 승리</h2>
      <ol>
        <li v-for="player in players" :key="player.sessionId">
          <strong>{{ player.rank }}위 · {{ player.nickname }}</strong>
          <span>{{ player.totalCount }}장</span>
        </li>
      </ol>
      <button type="button" @click="$emit('return')">대기방으로 돌아가기</button>
    </section>
  </div>
</template>

<script setup>
defineProps({ players: { type: Array, required: true } });
defineEmits(['return']);
</script>

<style scoped>
.backdrop { position: fixed; z-index: 80; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(32,27,22,.46); }
.result { width: min(430px,100%); padding: 26px; border-radius: var(--radius-panel); background: white; box-shadow: 0 24px 70px rgba(32,27,22,.2); }
.result > p { margin: 0; color: var(--color-muted); font-size: 10px; font-weight: 800; letter-spacing: .12em; }
.result h2 { margin: 5px 0 20px; font-size: 30px; letter-spacing: -.04em; }
.result ol { display: grid; gap: 1px; margin: 0 0 20px; padding: 0; list-style: none; }
.result li { display: flex; justify-content: space-between; gap: 12px; padding: 12px; background: var(--color-surface-muted); font-size: 13px; }
.result li span { color: var(--color-muted); }
.result button { width: 100%; min-height: 46px; border: 0; border-radius: var(--radius-control); background: var(--color-primary); color: white; cursor: pointer; font-weight: 800; }
</style>
