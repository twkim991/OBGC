<template>
  <section class="code-area" :class="{ 'my-code': own, eliminated: player.eliminated }">
    <header>
      <div>
        <h2>{{ own ? '내 코드' : `${player.nickname}의 코드` }}</h2>
        <span v-if="player.isHost" class="host-badge">방장</span>
        <span v-if="player.eliminated" class="out-badge">공개 완료</span>
      </div>
      <span>숨김 {{ player.hiddenCount }} · 공개 {{ Math.max(0, tiles.length - player.hiddenCount) }}</span>
    </header>
    <div v-if="tiles.length" class="code-rack">
      <ActionGuard
        v-for="(tile, index) in tiles"
        :key="tile.id"
        :reason="blockedReason(tile, index)"
        :label="`${player.nickname}님의 ${index + 1}번째 타일`"
      >
      <DavinciTile
        :tile="tile"
        :own="own"
        :owner-name="player.nickname"
        :position="index"
        :selectable="selectable && !tile.revealed && !blockedReason(tile, index)"
        :selected="selectedTileId === tile.id"
        @select="$emit('select', { playerId: player.sessionId, tileId: $event, index })"
      />
      </ActionGuard>
    </div>
    <p v-else class="empty-code">
      {{ player.setupComplete ? '코드를 불러오는 중입니다.' : '시작 타일을 선택하고 있습니다.' }}
    </p>
  </section>
</template>

<script setup>
import ActionGuard from '../shared/ActionGuard.vue';
import DavinciTile from './DavinciTile.vue';

defineProps({
  player: { type: Object, required: true },
  tiles: { type: Array, required: true },
  own: { type: Boolean, default: false },
  selectable: { type: Boolean, default: false },
  selectedTileId: { type: String, default: '' },
  blockedReason: { type: Function, default: () => '' },
});
defineEmits(['select']);
</script>

<style scoped>
.code-area { min-width: 0; padding-bottom: 18px; border-bottom: 1px solid var(--color-border-soft); }
.code-area:last-child { border-bottom: 0; }
.code-area.my-code { padding: 16px; border: 0; border-radius: var(--radius-panel); background: var(--color-surface-muted); }
.code-area.eliminated { opacity: .78; }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
header > div { display: flex; align-items: center; gap: 8px; }
h2 { margin: 0; font-size: 18px; }
header > span { color: var(--color-muted); font-size: 12px; }
.host-badge, .out-badge { padding: 2px 6px; border-radius: var(--radius-pill); background: var(--color-surface-muted); color: var(--color-muted); font-size: 10px; font-weight: 700; }
.out-badge { background: color-mix(in srgb, var(--color-danger) 8%, white); color: var(--color-danger); }
.code-rack { min-width: 0; display: flex; gap: 8px; overflow-x: auto; padding: 8px 4px 12px; scrollbar-width: thin; }
.empty-code { min-height: 98px; display: grid; place-items: center; margin: 0; border: 1px dashed var(--color-border); border-radius: var(--radius-small); color: var(--color-muted); font-size: 13px; }
</style>
