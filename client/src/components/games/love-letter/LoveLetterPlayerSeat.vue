<template>
  <section class="player-seat" :class="{ current, eliminated: player.eliminated, protected: player.protected, own }">
    <div class="avatar">{{ player.nickname?.slice(0, 1) || '?' }}</div>
    <div class="seat-copy">
      <strong>{{ player.nickname }} <i v-if="own">나</i></strong>
      <span v-if="player.eliminated">이번 라운드 탈락</span>
      <span v-else-if="player.protected">시녀의 보호를 받는 중</span>
      <span v-else>{{ current ? '카드를 고르는 중' : `손패 ${player.handCount}장` }}</span>
    </div>
    <div class="favor" :aria-label="`${player.nickname} 호감 토큰 ${player.favorTokens || 0}개, 승리 목표 ${favorTarget}개`">
      <i v-for="index in favorTarget" :key="index" :class="{ filled: index <= (player.favorTokens || 0) }" aria-hidden="true">{{ index <= (player.favorTokens || 0) ? '♥' : '♡' }}</i>
    </div>
  </section>
</template>

<script setup>
defineProps({ player: { type: Object, required: true }, current: Boolean, own: Boolean, favorTarget: { type: Number, default: 0 } });
</script>

<style scoped>
.player-seat { min-width: 170px; display:grid; grid-template-columns:38px 1fr auto; align-items:center; gap:9px; padding:10px; border:1px solid #dedbd7; border-radius:8px; background:rgba(255,255,255,.92); box-shadow:0 4px 14px rgba(35,31,27,.06); }
.player-seat.current { border-color:#3568b8; box-shadow:0 0 0 2px rgba(53,104,184,.11); }
.player-seat.eliminated { opacity:.45; filter:grayscale(.8); }.player-seat.protected { border-color:#7da692; }
.avatar { width:38px;height:38px;display:grid;place-items:center;border-radius:50%;background:#ece9e5;color:#625d58;font-weight:800; }
.current .avatar { background:#3568b8;color:white; }.protected .avatar { background:#4b8a72;color:white; }
.seat-copy strong,.seat-copy span { display:block; }.seat-copy strong{font-size:12px}.seat-copy strong i{font-style:normal;color:#3568b8;font-size:9px}.seat-copy span{margin-top:3px;color:#817b75;font-size:9px}
.favor { display:flex;align-items:center;justify-content:flex-end;gap:2px;white-space:nowrap }.favor i{color:#aaa39e;font:normal 13px/1 Georgia,serif}.favor i.filled{color:#b44367}
</style>
