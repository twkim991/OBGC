<template>
  <div class="yut-game">
    <header class="game-topbar">
      <div>
        <p class="eyebrow">플레이 화면</p>
        <h1>초능력 윷놀이</h1>
      </div>
      <div class="topbar-actions">
        <div class="turn-status" role="status">
          <span>현재 턴</span>
          <strong>{{ currentTurnName }} · {{ phaseLabel }}</strong>
        </div>
        <button class="leave-button" type="button" @click="leave">게임 나가기</button>
      </div>
    </header>

    <section class="play-grid">
      <article class="board-panel" aria-labelledby="board-heading">
        <div class="panel-heading board-heading">
          <div>
            <p class="panel-caption">게임 보드</p>
            <h2 id="board-heading">말의 위치</h2>
          </div>
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

            <g v-for="(node, index) in boardNodes" :key="`node-${index}`" class="node-group">
              <circle
                :cx="node.x"
                :cy="node.y"
                :r="index === 0 ? 5 : isCorner(index) ? 3.2 : 2.3"
                :class="['node-circle', { 'start-node': index === 0, 'corner-node': isCorner(index) }]"
              />
              <text :x="node.x" :y="node.y + 1" class="node-text">{{ index }}</text>
            </g>

            <g v-if="gameState?.titans" class="titans-layer">
              <text
                v-for="(titanPos, index) in gameState.titans"
                :key="`titan-${index}`"
                :x="boardNodes[titanPos].x"
                :y="boardNodes[titanPos].y"
                class="titan-icon"
              >
                👹
              </text>
            </g>

            <g v-if="gameState" class="pieces-layer">
              <g v-for="(player, sessionId) in gameState.players" :key="sessionId" class="player-group">
                <g v-for="(piece, pieceIndex) in player.pieces" :key="piece.id" class="piece-group">
                  <circle
                    v-if="piece.position !== 99"
                    :cx="getPieceX(piece.position, pieceIndex)"
                    :cy="getPieceY(piece.position, pieceIndex)"
                    :r="4"
                    :class="[
                      'player-piece',
                      player.teamColor,
                      {
                        highlighted:
                          isMyTurn && sessionId === mySessionId && pieceIndex === selectedPieceIndex,
                        'stealth-active': piece.isStealth,
                      },
                    ]"
                  />
                </g>
              </g>
            </g>
          </svg>
        </div>
      </article>

      <div class="controls-stack">
        <article class="control-panel">
          <div class="panel-heading">
            <h2>이번 턴</h2>
            <span>{{ phaseLabel }}</span>
          </div>

          <div class="phase-copy" role="status" aria-live="polite">
            <strong>{{ phaseTitle }}</strong>
            <span>{{ phaseDescription }}</span>
          </div>

          <div v-if="gamePhase === 'waiting'" class="waiting-actions">
            <p>현재 {{ playerCount }}명 · 2명 이상이면 시작할 수 있습니다.</p>
            <button
              v-if="isHost"
              class="button button-primary"
              :disabled="playerCount < 2"
              type="button"
              @click="startGame"
            >
              윷놀이 시작
            </button>
            <p v-else>방장이 게임을 시작할 때까지 잠시 기다려 주세요.</p>
          </div>

          <section v-if="mySkills.length" class="control-section" aria-labelledby="skills-title">
            <h3 id="skills-title">보유 초능력 · 1회용</h3>
            <div class="skill-list">
              <button
                v-for="skill in mySkills"
                :key="skill"
                class="skill-button"
                :class="{ active: myActiveSkill === skill }"
                :disabled="!isMyTurn || gamePhase !== 'throwing'"
                :aria-pressed="myActiveSkill === skill"
                type="button"
                @click="activateSkill(skill)"
              >
                <span>
                  <strong>{{ skillInfo[skill]?.name || skill }}</strong>
                  <small>{{ skillInfo[skill]?.desc || '이번 턴에 사용할 초능력입니다.' }}</small>
                </span>
                <code>{{ myActiveSkill === skill ? 'ACTIVE' : 'READY' }}</code>
              </button>
            </div>
            <p v-if="myActiveSkill" class="active-skill-notice">
              {{ skillInfo[myActiveSkill]?.name || myActiveSkill }}이 준비됐습니다. 윷을 던지세요.
            </p>
          </section>

          <section v-if="remainingThrows.length" class="control-section" aria-labelledby="throws-title">
            <h3 id="throws-title">보유한 윷 · 이동 결과 선택</h3>
            <div class="throw-row">
              <button
                v-for="(steps, index) in remainingThrows"
                :key="`${steps}-${index}`"
                class="throw-choice"
                :class="{ selected: selectedThrowIndex === index && gamePhase === 'moving' }"
                :disabled="gamePhase !== 'moving'"
                :aria-pressed="selectedThrowIndex === index && gamePhase === 'moving'"
                type="button"
                @click="selectedThrowIndex = index"
              >
                {{ getThrowName(steps) }}
              </button>
            </div>
          </section>

          <section v-if="isMyTurn && myPieces.length" class="control-section" aria-labelledby="pieces-title">
            <h3 id="pieces-title">움직일 내 말</h3>
            <div class="piece-row">
              <button
                v-for="(piece, index) in myPieces"
                :key="piece.id"
                class="piece-choice"
                :class="{
                  selected: selectedPieceIndex === index,
                  finished: piece.position === 99,
                  stealth: piece.isStealth,
                }"
                :disabled="piece.position === 99"
                :aria-pressed="selectedPieceIndex === index"
                type="button"
                @click="selectedPieceIndex = index"
              >
                <strong>말 {{ index + 1 }}</strong>
                <span>
                  {{ piece.position === 99 ? '완주' : piece.position === 0 ? '대기' : `${piece.position}번 칸` }}
                </span>
                <small v-if="piece.isStealth">투명화</small>
              </button>
            </div>
          </section>

          <div class="primary-actions">
            <button
              v-if="isMyTurn && gamePhase === 'throwing'"
              class="button button-primary"
              type="button"
              @click="throwYut"
            >
              윷 던지기
            </button>
            <button
              v-if="isMyTurn && gamePhase === 'moving'"
              class="button button-primary"
              type="button"
              @click="movePiece"
            >
              선택한 말 이동
            </button>
          </div>
        </article>

        <aside class="chat-panel" aria-labelledby="chat-title">
          <div class="panel-heading">
            <h2 id="chat-title">테이블 채팅</h2>
            <span>{{ messages.length }}개</span>
          </div>
          <div ref="chatBox" class="chat-log" role="log" aria-live="polite">
            <p v-if="!messages.length" class="chat-empty">첫 메시지를 보내 대화를 시작해보세요.</p>
            <p v-for="(msg, index) in messages" :key="index" class="message-row">
              <strong :class="{ system: msg.clientId === 'System' }">{{ msg.clientId }}</strong>
              <span>{{ msg.message }}</span>
            </p>
          </div>
          <form class="chat-form" @submit.prevent="sendMessage">
            <input v-model="inputMessage" aria-label="채팅 메시지" placeholder="메시지를 입력하세요" />
            <button type="submit">전송</button>
          </form>
        </aside>
      </div>
    </section>

    <div v-if="gamePhase === 'finished'" class="modal-backdrop">
      <section class="result-modal" role="dialog" aria-modal="true" aria-labelledby="game-result-title">
        <p class="eyebrow">게임 종료</p>
        <template v-if="winnerSessionId === mySessionId">
          <h2 id="game-result-title">승리했습니다.</h2>
          <p>모든 말을 먼저 완주했습니다.</p>
        </template>
        <template v-else>
          <h2 id="game-result-title">게임이 끝났습니다.</h2>
          <p>승리자: <strong>{{ winnerName }}</strong></p>
        </template>
        <div class="result-actions">
          <button class="button button-primary" type="button" @click="returnToTable">
            멤버 그대로 테이블로 복귀
          </button>
          <button class="button button-secondary" type="button" @click="leave">로비로 나가기</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue';

