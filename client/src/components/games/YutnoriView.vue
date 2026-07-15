<template>
  <div class="game-screen yutnori">
    <div v-if="gamePhase === 'finished'" class="game-over-overlay">
      <div class="game-over-modal">
        <template v-if="winnerSessionId === mySessionId">
          <h1 class="win-title">🎉 완벽한 압승! 🎉</h1>
          <p class="sub-text">상대방을 무참히 짓밟고 윷놀이를 제패하셨습니다.</p>
        </template>

        <template v-else>
          <h1 class="lose-title">💀 처참한 패배... 💀</h1>
          <p class="sub-text">
            승리자: <strong>{{ winnerName }}</strong>
          </p>
          <p class="sub-text">다음엔 꼭 복수하세요.</p>
        </template>

        <div class="action-buttons">
          <button @click="returnToTable" class="return-btn">🔥 멤버 그대로 대기실 복귀</button>
          <button @click="leave" class="leave-btn-small">파티 탈퇴 (로비로)</button>
        </div>
      </div>
    </div>
    <div class="header">
      <h1>🎲 윷놀이 한 판!</h1>
      <button @click="leave" class="leave-btn">게임 포기</button>
    </div>

    <div class="game-area">
      <div class="board">
        <svg viewBox="0 0 100 100" class="yut-board-svg">
          <rect x="10" y="10" width="80" height="80" class="board-line" />
          <line x1="10" y1="10" x2="90" y2="90" class="board-line" />
          <line x1="90" y1="10" x2="10" y2="90" class="board-line" />

          <g v-for="(node, index) in boardNodes" :key="'node-' + index" class="node-group">
            <circle
              :cx="node.x"
              :cy="node.y"
              :r="index === 0 ? 5 : 3"
              :class="[
                'node-circle',
                { 'start-node': index === 0, 'corner-node': isCorner(index) },
              ]"
            />
            <text :x="node.x" :y="node.y + 1" class="node-text">{{ index }}</text>
          </g>

          <g v-if="gameState && gameState.titans" class="titans-layer">
            <text
              v-for="(titanPos, idx) in gameState.titans"
              :key="'titan-' + idx"
              :x="boardNodes[titanPos].x"
              :y="boardNodes[titanPos].y"
              class="titan-icon blink"
            >
              👹
            </text>
          </g>

          <g v-if="gameState" class="pieces-layer">
            <g
              v-for="(player, sessionId) in gameState.players"
              :key="sessionId"
              class="player-group"
            >
              <g v-for="(piece, pieceIdx) in player.pieces" :key="piece.id" class="piece-group">
                <circle
                  v-if="piece.position !== 99"
                  :cx="getPieceX(piece.position, pieceIdx)"
                  :cy="getPieceY(piece.position, pieceIdx)"
                  :r="4"
                  :class="[
                    'player-piece',
                    player.teamColor,
                    {
                      highlighted:
                        isMyTurn && sessionId === mySessionId && pieceIdx === selectedPieceIndex,
                      'stealth-active': piece.isStealth, // 🔥 2. 스텔스 클래스 동적 부여
                    },
                  ]"
                />
              </g>
            </g>
          </g>
        </svg>
      </div>

      <div class="controls">
        <div class="status-panel">
          <template v-if="gamePhase === 'waiting'">
            <h2>함께할 플레이어를 기다리는 중</h2>
            <p class="waiting-copy">현재 {{ playerCount }}명 · 2명 이상이면 시작할 수 있습니다.</p>
            <button
              v-if="isHost"
              class="start-btn"
              :disabled="playerCount < 2"
              @click="startGame"
            >
              윷놀이 시작
            </button>
            <p v-else class="waiting-notice">방장이 게임을 시작할 때까지 잠시 기다려 주세요.</p>
          </template>
          <h2 v-else-if="isMyTurn && gamePhase === 'throwing'" class="my-turn blink">
            🔥 윷을 던지세요!
          </h2>
          <h2 v-else-if="isMyTurn && gamePhase === 'moving'" class="my-turn blink">
            👇 말과 사용할 윷을 선택하세요!
          </h2>
          <h2 v-else>상대방 턴 대기 중...</h2>

          <div v-if="mySkills.length > 0" class="skills-section">
            <h4>✨ 내 보유 초능력 (1회용)</h4>
            <div class="skills-row">
              <div
                v-for="skill in mySkills"
                :key="skill"
                class="skill-card"
                :class="{
                  disabled: !isMyTurn || gamePhase !== 'throwing',
                  active: myActiveSkill === skill,
                }"
                @click="activateSkill(skill)"
              >
                <div class="skill-name">{{ skillInfo[skill].name }}</div>
                <div class="skill-desc">{{ skillInfo[skill].desc }}</div>
              </div>
            </div>
            <div v-if="myActiveSkill" class="active-skill-notice blink">
              ⚡ [{{ skillInfo[myActiveSkill].name }}] 장전 완료! 어서 윷을 던지세요!
            </div>
          </div>

          <div v-if="remainingThrows.length > 0" class="throw-stack">
            <h4>보유한 윷 (클릭해서 선택)</h4>
            <div class="stack-row">
              <div
                v-for="(steps, idx) in remainingThrows"
                :key="idx"
                class="stack-item"
                :class="{ selected: selectedThrowIndex === idx && gamePhase === 'moving' }"
                @click="gamePhase === 'moving' ? (selectedThrowIndex = idx) : null"
              >
                {{ getThrowName(steps) }}
              </div>
            </div>
          </div>

          <div v-if="isMyTurn" class="piece-selection">
            <h4>내 말 선택</h4>
            <div class="pieces-row">
              <div
                v-for="(piece, idx) in myPieces"
                :key="piece.id"
                class="piece-selector"
                :class="{
                  selected: selectedPieceIndex === idx,
                  finished: piece.position === 99,
                  'stealth-ui': piece.isStealth,
                }"
                @click="piece.position !== 99 ? (selectedPieceIndex = idx) : null"
              >
                말 {{ idx + 1 }}
                <div class="pos-text">
                  {{
                    piece.position === 99
                      ? '완주'
                      : piece.position === 0
                        ? '대기'
                        : `${piece.position}번칸`
                  }}
                </div>
                <div v-if="piece.isStealth" class="stealth-badge">👻 투명화</div>
              </div>
            </div>
          </div>
        </div>

        <button v-if="isMyTurn && gamePhase === 'throwing'" @click="throwYut" class="throw-btn">
          🎲 윷 던지기!
        </button>
        <button v-if="isMyTurn && gamePhase === 'moving'" @click="movePiece" class="move-btn">
          📍 선택한 말 이동하기!
        </button>
      </div>
    </div>

    <div class="mini-chat">
      <div class="chat-box" ref="chatBox">
        <div v-for="(msg, index) in messages" :key="index" class="message">
          <strong :class="{ system: msg.clientId === 'System' }">{{ msg.clientId }}:</strong>
          {{ msg.message }}
        </div>
      </div>
      <form @submit.prevent="sendMessage">
        <input v-model="inputMessage" placeholder="메시지..." />
        <button type="submit">전송</button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue';

