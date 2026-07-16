<template>
  <section class="player-panel" aria-labelledby="rummikub-players-title">
    <h2 id="rummikub-players-title">플레이어</h2>
    <ul>
      <li v-for="player in players" :key="player.sessionId" :class="{ current: player.sessionId === currentTurnId, offline: !player.connected }">
        <span class="avatar">{{ player.nickname?.trim()?.slice(0, 1) || '?' }}</span>
        <div>
          <strong>{{ player.nickname }} <small v-if="player.sessionId === mySessionId">나</small></strong>
          <span>{{ player.hasInitialMeld ? '등록 완료' : '등록 전' }} · {{ player.handCount }}개</span>
        </div>
        <b v-if="player.isHost">방장</b>
      </li>
    </ul>
  </section>
</template>

<script setup>
defineProps({
  players: { type: Array, required: true },
  currentTurnId: { type: String, default: '' },
  mySessionId: { type: String, default: '' },
});
</script>

<style scoped>
.player-panel { padding: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: var(--color-surface); }
.player-panel h2 { margin: 0 0 12px; font-size: 17px; }
.player-panel ul { list-style: none; display: grid; gap: 7px; margin: 0; padding: 0; }
.player-panel li { display: grid; grid-template-columns: 34px minmax(0,1fr) auto; align-items: center; gap: 9px; padding: 9px; border: 1px solid transparent; border-radius: 7px; }
.player-panel li.current { border-color: color-mix(in srgb, var(--color-success) 38%, var(--color-border)); background: color-mix(in srgb, var(--color-success) 7%, white); }
.player-panel li.offline { opacity: .48; }
.avatar { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: var(--color-surface-muted); font-weight: 800; }
.player-panel strong,
.player-panel li div > span { display: block; }
.player-panel strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.player-panel strong small { color: var(--color-primary); }
.player-panel li div > span { margin-top: 2px; color: var(--color-muted); font-size: 11px; }
.player-panel li > b { color: var(--color-warning); font-size: 10px; }
</style>