const props = defineProps(['gameConnection']);
const emit = defineEmits(['leave-game', 'move-to-game']);

const gameState = ref(null);
const currentTurnId = ref('');
const messages = ref([]);
const inputMessage = ref('');
const chatBox = ref(null);
const gamePhase = ref('waiting');
const winnerSessionId = ref('');
const selectedPieceIndex = ref(0);
const mySessionId = ref('');
const remainingThrows = ref([]);
const selectedThrowIndex = ref(0);

const myPlayer = computed(() => {
  if (!gameState.value || !mySessionId.value) return null;
  return gameState.value.players[mySessionId.value] ?? null;
});

const playerCount = computed(() => Object.keys(gameState.value?.players ?? {}).length);
const isHost = computed(() => Boolean(myPlayer.value?.isHost));
const myTeamColor = computed(() => myPlayer.value?.teamColor || 'blue');
const rivalTeamColor = computed(() => {
  const rival = Object.values(gameState.value?.players ?? {}).find(
    (player) => player.teamColor !== myTeamColor.value
  );
  return rival?.teamColor || (myTeamColor.value === 'red' ? 'blue' : 'red');
});
const winnerName = computed(() => {
  const winner = gameState.value?.players?.[winnerSessionId.value];
  return winner?.nickname || winnerSessionId.value;
});

