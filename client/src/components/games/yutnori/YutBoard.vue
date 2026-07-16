<template>
  <article class="board-panel" aria-labelledby="board-heading">
    <div class="panel-heading board-heading">
      <div><p class="panel-caption">게임 보드</p><h2 id="board-heading">말의 위치</h2></div>
      <div class="board-legend" aria-label="말 색상 안내">
        <span><i class="legend-dot" :class="myTeamColor"></i>내 말</span>
        <span><i class="legend-dot" :class="rivalTeamColor"></i>상대 말</span>
      </div>
    </div>
    <div class="board-frame">
      <svg viewBox="0 0 100 100" class="yut-board-svg" role="img" aria-labelledby="board-title board-desc">
        <title id="board-title">초능력 윷놀이 진행 판</title>
        <desc id="board-desc">각 플레이어의 말과 거인 장애물 위치를 보여줍니다.</desc>
        <rect x="10" y="10" width="80" height="80" class="board-line" />
        <line x1="10" y1="10" x2="90" y2="90" class="board-line" />
        <line x1="90" y1="10" x2="10" y2="90" class="board-line" />
        <g v-for="(node, index) in boardNodes" :key="`node-${index}`">
          <circle :cx="node.x" :cy="node.y" :r="index === 0 ? 5 : isCorner(index) ? 3.2 : 2.3" :class="['node-circle', { 'start-node': index === 0, 'corner-node': isCorner(index) }]" />
          <text :x="node.x" :y="node.y + 1" class="node-text">{{ index }}</text>
        </g>
        <text v-for="(titanPos, index) in gameState?.titans || []" :key="`titan-${index}`" :x="boardNodes[titanPos].x" :y="boardNodes[titanPos].y" class="titan-icon">👹</text>
        <g v-for="(player, sessionId) in gameState?.players || {}" :key="sessionId">
          <circle
            v-for="(piece, pieceIndex) in player.pieces"
            v-show="piece.position !== 99"
            :key="piece.id"
            :cx="pieceX(piece.position, pieceIndex)"
            :cy="pieceY(piece.position, pieceIndex)"
            :r="4"
            :class="['player-piece', player.teamColor, { highlighted: isMyTurn && sessionId === mySessionId && pieceIndex === selectedPieceIndex, 'stealth-active': piece.isStealth }]"
          />
        </g>
      </svg>
    </div>
  </article>
</template>

<script setup>
defineProps({
  gameState: { type: Object, default: null }, myTeamColor: { type: String, required: true },
  rivalTeamColor: { type: String, required: true }, isMyTurn: { type: Boolean, required: true },
  mySessionId: { type: String, required: true }, selectedPieceIndex: { type: Number, required: true },
});

const boardNodes = [
  {x:90,y:90},{x:90,y:74},{x:90,y:58},{x:90,y:42},{x:90,y:26},{x:90,y:10},
  {x:74,y:10},{x:58,y:10},{x:42,y:10},{x:26,y:10},{x:10,y:10},{x:10,y:26},
  {x:10,y:42},{x:10,y:58},{x:10,y:74},{x:10,y:90},{x:26,y:90},{x:42,y:90},
  {x:58,y:90},{x:74,y:90},{x:76.6,y:23.4},{x:63.3,y:36.7},{x:50,y:50},
  {x:36.7,y:63.3},{x:23.4,y:76.6},{x:23.4,y:23.4},{x:36.7,y:36.7},
  {x:63.3,y:63.3},{x:76.6,y:76.6},
];
const isCorner = (index) => [0, 5, 10, 15, 22].includes(index);
const pieceX = (position, index) => position === 99 ? 0 : boardNodes[position].x + (index % 2 === 0 ? -2 : 2);
const pieceY = (position, index) => position === 99 ? 0 : boardNodes[position].y + (index < 2 ? -2 : 2);
</script>

<style scoped>
.board-panel { min-height: 690px; display: grid; grid-template-rows: auto 1fr; padding: var(--space-5); border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: color-mix(in oklab, var(--color-surface-muted) 62%, white); }
.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-3); }
.panel-caption { margin: 0 0 var(--space-1); color: var(--color-muted); font-size: 12px; font-weight: 700; letter-spacing: .08em; }
.panel-heading h2 { margin: 0; font-size: 20px; }
.board-legend { display: flex; gap: var(--space-3); color: var(--color-muted); font-size: 12px; }
.board-legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; }
.legend-dot.blue { background: var(--color-primary); } .legend-dot.red { background: var(--color-danger); }
.board-frame { width: min(100%, 680px); aspect-ratio: 1; align-self: center; justify-self: center; }
.yut-board-svg { width: 100%; height: 100%; overflow: visible; }
.board-line { fill: none; stroke: var(--color-border); stroke-width: 1.3; }
.node-circle { fill: white; stroke: var(--color-ink-soft); stroke-width: 1; }
.start-node,.corner-node { fill: var(--color-ink-soft); }
.node-text { fill: var(--color-muted); font: 3px ui-monospace, 'SF Mono', Consolas, monospace; text-anchor: middle; dominant-baseline: central; }
.start-node + .node-text,.corner-node + .node-text { fill: white; }
.titan-icon { font-size: 7px; text-anchor: middle; dominant-baseline: central; }
.player-piece { stroke: white; stroke-width: 1.2; transition: cx 200ms cubic-bezier(.2,0,0,1), cy 200ms cubic-bezier(.2,0,0,1); }
.player-piece.blue { fill: var(--color-primary); } .player-piece.red { fill: var(--color-danger); }
.player-piece.green { fill: var(--color-success); } .player-piece.yellow { fill: var(--color-warning); }
.player-piece.highlighted { stroke: var(--color-ink); stroke-width: 2.4; }
.player-piece.stealth-active { opacity: .45; stroke-dasharray: 2 1; }
@media (max-width: 1050px) { .board-panel { min-height: auto; } }
</style>
