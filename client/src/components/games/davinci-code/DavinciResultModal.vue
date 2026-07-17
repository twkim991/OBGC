<template>
  <div class="result-backdrop">
    <section class="result-modal" role="dialog" aria-modal="true" aria-labelledby="davinci-result-title">
      <p>CODE CRACKED</p>
      <h2 id="davinci-result-title">다빈치 코드 결과</h2>
      <ol>
        <li v-for="player in players" :key="player.sessionId">
          <strong>{{ player.rank }}위 · {{ player.nickname }}</strong>
          <span>{{ player.rank === 1 ? '마지막 비공개 코드를 지켰습니다.' : '코드가 공개되었습니다.' }}</span>
        </li>
      </ol>
      <button type="button" @click="$emit('return')">테이블로 돌아가기</button>
    </section>
  </div>
</template>

<script setup>
defineProps({ players: { type: Array, required: true } });
defineEmits(['return']);
</script>

<style scoped>
.result-backdrop { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 20px; background: rgba(24,23,22,.58); }
.result-modal { width: min(440px,100%); padding: 28px; border-radius: var(--radius-large); background: white; box-shadow: 0 24px 80px rgba(0,0,0,.2); }
.result-modal > p { margin: 0 0 4px; color: var(--color-muted); font-size: 11px; font-weight: 800; letter-spacing: .12em; }
h2 { margin: 0; font-size: 28px; }
ol { display: grid; gap: 8px; margin: 22px 0; padding: 0; list-style: none; }
li { display: grid; gap: 2px; padding: 12px; border-bottom: 1px solid var(--color-border-soft); }
li span { color: var(--color-muted); font-size: 12px; }
button { width: 100%; min-height: 46px; border: 0; border-radius: var(--radius-control); background: var(--color-primary); color: white; cursor: pointer; font-weight: 700; }
</style>