const currentTurnName = computed(() => {
  if (gamePhase.value === 'waiting') return '대기 중';
  const player = gameState.value?.players?.[currentTurnId.value];
  return player?.nickname || currentTurnId.value || '-';
});

const phaseLabel = computed(() => {
  const labels = { waiting: '대기', throwing: '던지기', moving: '이동', finished: '종료' };
  return labels[gamePhase.value] || gamePhase.value;
});

const isMyTurn = computed(() => currentTurnId.value === props.gameConnection?.sessionId);

const phaseTitle = computed(() => {
  if (gamePhase.value === 'waiting') return '함께할 플레이어를 기다리고 있습니다.';
  if (gamePhase.value === 'finished') return '게임이 끝났습니다.';
  if (!isMyTurn.value) return `${currentTurnName.value}의 차례입니다.`;
  if (gamePhase.value === 'moving') return '결과와 말을 선택하세요.';
  return '윷을 던질 차례입니다.';
});

const phaseDescription = computed(() => {
  if (gamePhase.value === 'waiting') return '2명 이상 모이면 방장이 게임을 시작할 수 있습니다.';
  if (gamePhase.value === 'finished') return '결과를 확인하고 다음 테이블로 이동하세요.';
  if (!isMyTurn.value) return '상대의 이동이 끝날 때까지 기다려 주세요.';
  if (gamePhase.value === 'moving') return '보유한 윷 결과 하나와 움직일 말을 선택하세요.';
  return '초능력을 먼저 선택하거나 바로 던질 수 있습니다.';
});

const mySkills = computed(() => {
  if (!gameState.value || !mySessionId.value) return [];
  return gameState.value.players[mySessionId.value]?.skills || [];
});

const myActiveSkill = computed(() => {
  if (!gameState.value || !mySessionId.value) return '';
  return gameState.value.players[mySessionId.value]?.activeSkill || '';
});

const skillInfo = {
  MO_MAGNET: { name: '모 확정', desc: '다음 윷 결과를 모로 바꿉니다.' },
  DOUBLE_CAST: { name: '복제 술법', desc: '다음 윷 결과를 한 번 더 얻습니다.' },
  BACK_GEAR: { name: '풀악셀 후진', desc: '다음 결과만큼 뒤로 이동합니다.' },
  EARTHQUAKE: { name: '대지진', desc: '판 위의 모든 말을 대기 위치로 돌려보냅니다.' },
  TITAN_DROP: { name: '거인 투하', desc: '빈 칸에 이동을 막는 거인을 배치합니다.' },
  STEALTH_MODE: { name: '스텔스 모드', desc: '이번에 이동하는 말을 잡히지 않는 상태로 만듭니다.' },
};

const activateSkill = (skillId) => {
  if (!isMyTurn.value || gamePhase.value !== 'throwing') {
    return alert('초능력은 내 턴의 윷 던지기 전에 사용할 수 있습니다.');
  }
  props.gameConnection?.send('activate_skill', skillId);
};

const myPieces = computed(() => {
  if (!gameState.value || !mySessionId.value) return [];
  return gameState.value.players[mySessionId.value]?.pieces || [];
});

