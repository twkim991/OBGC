<!-- client/src/components/games/MapleOneCardView.vue -->
<template>
  <div class="onecard-wrap">
    <h2>메이플 원카드</h2>

    <div class="status">
      <p>현재 색상: {{ state?.currentColor }}</p>
      <p>누적 공격: {{ state?.pendingAttack ?? 0 }}</p>
      <p>현재 턴: {{ currentPlayerName }}</p>
      <p>{{ state?.lastAction }}</p>
    </div>

    <div class="chat-box">
      <div v-for="(msg, index) in messages" :key="index">
        <strong>{{ msg.clientId }}:</strong> {{ msg.message }}
      </div>
    </div>

    <div class="table-area">
      <div class="discard">
        <h3>중앙 카드</h3>
        <div v-if="topCard" class="card">
          {{ formatCard(topCard) }}
        </div>
        <div v-else class="card empty">없음</div>
      </div>
    </div>

    <div class="players">
      <div
        v-for="player in state?.players || []"
        :key="player.sessionId"
        class="player-box"
        :class="{
          current: player.sessionId === state?.players?.[state?.currentPlayerIndex]?.sessionId,
        }"
      >
        <strong>{{ player.nickname }}</strong>
        <div>손패: {{ player.hand.length }}장</div>
        <div v-if="player.rank">순위: {{ player.rank }}위</div>
        <div v-if="player.bankrupt">파산</div>
      </div>
    </div>

    <div class="my-hand">
      <h3>내 손패</h3>
      <div class="cards">
        <button
          v-for="card in myHand"
          :key="card.id"
          class="card-btn"
          :disabled="!isMyTurn || !canPlay(card)"
          @click="onClickCard(card)"
        >
          {{ formatCard(card) }}
        </button>
      </div>
    </div>

    <div class="controls">
      <button v-if="state?.gamePhase === 'waiting'" @click="startGame">게임 시작</button>
      <button v-if="state?.gamePhase === 'playing' && isMyTurn" @click="drawCard">
        {{ state?.pendingAttack > 0 ? `${state.pendingAttack}장 받기` : '카드 1장 뽑기' }}
      </button>
    </div>

    <div v-if="showColorPicker" class="color-picker">
      <p>색을 선택하세요</p>
      <button @click="submitSelectedCard('red')">빨강</button>
      <button @click="submitSelectedCard('yellow')">노랑</button>
      <button @click="submitSelectedCard('green')">초록</button>
      <button @click="submitSelectedCard('blue')">파랑</button>
    </div>

    <div v-if="state?.ended" class="result">
      <h3>게임 종료</h3>
      <ol>
        <li v-for="sid in state.rankings" :key="sid">
          {{ getPlayerName(sid) }}
        </li>
      </ol>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  gameConnection: { type: Object, required: true },
});

const room = computed(() => props.gameConnection ?? null);
const mySessionId = computed(() => props.gameConnection?.sessionId ?? '');

const state = ref(null);
const pendingCard = ref(null);
const showColorPicker = ref(false);
const messages = ref([]);

let boundRoomId = '';

watch(
  room,
  (nextRoom) => {
    if (!nextRoom) return;
    if (boundRoomId === nextRoom.roomId) return;

    nextRoom.onStateChange((newState) => {
      state.value = JSON.parse(JSON.stringify(newState));
    });

    nextRoom.onMessage('chat', (data) => {
      messages.value.push(data);
    });

    nextRoom.onMessage('move_room', (data) => {
      console.log('move_room', data);
    });

    boundRoomId = nextRoom.roomId;
  },
  { immediate: true }
);

const players = computed(() => {
  if (!state.value?.players) return [];
  return Object.values(state.value.players);
});

const myPlayer = computed(() => players.value.find((p) => p.sessionId === mySessionId.value));

const myHand = computed(() => myPlayer.value?.hand || []);

const topCard = computed(() => {
  const pile = state.value?.discardPile || [];
  return pile.length ? pile[pile.length - 1] : null;
});

const isMyTurn = computed(() => {
  return state.value?.currentTurnId === mySessionId.value;
});

const currentPlayerName = computed(() => {
  if (!state.value?.currentTurnId) return '-';
  const player = players.value.find((p) => p.sessionId === state.value.currentTurnId);
  return player?.nickname || state.value.currentTurnId;
});

function formatCard(card) {
  if (!card) return '없음';
  if (card.type === 'number') return `${card.color} ${card.number}`;
  return `${card.color} ${card.type}`;
}

function getPlayerName(sessionId) {
  const player = players.value.find((p) => p.sessionId === sessionId);
  return player?.nickname || sessionId;
}

function canPlay(card) {
  if (!state.value || !isMyTurn.value) return false;

  const top = topCard.value;

  if (state.value.pendingAttack > 0) {
    if (!top) return false;

    if (top.type === 'oz') {
      return ['mihile', 'ikart'].includes(card.type);
    }

    if (['mihile', 'ikart'].includes(card.type)) return true;

    const attackValues = { attack2: 2, attack3: 3, oz: 5 };
    if (!(card.type in attackValues)) return false;

    return attackValues[card.type] >= (attackValues[top.type] || 0);
  }

  if (card.type === 'ikart') return true;
  if (!top) return true;
  if (card.type === 'wild') return true;
  if (card.color === state.value.currentColor) return true;

  if (card.type === 'number' && top.type === 'number' && card.number === top.number) {
    return true;
  }

  const specialTypes = [
    'jump',
    'reverse',
    'plus1',
    'wild',
    'attack2',
    'attack3',
    'oz',
    'mihile',
    'hawkeye',
    'irina',
    'ikart',
  ];

  if (
    specialTypes.includes(card.type) &&
    specialTypes.includes(top.type) &&
    card.type === top.type
  ) {
    return true;
  }

  const attackValues = { attack2: 2, attack3: 3, oz: 5 };
  if (card.type in attackValues && top.type in attackValues) {
    return (
      card.color === state.value.currentColor || attackValues[card.type] === attackValues[top.type]
    );
  }

  return false;
}

function startGame() {
  if (!room.value) return;
  room.value.send('start_game');
}

function drawCard() {
  if (!room.value) return;
  room.value.send('draw_card');
}

function onClickCard(card) {
  if (!room.value) return;

  if (card.type === 'wild' || card.type === 'irina') {
    pendingCard.value = card;
    showColorPicker.value = true;
    return;
  }

  room.value.send('play_card', { cardId: card.id });
}

function submitSelectedCard(color) {
  if (!room.value || !pendingCard.value) return;

  room.value.send('play_card', {
    cardId: pendingCard.value.id,
    chosenColor: color,
  });

  pendingCard.value = null;
  showColorPicker.value = false;
}
</script>

<style scoped>
.onecard-wrap {
  padding: 16px;
}
.players {
  display: flex;
  gap: 12px;
  margin: 16px 0;
}
.player-box {
  border: 1px solid #ccc;
  padding: 8px;
  min-width: 120px;
}
.player-box.current {
  border-color: #333;
  font-weight: bold;
}
.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.card-btn,
.card {
  padding: 8px 10px;
  border: 1px solid #aaa;
  background: white;
}
.empty {
  opacity: 0.5;
}
.color-picker {
  margin-top: 16px;
}
</style>
