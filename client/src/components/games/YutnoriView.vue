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
      </div>
    </header>

    <section class="play-grid">
      <YutBoard
        :game-state="gameState"
        :my-team-color="myTeamColor"
        :rival-team-color="rivalTeamColor"
        :is-my-turn="isMyTurn"
        :my-session-id="mySessionId"
        :selected-piece-index="selectedPieceIndex"
      />

      <div class="controls-stack">
        <YutTurnControls
          :phase-label="phaseLabel"
          :phase-title="phaseTitle"
          :phase-description="phaseDescription"
          :game-phase="gamePhase"
          :player-count="playerCount"
          :is-host="isHost"
          :my-skills="mySkills"
          :is-my-turn="isMyTurn"
          :my-active-skill="myActiveSkill"
          :skill-info="skillInfo"
          :remaining-throws="remainingThrows"
          :selected-throw-index="selectedThrowIndex"
          :my-pieces="myPieces"
          :selected-piece-index="selectedPieceIndex"
          :get-throw-name="getThrowName"
          @start="startGame"
          @activate-skill="activateSkill"
          @throw="throwYut"
          @move="movePiece"
          @select-throw="selectedThrowIndex = $event"
          @select-piece="selectedPieceIndex = $event"
        />

        <GameChatPanel :messages="messages" @send="sendMessage" />
      </div>
    </section>

    <YutResultModal
      v-if="gamePhase === 'finished'"
      :won="winnerSessionId === mySessionId"
      :winner-name="winnerName"
      @return="returnToTable"
      @leave="leave"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import GameChatPanel from './shared/GameChatPanel.vue';
import YutBoard from './yutnori/YutBoard.vue';
import YutResultModal from './yutnori/YutResultModal.vue';
import YutTurnControls from './yutnori/YutTurnControls.vue';
import { YUTNORI_PROTOCOL } from '../../games/yutnori/protocol';
import { toSystemErrorMessage } from '../../games/errors';
import { projectYutnoriState } from '../../games/yutnori/state';

const props = defineProps(['gameConnection']);
const emit = defineEmits(['leave-game', 'move-to-game']);

const gameState = ref(null);
const currentTurnId = ref('');
const messages = ref([]);
const gamePhase = ref('waiting');
const winnerSessionId = ref('');
const selectedPieceIndex = ref(0);
const mySessionId = ref('');
const remainingThrows = ref([]);
const selectedThrowIndex = ref(0);
const privateSkills = ref([]);

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
  return privateSkills.value;
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
  props.gameConnection?.send(YUTNORI_PROTOCOL.messages.activateSkill, skillId);
};

const myPieces = computed(() => {
  if (!gameState.value || !mySessionId.value) return [];
  return gameState.value.players[mySessionId.value]?.pieces || [];
});

let boundConnection = null;

watch(
  () => props.gameConnection,
  (connection) => {
    if (!connection || boundConnection === connection) return;
    boundConnection = connection;
    setupGame(connection);
  },
  { immediate: true }
);

function setupGame(connection) {
  const isFirstConnection = !mySessionId.value;
  mySessionId.value = connection.sessionId;
  if (isFirstConnection) {
    messages.value.push({ clientId: 'System', message: '윷놀이 방에 입장했습니다.' });
  }

  const applyPublicState = (state) => {
    const projected = projectYutnoriState(state);
    gameState.value = projected;
    currentTurnId.value = projected.currentTurnId;
    gamePhase.value = projected.gamePhase;
    winnerSessionId.value = projected.winnerSessionId;
    remainingThrows.value = projected.remainingThrows;

    if (selectedThrowIndex.value >= remainingThrows.value.length) {
      selectedThrowIndex.value = 0;
    }
  };
  connection.onStateChange(applyPublicState);
  if (connection.state) applyPublicState(connection.state);

  connection.onMessage('chat', (data) => {
    messages.value.push(data);
  });

  connection.onMessage(YUTNORI_PROTOCOL.messages.privateSkills, (data) => {
    privateSkills.value = Array.isArray(data?.skills) ? data.skills : [];
  });

  connection.onMessage('room_error', (data) => {
    messages.value.push(toSystemErrorMessage(data));
  });

  connection.onMessage('move_room', (data) => {
    emit('move-to-game', data);
  });

  connection.send(YUTNORI_PROTOCOL.messages.requestPrivateState);
}

const throwYut = () => {
  if (props.gameConnection && isMyTurn.value) {
    props.gameConnection.send(YUTNORI_PROTOCOL.messages.throwYut);
  }
};

const startGame = () => {
  if (props.gameConnection && isHost.value && playerCount.value >= 2) {
    props.gameConnection.send(YUTNORI_PROTOCOL.messages.startGame);
  }
};

const returnToTable = () => {
  props.gameConnection?.send(YUTNORI_PROTOCOL.messages.returnToTable);
};

const movePiece = () => {
  if (!props.gameConnection || !isMyTurn.value || gamePhase.value !== 'moving') return;
  if (!remainingThrows.value.length) return;

  props.gameConnection.send(YUTNORI_PROTOCOL.messages.movePiece, {
    pieceIndex: selectedPieceIndex.value,
    throwIndex: selectedThrowIndex.value,
  });
};

const sendMessage = (message) => {
  if (message && props.gameConnection) props.gameConnection.send('chat', message);
};

const leave = () => emit('leave-game');

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

.play-grid {
  display: grid;
  grid-template-columns: minmax(460px, 1fr) minmax(320px, 400px);
  gap: var(--space-4);
  align-items: start;
}

.controls-stack {
  display: grid;
  gap: var(--space-4);
}

@media (max-width: 1050px) {
  .play-grid {
    grid-template-columns: 1fr;
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
}

@media (max-width: 480px) {
  .topbar-actions {
    flex-direction: column;
  }
}
</style>
