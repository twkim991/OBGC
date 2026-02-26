<template>
  <div class="game-screen yutnori">
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
          <h2 v-if="isMyTurn && gamePhase === 'throwing'" class="my-turn blink">
            🔥 윷을 던지세요!
          </h2>
          <h2 v-else-if="isMyTurn && gamePhase === 'moving'" class="my-turn blink">
            👇 말과 사용할 윷을 선택하세요!
          </h2>
          <h2 v-else>상대방 턴 대기 중...</h2>

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
                :class="{ selected: selectedPieceIndex === idx, finished: piece.position === 99 }"
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
const emit = defineEmits(['leave-game']);

const gameState = ref(null); // 혹시 지워졌다면 다시 추가해줘!
const currentTurnId = ref('');
const lastThrowResult = ref('');
const messages = ref([]);
const inputMessage = ref('');
const chatBox = ref(null);

const gamePhase = ref('waiting');
const selectedPieceIndex = ref(0); // 기본으로 첫 번째 말(0번) 선택
const mySessionId = ref('');

const remainingThrows = ref([]); // 서버에서 넘어올 스택 배열
const selectedThrowIndex = ref(0); // 내가 소비할 스택의 인덱스

// 내 말 4개만 쏙 뽑아오는 계산(Computed) 변수
const myPieces = computed(() => {
  if (!gameState.value || !mySessionId.value) return [];
  const me = gameState.value.players[mySessionId.value];
  return me ? me.pieces : [];
});

// 윷놀이판 29개 노드의 정확한 좌표 (0~100 기준 퍼센트)
const boardNodes = [
  // 우측 하단 (출발점) ~ 우측 상단 (0~5)
  { x: 90, y: 90 },
  { x: 90, y: 74 },
  { x: 90, y: 58 },
  { x: 90, y: 42 },
  { x: 90, y: 26 },
  { x: 90, y: 10 },
  // 우측 상단 ~ 좌측 상단 (6~10)
  { x: 74, y: 10 },
  { x: 58, y: 10 },
  { x: 42, y: 10 },
  { x: 26, y: 10 },
  { x: 10, y: 10 },
  // 좌측 상단 ~ 좌측 하단 (11~15)
  { x: 10, y: 26 },
  { x: 10, y: 42 },
  { x: 10, y: 58 },
  { x: 10, y: 74 },
  { x: 10, y: 90 },
  // 좌측 하단 ~ 우측 하단 직전 (16~19)
  { x: 26, y: 90 },
  { x: 42, y: 90 },
  { x: 58, y: 90 },
  { x: 74, y: 90 },
  // 대각선: 우측 상단 -> 정중앙 (20~21)
  { x: 76.6, y: 23.4 },
  { x: 63.3, y: 36.7 },
  // 정중앙 (22)
  { x: 50, y: 50 },
  // 대각선: 정중앙 -> 좌측 하단 (23~24)
  { x: 36.7, y: 63.3 },
  { x: 23.4, y: 76.6 },
  // 대각선: 좌측 상단 -> 정중앙 (25~26)
  { x: 23.4, y: 23.4 },
  { x: 36.7, y: 36.7 },
  // 대각선: 정중앙 -> 우측 하단 (27~28)
  { x: 63.3, y: 63.3 },
  { x: 76.6, y: 76.6 },
];

// 말이 같은 칸에 있을 때 살짝 흩어지게 보이도록 위치 조정 (최대 4개)
const getPieceX = (pos, index) => {
  if (pos === 99) return 0;
  return boardNodes[pos].x + (index % 2 === 0 ? -2 : 2);
};
const getPieceY = (pos, index) => {
  if (pos === 99) return 0;
  return boardNodes[pos].y + (index < 2 ? -2 : 2);
};

// 모서리와 중앙 노드를 강조하기 위한 헬퍼 함수
const isCorner = (index) => [0, 5, 10, 15, 22].includes(index);

// 현재 턴이 내 세션 ID와 일치하는지 계산
// 내 턴인지 확인하는 computed도 수정
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

    // 🔥 스택(탄창) 정보 실시간 동기화
    remainingThrows.value = state.remainingThrows || [];

    // 남은 스택이 바뀔 때마다 선택값을 0으로 안전하게 초기화
    if (selectedThrowIndex.value >= remainingThrows.value.length) {
      selectedThrowIndex.value = 0;
    }
  });

  connection.onMessage('chat', (data) => {
    messages.value.push(data);
    scrollToBottom();
  });
};

const throwYut = () => {
  if (props.gameConnection && isMyTurn.value) {
    props.gameConnection.send('throw_yut');
  }
};

// 🔥 이동하기 버튼을 눌렀을 때 호출될 함수
// 🔥 서버에 보낼 때 pieceIndex와 throwIndex를 같이 묶어서 전송!
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

// 숫자를 윷 이름으로 바꿔주는 헬퍼
const getThrowName = (steps) => {
  const map = { '-1': '빽도', 1: '도', 2: '개', 3: '걸', 4: '윷', 5: '모' };
  return map[steps] || steps;
};
</script>

<style scoped>
/* 윷놀이 전용 스타일 */
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
.badge {
  display: inline-block;
  background: #34495e;
  color: white;
  padding: 5px 15px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 1.2em;
  margin-top: 10px;
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
} /* 출발점 강조 */
.corner-node {
  fill: #3498db;
} /* 모서리(꺾이는 곳) 강조 */
.node-text {
  font-size: 3px;
  font-weight: bold;
  fill: #2c3e50;
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
}
/* ... 기존 스타일 아래에 추가 ... */
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
/* 새로 추가된 말 선택 및 하이라이트 스타일 */
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

/* SVG 안에서 선택된 말 삐까뻔쩍하게 빛나기 */
.highlighted {
  stroke: #f1c40f !important;
  stroke-width: 2.5px !important;
  filter: drop-shadow(0 0 4px #f1c40f);
}

/* 장전된 윷 스택 스타일 */
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
</style>