const props = defineProps(['gameConnection']);
const emit = defineEmits(['leave-game', 'move-to-game']);

const gameState = ref(null);
const currentTurnId = ref('');
const lastThrowResult = ref('');
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
const winnerName = computed(() => {
  const winner = gameState.value?.players?.[winnerSessionId.value];
  return winner?.nickname || winnerSessionId.value;
});

const mySkills = computed(() => {
  if (!gameState.value || !mySessionId.value) return [];
  const me = gameState.value.players[mySessionId.value];
  return me ? me.skills : [];
});

const myActiveSkill = computed(() => {
  if (!gameState.value || !mySessionId.value) return '';
  const me = gameState.value.players[mySessionId.value];
  return me ? me.activeSkill : '';
});

const skillInfo = {
  MO_MAGNET: { name: '🧲 모 확정', desc: '다음 윷은 무조건 [모]가 터집니다.' },
  DOUBLE_CAST: { name: '👯 복제 술법', desc: '다음 윷 결과를 2배로 복제합니다.' },
  BACK_GEAR: { name: '⏪ 풀악셀 후진', desc: '다음 윷 숫자만큼 무자비하게 뒤로 갑니다.' },
  EARTHQUAKE: { name: '💥 대지진', desc: '(즉발) 판 위의 모든 말을 대기실로 쳐박습니다.' },
  TITAN_DROP: { name: '👣 무지성거인 투하', desc: '(즉발) 빈 칸에 길막용 거인을 떨어뜨립니다.' },
  STEALTH_MODE: {
    name: '👻 스텔스 모드',
    desc: '이번에 이동하는 말을 투명 상태(잡히지 않음)로 만듭니다.',
  },
};