const boardNodes = [
  { x: 90, y: 90 },
  { x: 90, y: 74 },
  { x: 90, y: 58 },
  { x: 90, y: 42 },
  { x: 90, y: 26 },
  { x: 90, y: 10 },
  { x: 74, y: 10 },
  { x: 58, y: 10 },
  { x: 42, y: 10 },
  { x: 26, y: 10 },
  { x: 10, y: 10 },
  { x: 10, y: 26 },
  { x: 10, y: 42 },
  { x: 10, y: 58 },
  { x: 10, y: 74 },
  { x: 10, y: 90 },
  { x: 26, y: 90 },
  { x: 42, y: 90 },
  { x: 58, y: 90 },
  { x: 74, y: 90 },
  { x: 76.6, y: 23.4 },
  { x: 63.3, y: 36.7 },
  { x: 50, y: 50 },
  { x: 36.7, y: 63.3 },
  { x: 23.4, y: 76.6 },
  { x: 23.4, y: 23.4 },
  { x: 36.7, y: 36.7 },
  { x: 63.3, y: 63.3 },
  { x: 76.6, y: 76.6 },
];

const getPieceX = (position, index) => {
  if (position === 99) return 0;
  return boardNodes[position].x + (index % 2 === 0 ? -2 : 2);
};

const getPieceY = (position, index) => {
  if (position === 99) return 0;
  return boardNodes[position].y + (index < 2 ? -2 : 2);
};

const isCorner = (index) => [0, 5, 10, 15, 22].includes(index);

onMounted(() => {
  if (props.gameConnection) setupGame();
});

const setupGame = () => {
  const connection = props.gameConnection;
  mySessionId.value = connection.sessionId;
  messages.value.push({ clientId: 'System', message: '윷놀이 방에 입장했습니다.' });

  connection.onStateChange((state) => {
    gameState.value = state.toJSON();
    currentTurnId.value = state.currentTurnId;
    gamePhase.value = state.gamePhase;
    winnerSessionId.value = state.winnerSessionId;
    remainingThrows.value = state.remainingThrows || [];

    if (selectedThrowIndex.value >= remainingThrows.value.length) {
      selectedThrowIndex.value = 0;
    }
  });

  connection.onMessage('chat', (data) => {
    messages.value.push(data);
    scrollToBottom();
  });

  connection.onMessage('move_room', (data) => {
    emit('move-to-game', data);
  });
};

const throwYut = () => {
  if (props.gameConnection && isMyTurn.value) props.gameConnection.send('throw_yut');
};

const startGame = () => {
  if (props.gameConnection && isHost.value && playerCount.value >= 2) {
    props.gameConnection.send('start_game');
  }
};

const returnToTable = () => {
  props.gameConnection?.send('return_to_table');
};

const movePiece = () => {
  if (!props.gameConnection || !isMyTurn.value || gamePhase.value !== 'moving') return;
  if (!remainingThrows.value.length) return;

  props.gameConnection.send('move_piece', {
    pieceIndex: selectedPieceIndex.value,
    throwIndex: selectedThrowIndex.value,
  });
};

const sendMessage = () => {
  if (!inputMessage.value.trim() || !props.gameConnection) return;
  props.gameConnection.send('chat', inputMessage.value);
  inputMessage.value = '';
};

const leave = () => emit('leave-game');

const scrollToBottom = async () => {
  await nextTick();
  if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight;
};

const getThrowName = (steps) => {
  const names = { '-1': '빽도', 1: '도', 2: '개', 3: '걸', 4: '윷', 5: '모' };
  return names[steps] || steps;
};
</script>

<style scoped>
.yut-game {
  display: grid;
  gap: var(--space-5);
  color: var(--color-ink);
}

.game-topbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
}

