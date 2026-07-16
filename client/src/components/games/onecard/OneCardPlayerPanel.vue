<template>
  <article class="players-panel">
    <div class="panel-heading"><h2>플레이어</h2><span>{{ players.length }}명</span></div>
    <div class="player-list">
      <div v-for="player in players" :key="player.sessionId" class="player-row" :class="{ current: player.sessionId === currentTurnId, me: player.sessionId === mySessionId, bankrupt: player.bankrupt }">
        <span class="avatar" aria-hidden="true">{{ initial(player.nickname) }}</span>
        <div class="player-copy">
          <strong>{{ player.nickname }} <span v-if="player.sessionId === mySessionId" class="me-label">나</span></strong>
          <small v-if="player.bankrupt">파산</small>
          <small v-else-if="player.rank">{{ player.rank }}위로 완료</small>
          <small v-else-if="player.sessionId === currentTurnId">진행 중</small>
          <small v-else>대기 중</small>
        </div>
        <span class="card-count">{{ player.handCount ?? 0 }}장</span>
      </div>
    </div>
  </article>
</template>

<script setup>
defineProps({
  players: { type: Array, required: true },
  currentTurnId: { type: String, default: '' },
  mySessionId: { type: String, required: true },
});
const initial = (nickname) => String(nickname || '?').trim().slice(0, 1);
</script>

<style scoped>
.players-panel { padding: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: var(--color-surface); }
.panel-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-3); }
.panel-heading h2 { margin: 0; font-size: 20px; } .panel-heading span { color: var(--color-muted); font-size: 13px; }
.player-list { display: grid; gap: var(--space-1); }
.player-row { min-height: 58px; display: grid; grid-template-columns: 34px minmax(0,1fr) auto; align-items: center; gap: var(--space-3); padding: var(--space-2); border-bottom: 1px solid var(--color-border-soft); }
.player-row:last-child { border-bottom: 0; } .player-row.current { border-radius: var(--radius-small); border-bottom-color: transparent; background: var(--color-surface-muted); } .player-row.bankrupt { opacity: .55; }
.avatar { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: var(--color-surface-muted); font-size: 13px; font-weight: 800; }
.player-copy { min-width: 0; } .player-copy strong,.player-copy small { display: block; } .player-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .player-copy small { color: var(--color-muted); }
.me-label { margin-left: 4px; color: var(--color-focus); font-size: 11px; }
.card-count { font-family: ui-monospace,'SF Mono',Consolas,monospace; font-size: 13px; font-weight: 700; }
</style>