const activateSkill = (skillId) => {
  if (!isMyTurn.value || gamePhase.value !== 'throwing') {
    return alert('초능력은 내 턴의 [윷 던지기] 직전에만 쓸 수 있습니다!');
  }
  if (props.gameConnection) {
    props.gameConnection.send('activate_skill', skillId);
  }
};

const myPieces = computed(() => {
  if (!gameState.value || !mySessionId.value) return [];
  const me = gameState.value.players[mySessionId.value];
  return me ? me.pieces : [];
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

const getPieceX = (pos, index) => {
  if (pos === 99) return 0;
  return boardNodes[pos].x + (index % 2 === 0 ? -2 : 2);
};
const getPieceY = (pos, index) => {
  if (pos === 99) return 0;
  return boardNodes[pos].y + (index < 2 ? -2 : 2);
};

const isCorner = (index) => [0, 5, 10, 15, 22].includes(index);

const isMyTurn = computed(() => {
  return currentTurnId.value === props.gameConnection?.sessionId;
});

onMounted(() => {
  if (props.gameConnection) {
    setupGame();
  }
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
  if (props.gameConnection && isMyTurn.value) {
    props.gameConnection.send('throw_yut');
  }
};

const startGame = () => {
  if (props.gameConnection && isHost.value && playerCount.value >= 2) {
    props.gameConnection.send('start_game');
  }
};

const returnToTable = () => {
  if (props.gameConnection) {
    props.gameConnection.send('return_to_table');
  }
};

const movePiece = () => {
  if (props.gameConnection && isMyTurn.value && gamePhase.value === 'moving') {
    if (remainingThrows.value.length === 0) return;

    props.gameConnection.send('move_piece', {
      pieceIndex: selectedPieceIndex.value,
      throwIndex: selectedThrowIndex.value,
    });
  }
};

const sendMessage = () => {
  if (!inputMessage.value.trim() || !props.gameConnection) return;
  props.gameConnection.send('chat', inputMessage.value);
  inputMessage.value = '';
};

const leave = () => {
  emit('leave-game');
};

const scrollToBottom = async () => {
  await nextTick();
  if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight;
};

const getThrowName = (steps) => {
  const map = { '-1': '빽도', 1: '도', 2: '개', 3: '걸', 4: '윷', 5: '모' };
  return map[steps] || steps;
};
</script>

<style scoped>
/* 기존 스타일은 그대로 유지 */
.game-screen {
  background: white;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #eee;
  padding-bottom: 20px;
  margin-bottom: 20px;
}
.leave-btn {
  background: #e74c3c;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
}
.game-area {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}
.board {
  flex: 2;
  background: #ecf0f1;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  border: 2px dashed #bdc3c7;
}
.controls {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.status-panel {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid #e9ecef;
  text-align: center;
}
.my-turn {
  color: #e74c3c;
}
.throw-btn {
  background: #2ecc71;
  color: white;
  font-size: 1.5em;
  font-weight: bold;
  padding: 20px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 4px 0 #27ae60;
  transition: all 0.1s;
}
.throw-btn:active {
  transform: translateY(4px);
  box-shadow: none;
}
.mini-chat {
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 10px;
}
.chat-box {
  height: 150px;
  overflow-y: auto;
  margin-bottom: 10px;
  font-size: 0.9em;
}
.system {
  color: #9b59b6;
  font-weight: bold;
}
form {
  display: flex;
  gap: 10px;
}
input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}
button[type='submit'] {
  background: #95a5a6;
  color: white;
  border: none;
  padding: 0 15px;
  border-radius: 4px;
}

/* SVG 보드판 스타일 */
.yut-board-svg {
  width: 100%;
  max-width: 400px;
  height: auto;
  display: block;
  margin: 0 auto;
}
.board-line {
  fill: none;
  stroke: #bdc3c7;
  stroke-width: 0.5;
}
.node-circle {
  fill: #ecf0f1;
  stroke: #7f8c8d;
  stroke-width: 1;
  transition: all 0.3s;
}
.start-node {
  fill: #f39c12;
  stroke: #e67e22;
  stroke-width: 1.5;
}
.corner-node {
  fill: #3498db;
}
.node-text {
  font-size: 3px;
  font-weight: bold;
  fill: #2c3e50;
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
}

/* 말 스타일 */
.player-piece {
  stroke: white;
  stroke-width: 0.8;
  transition: all 0.5s ease-in-out;
}
.player-piece.red {
  fill: #e74c3c;
}
.player-piece.blue {
  fill: #3498db;
}
.highlighted {
  stroke: #f1c40f !important;
  stroke-width: 2.5px !important;
  filter: drop-shadow(0 0 4px #f1c40f);
}

/* 🔥 SVG 환경에 맞춘 무지성거인 아이콘 */
.titan-icon {
  font-size: 7px;
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
  filter: drop-shadow(0 0 2px rgba(255, 0, 0, 0.8));
}

/* 🔥 SVG 환경에 맞춘 스텔스 말 시각 효과 (반투명 + 점선 테두리) */
.stealth-active {
  opacity: 0.4;
  stroke: #fff !important;
  stroke-dasharray: 1 1;
  stroke-width: 1.2px !important;
}

/* 말 선택기 스타일 */
.piece-selection {
  margin-top: 15px;
  border-top: 2px dashed #eee;
  padding-top: 15px;
}
.pieces-row {
  display: flex;
  gap: 8px;
  justify-content: center;
}
.piece-selector {
  padding: 8px;
  border: 2px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  background: white;
  flex: 1;
  transition: all 0.2s;
  position: relative;
}
.piece-selector:hover:not(.finished) {
  border-color: #3498db;
}
.piece-selector.selected {
  border-color: #e74c3c;
  background: #ffeaa7;
  font-weight: bold;
  transform: translateY(-2px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
.piece-selector.finished {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f9f9f9;
}
.pos-text {
  font-size: 0.8em;
  color: #7f8c8d;
  margin-top: 4px;
}
.stealth-badge {
  font-size: 0.7em;
  color: #9b59b6;
  font-weight: bold;
  margin-top: 4px;
}
.piece-selector.stealth-ui {
  border-color: #9b59b6;
  background: #fdfaf6;
}

.move-btn {
  background: #9b59b6;
  color: white;
  font-size: 1.5em;
  font-weight: bold;
  padding: 20px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 4px 0 #8e44ad;
  transition: all 0.1s;
}
.move-btn:active {
  transform: translateY(4px);
  box-shadow: none;
}

.throw-stack {
  margin-top: 15px;
  border-top: 2px dashed #eee;
  padding-top: 15px;
}
.stack-row {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}
.stack-item {
  background: #ecf0f1;
  padding: 10px 20px;
  border-radius: 20px;
  font-weight: bold;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
}
.stack-item:hover {
  border-color: #bdc3c7;
}
.stack-item.selected {
  background: #34495e;
  color: white;
  border-color: #2c3e50;
  transform: scale(1.1);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
}

.game-over-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  backdrop-filter: blur(5px);
}
.game-over-modal {
  background: white;
  padding: 50px;
  border-radius: 20px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
@keyframes popIn {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
.win-title {
  color: #f1c40f;
  font-size: 2.5em;
  margin-bottom: 10px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
.lose-title {
  color: #e74c3c;
  font-size: 2.5em;
  margin-bottom: 10px;
}
.sub-text {
  font-size: 1.2em;
  color: #555;
  margin-bottom: 30px;
}
.return-btn {
  background: #34495e;
  color: white;
  border: none;
  padding: 15px 30px;
  font-size: 1.2em;
  font-weight: bold;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s;
}
.return-btn:hover {
  background: #2c3e50;
}
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}
.leave-btn-small {
  background: transparent;
  color: #95a5a6;
  border: 1px solid #bdc3c7;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.leave-btn-small:hover {
  background: #ecf0f1;
  color: #e74c3c;
  border-color: #e74c3c;
}

.skills-section {
  margin-top: 15px;
  padding: 15px;
  background: #2c3e50;
  border-radius: 12px;
  color: white;
}
.skills-section h4 {
  margin: 0 0 10px 0;
  color: #f1c40f;
}
.skills-row {
  display: flex;
  gap: 10px;
}
.skill-card {
  flex: 1;
  padding: 10px;
  background: linear-gradient(135deg, #34495e, #2c3e50);
  border: 2px solid #7f8c8d;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.skill-card:hover:not(.disabled) {
  border-color: #f1c40f;
  transform: translateY(-3px);
  box-shadow: 0 5px 15px rgba(241, 196, 15, 0.3);
}
.skill-name {
  font-weight: bold;
  font-size: 1.1em;
  margin-bottom: 5px;
  color: #ecf0f1;
}
.skill-desc {
  font-size: 0.75em;
  color: #bdc3c7;
  line-height: 1.3;
}
.skill-card.active {
  border-color: #e74c3c;
  background: linear-gradient(135deg, #c0392b, #e74c3c);
  box-shadow: 0 0 15px rgba(231, 76, 60, 0.6);
}
.skill-card.disabled {
  opacity: 0.5;
  filter: grayscale(100%);
  cursor: not-allowed;
}
.active-skill-notice {
  margin-top: 10px;
  color: #e74c3c;
  font-weight: bold;
  font-size: 1.1em;
  text-align: center;
}
</style>

<style scoped>
/* Notion 기반 UI 리프레시: 게임 로직과 SVG 보드는 유지하고 표현만 통일합니다. */
.game-screen {
  display: grid;
  gap: var(--space-6);
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
  color: var(--color-ink);
  box-shadow: var(--shadow-card);
}

.header {
  margin: 0;
  padding: 0 0 var(--space-5);
  border-bottom: 1px solid var(--color-border-soft);
}

.header h1 {
  margin: 0;
  font-size: clamp(30px, 4.5vw, 46px);
  line-height: 1.05;
  letter-spacing: -0.04em;
}

.leave-btn {
  min-height: 44px;
  padding: 0 var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-danger);
  font-size: 14px;
  font-weight: 700;
}

.leave-btn:hover {
  border-color: rgba(201, 54, 43, 0.28);
  background: #fff7f6;
}

.game-area {
  display: grid;
  grid-template-columns: minmax(360px, 1.25fr) minmax(300px, 0.75fr);
  gap: var(--space-6);
  margin: 0;
  align-items: start;
}

.board {
  min-height: 0;
  aspect-ratio: 1;
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface-muted);
}

.yut-board-svg {
  width: min(100%, 560px);
  max-width: none;
}

.board-line {
  stroke: #a39e98;
  stroke-width: 0.45;
}

.node-circle {
  fill: #ffffff;
  stroke: #8f8984;
  stroke-width: 0.8;
}

.start-node {
  fill: #fff3db;
  stroke: var(--color-warning);
}

.corner-node {
  fill: #f2f9ff;
  stroke: var(--color-primary);
}

.node-text {
  fill: var(--color-ink-soft);
  font-weight: 700;
}

.player-piece {
  stroke: #ffffff;
  stroke-width: 1;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.16));
}

.player-piece.red {
  fill: #c9362b;
}

.player-piece.blue {
  fill: #0075de;
}

.highlighted {
  stroke: #ffd43b !important;
  stroke-width: 2.4px !important;
  filter: drop-shadow(0 0 4px rgba(221, 91, 0, 0.42));
}

.controls {
  gap: var(--space-3);
}

.status-panel {
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
  text-align: left;
}

.status-panel h2 {
  margin-bottom: var(--space-4);
  font-size: clamp(21px, 2.5vw, 27px);
  line-height: 1.2;
}

.my-turn {
  color: var(--color-primary);
}

.waiting-copy,
.waiting-notice {
  margin: 0 0 var(--space-4);
  color: var(--color-muted);
  line-height: 1.6;
}

.start-btn {
  width: 100%;
  min-height: 48px;
  border: 0;
  border-radius: var(--radius-control);
  background: var(--color-primary);
  color: white;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.start-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.start-btn:disabled {
  background: var(--color-border);
  color: var(--color-muted);
  cursor: not-allowed;
}

.piece-selection,
.throw-stack {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border-soft);
}

.piece-selection h4,
.throw-stack h4 {
  margin-bottom: var(--space-3);
  color: var(--color-muted);
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.pieces-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
}

.piece-selector {
  min-width: 0;
  padding: var(--space-3) var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-small);
  background: var(--color-surface);
  text-align: center;
}

.piece-selector:hover:not(.finished) {
  border-color: rgba(0, 117, 222, 0.42);
  background: #f8fbff;
}

.piece-selector.selected {
  border-color: var(--color-primary);
  background: #f2f9ff;
  color: var(--color-primary-hover);
  box-shadow: inset 0 0 0 1px rgba(0, 117, 222, 0.12);
  transform: none;
}

.piece-selector.finished {
  background: var(--color-surface-muted);
}

.piece-selector.stealth-ui {
  border-color: rgba(109, 74, 255, 0.4);
  background: #f7f5ff;
}

.pos-text {
  color: var(--color-muted);
  font-size: 12px;
}

.stealth-badge {
  color: var(--color-purple);
}

.stack-row {
  justify-content: flex-start;
  gap: var(--space-2);
}

.stack-item {
  padding: 7px var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  font-size: 13px;
}

.stack-item:hover {
  border-color: var(--color-meta);
}

.stack-item.selected {
  border-color: var(--color-ink);
  background: var(--color-ink);
  color: white;
  box-shadow: none;
  transform: none;
}

.skills-section {
  margin-top: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-small);
  background: var(--color-ink-soft);
}

.skills-section h4 {
  margin-bottom: var(--space-3);
  color: #ffffff;
  font-size: 13px;
}

.skills-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.skill-card {
  min-width: 0;
  padding: var(--space-3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-control);
  background: rgba(255, 255, 255, 0.07);
}

.skill-card:hover:not(.disabled) {
  border-color: rgba(255, 255, 255, 0.6);
  box-shadow: none;
  transform: none;
}

.skill-card.active {
  border-color: #62aef0;
  background: rgba(0, 117, 222, 0.28);
  box-shadow: inset 0 0 0 1px rgba(98, 174, 240, 0.28);
}

.skill-name {
  color: white;
  font-size: 14px;
}

.skill-desc {
  color: rgba(255, 255, 255, 0.68);
  font-size: 12px;
  line-height: 1.45;
}

.active-skill-notice {
  color: #8fc9ff;
  font-size: 13px;
}

.throw-btn,
.move-btn {
  min-height: 58px;
  padding: 0 var(--space-5);
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  background: var(--color-primary);
  color: white;
  box-shadow: none;
  font-size: 17px;
  font-weight: 700;
}

.throw-btn:hover,
.move-btn:hover {
  background: var(--color-primary-hover);
}

.throw-btn:active,
.move-btn:active {
  box-shadow: none;
  transform: scale(0.98);
}

.mini-chat {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
}

.chat-box {
  height: 156px;
  margin-bottom: var(--space-3);
  padding: var(--space-2);
  border-radius: var(--radius-small);
  background: var(--color-surface-muted);
  color: var(--color-ink-soft);
}

.message {
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border-soft);
  line-height: 1.45;
}

.message:last-child {
  border-bottom: 0;
}

.system {
  color: var(--color-focus);
}

form {
  gap: var(--space-2);
}

input {
  min-width: 0;
  min-height: 44px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: white;
  color: var(--color-ink);
  font-size: 16px;
}

input:focus {
  border-color: var(--color-primary);
}

button[type='submit'] {
  min-height: 44px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-control);
  background: var(--color-ink);
  font-weight: 700;
  cursor: pointer;
}

.game-over-overlay {
  padding: var(--space-4);
  background: rgba(49, 48, 46, 0.74);
  backdrop-filter: blur(8px);
}

.game-over-modal {
  width: min(100%, 520px);
  padding: clamp(28px, 6vw, 48px);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-large);
  background: white;
  box-shadow: var(--shadow-card);
}