.eyebrow,
.panel-caption {
  margin: 0 0 var(--space-1);
  color: var(--color-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.game-topbar h1 {
  margin: 0;
  font-size: clamp(30px, 4vw, 48px);
  line-height: 1;
  letter-spacing: -0.035em;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.turn-status {
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid color-mix(in oklab, var(--color-primary), var(--color-border) 74%);
  border-radius: var(--radius-small);
  background: color-mix(in oklab, var(--color-primary) 6%, white);
}

.turn-status span {
  color: var(--color-muted);
  font-size: 13px;
}

.leave-button,
.button {
  min-height: 44px;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  padding: 0 var(--space-4);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.leave-button,
.button-secondary {
  border-color: var(--color-border);
  background: var(--color-surface);
  color: var(--color-danger);
}

.leave-button:hover,
.button-secondary:hover {
  border-color: color-mix(in oklab, var(--color-danger), var(--color-border) 68%);
  background: #fff7f6;
}

.play-grid {
  display: grid;
  grid-template-columns: minmax(460px, 1fr) minmax(320px, 400px);
  gap: var(--space-4);
  align-items: start;
}

.board-panel,
.control-panel,
.chat-panel {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
}

.board-panel {
  min-height: 690px;
  display: grid;
  grid-template-rows: auto 1fr;
  padding: var(--space-5);
  background: color-mix(in oklab, var(--color-surface-muted) 62%, white);
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.board-heading {
  align-items: flex-start;
}

.panel-heading h2 {
  margin: 0;
  font-size: 20px;
  letter-spacing: -0.015em;
}

.panel-heading > span {
  color: var(--color-muted);
  font-size: 13px;
}

.board-legend {
  display: flex;
  gap: var(--space-3);
  color: var(--color-muted);
  font-size: 12px;
}

.board-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-dot.blue {
  background: var(--color-primary);
}

.legend-dot.red {
  background: var(--color-danger);
}

.board-frame {
  width: min(100%, 680px);
  aspect-ratio: 1;
  align-self: center;
  justify-self: center;
}

.yut-board-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.board-line {
  fill: none;
  stroke: var(--color-border);
  stroke-width: 1.3;
}

.node-circle {
  fill: white;
  stroke: var(--color-ink-soft);
  stroke-width: 1;
}

.start-node,
.corner-node {
  fill: var(--color-ink-soft);
}

.node-text {
  fill: var(--color-muted);
  font: 3px ui-monospace, 'SF Mono', Consolas, monospace;
  text-anchor: middle;
  dominant-baseline: central;
}

.start-node + .node-text,
.corner-node + .node-text {
  fill: white;
}

.titan-icon {
  font-size: 7px;
  text-anchor: middle;
  dominant-baseline: central;
}

.player-piece {
  stroke: white;
  stroke-width: 1.2;
  transition:
    cx 200ms cubic-bezier(0.2, 0, 0, 1),
    cy 200ms cubic-bezier(0.2, 0, 0, 1);
}

.player-piece.blue {
  fill: var(--color-primary);
}

.player-piece.red {
  fill: var(--color-danger);
}

.player-piece.green {
  fill: var(--color-success);
}

.player-piece.yellow {
  fill: var(--color-warning);
}

.player-piece.highlighted {
  stroke: var(--color-ink);
  stroke-width: 2.4;
}

.player-piece.stealth-active {
  opacity: 0.45;
  stroke-dasharray: 2 1;
}

.controls-stack {
  display: grid;
  gap: var(--space-4);
}

.control-panel,
.chat-panel {
  padding: var(--space-4);
}

.phase-copy {
  padding: var(--space-3);
  border-radius: var(--radius-small);
  background: var(--color-surface-muted);
}

.phase-copy strong,
.phase-copy span {
  display: block;
}

.phase-copy span {
  margin-top: var(--space-1);
  color: var(--color-muted);
  font-size: 14px;
}

.waiting-actions {
  display: grid;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.waiting-actions p {
  margin: 0;
  color: var(--color-muted);
  font-size: 14px;
}

.control-section {
  margin-top: var(--space-5);
}

.control-section h3 {
  margin: 0 0 var(--space-2);
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.skill-list {
  display: grid;
  gap: var(--space-2);
}

.skill-button {
  min-height: 62px;
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-small);
  background: var(--color-surface);
  color: var(--color-ink);
  text-align: left;
  cursor: pointer;
}

.skill-button:hover:not(:disabled) {
  background: var(--color-surface-muted);
}

.skill-button.active {
  border-color: color-mix(in oklab, var(--color-warning), var(--color-border) 60%);
  background: color-mix(in oklab, var(--color-warning) 7%, white);
}

.skill-button:disabled {
  cursor: not-allowed;
  opacity: 0.46;
}

.skill-button strong,
.skill-button small {
  display: block;
}

.skill-button small {
  margin-top: 2px;
  color: var(--color-muted);
  line-height: 1.35;
}

.skill-button code {
  color: var(--color-warning);
  font: 700 11px/1 ui-monospace, 'SF Mono', Consolas, monospace;
}

.active-skill-notice {
  margin: var(--space-2) 0 0;
  color: var(--color-warning);
  font-size: 13px;
  font-weight: 700;
}

.throw-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}

.throw-choice {
  min-height: 52px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-ink);
  font-weight: 700;
  cursor: pointer;
}

.throw-choice.selected {
  border-color: var(--color-ink);
  background: var(--color-ink);
  color: white;
}

.throw-choice:disabled {
  cursor: not-allowed;
  opacity: 0.46;
}

.piece-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
}

.piece-choice {
  min-height: 62px;
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  color: var(--color-ink);
  cursor: pointer;
}

.piece-choice strong,
.piece-choice span,
.piece-choice small {
  display: block;
}

.piece-choice span,
.piece-choice small {
  color: var(--color-muted);
  font-size: 11px;
}

.piece-choice.selected {
  border-color: color-mix(in oklab, var(--color-primary), var(--color-border) 62%);
  background: color-mix(in oklab, var(--color-primary) 7%, white);
}

.piece-choice.stealth {
  border-color: color-mix(in oklab, var(--color-purple), var(--color-border) 65%);
}

.piece-choice:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.primary-actions {
  display: grid;
  margin-top: var(--space-5);
}

.button-primary {
  min-height: 48px;
  background: var(--color-primary);
  color: white;
  box-shadow: var(--shadow-card);
}

.button-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.chat-log {
  max-height: 220px;
  overflow-y: auto;
  border-top: 1px solid var(--color-border-soft);
  border-bottom: 1px solid var(--color-border-soft);
}

.message-row {
  display: grid;
  grid-template-columns: minmax(72px, 0.3fr) minmax(0, 1fr);
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border-soft);
  font-size: 13px;
  line-height: 1.45;
}

.message-row:last-child {
  border-bottom: 0;
}

.message-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-row span,
.chat-empty {
  color: var(--color-muted);
}

.system {
  color: var(--color-focus);
}

.chat-empty {
  margin: 0;
  padding: var(--space-5) 0;
  text-align: center;
  font-size: 13px;
}

.chat-form {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.chat-form input {
  min-width: 0;
  min-height: 44px;
  flex: 1;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 16px;
}

.chat-form input::placeholder {
  color: var(--color-meta);
}

.chat-form button {
  min-width: 68px;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  background: var(--color-ink);
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: rgba(49, 48, 46, 0.42);
  backdrop-filter: blur(6px);
}

.result-modal {
  width: min(100%, 520px);
  padding: clamp(28px, 6vw, 48px);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-large);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.result-modal h2 {
  margin: 0;
  font-size: clamp(30px, 6vw, 44px);
  letter-spacing: -0.035em;
}

.result-modal > p:not(.eyebrow) {
  margin: var(--space-3) 0 0;
  color: var(--color-muted);
}

.result-actions {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-6);
}

.result-actions .button-secondary {
  color: var(--color-muted);
}

@media (max-width: 1050px) {
  .play-grid {
    grid-template-columns: 1fr;
  }

  .board-panel {
    min-height: auto;
  }
}

@media (max-width: 720px) {
  .game-topbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .topbar-actions {
    width: 100%;
    align-items: stretch;
  }

  .turn-status {
    min-width: 0;
    flex: 1;
    justify-content: space-between;
  }

  .board-panel {
    padding: var(--space-3);
  }

  .board-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .piece-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 480px) {
  .topbar-actions,
  .chat-form {
    flex-direction: column;
  }

  .leave-button,
  .chat-form button {
    width: 100%;
  }

  .throw-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .message-row {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .player-piece {
    transition: none;
  }
}
</style>