.win-title,
.lose-title {
  margin-bottom: var(--space-3);
  font-size: clamp(30px, 7vw, 44px);
  text-shadow: none;
}

.win-title {
  color: var(--color-warning);
}

.lose-title {
  color: var(--color-danger);
}

.sub-text {
  margin-bottom: var(--space-4);
  color: var(--color-muted);
  font-size: 16px;
}

.return-btn,
.leave-btn-small {
  min-height: 46px;
  border-radius: var(--radius-control);
  font-size: 14px;
}

.return-btn {
  background: var(--color-primary);
}

.return-btn:hover {
  background: var(--color-primary-hover);
}

.leave-btn-small {
  border-color: var(--color-border);
  color: var(--color-muted);
}

@media (max-width: 920px) {
  .game-area {
    grid-template-columns: 1fr;
  }

  .board {
    width: min(100%, 680px);
    justify-self: center;
  }
}

@media (max-width: 600px) {
  .game-screen {
    padding: var(--space-4);
  }

  .header {
    align-items: flex-start;
    gap: var(--space-4);
  }

  .header h1 {
    font-size: 30px;
  }

  .leave-btn {
    padding: 0 var(--space-3);
  }

  .board {
    padding: var(--space-3);
  }

  .status-panel {
    padding: var(--space-4);
  }

  .pieces-row,
  .skills-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  form {
    flex-direction: column;
  }

  button[type='submit'] {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .player-piece,
  .skill-card,
  .piece-selector,
  .game-over-modal {
    animation: none;
    transition: none;
  }
}
</style>
