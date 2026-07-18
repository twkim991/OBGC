<template>
  <div class="love-game">
    <header class="game-topbar">
      <div>
        <p class="eyebrow">A GAME OF RISK, DEDUCTION &amp; LUCK</p>
        <h1>러브레터</h1>
        <p>한 장의 손패와 눈앞의 행동을 기억해 마지막까지 공주의 마음에 닿으세요.</p>
      </div>
      <div class="turn-chip" :class="{ mine: isMyTurn }" role="status">
        <span>{{ turnStatus.label }}</span><strong>{{ turnStatus.value }}</strong>
      </div>
    </header>

    <section class="status-strip" aria-label="플레이어별 호감 토큰" :style="{ '--player-count': Math.max(players.length, 1) }">
      <div v-for="player in players" :key="player.sessionId" :class="{ mine: player.sessionId === mySessionId }" :aria-label="`${player.nickname} 호감 토큰 ${player.favorTokens || 0}개, 승리 목표 ${state?.favorTarget || 0}개`">
        <span>{{ player.nickname }}{{ player.sessionId === mySessionId ? ' (나)' : '' }}</span>
        <div class="favor-hearts" aria-hidden="true">
          <i v-for="index in state?.favorTarget || 0" :key="index" :class="{ filled: index <= (player.favorTokens || 0) }">{{ index <= (player.favorTokens || 0) ? '♥' : '♡' }}</i>
        </div>
      </div>
    </section>

    <p v-if="errorMessage" class="error-banner" role="alert">{{ errorMessage }}</p>

    <section v-if="state?.gamePhase === 'waiting'" class="waiting-panel">
      <div><strong>{{ isHost ? '편지를 전달할 준비가 됐나요?' : '방장이 게임을 시작할 때까지 기다려주세요.' }}</strong><span>현재 {{ connectedPlayerCount }}명 · 2~6명 플레이</span></div>
      <button v-if="isHost" type="button" :disabled="connectedPlayerCount < 2" @click="startGame">게임 시작</button>
    </section>

    <template v-else>
      <section class="play-grid">
        <article class="table-panel">
          <div class="panel-heading"><h2>왕궁 테이블</h2><span>누적 공개 기록 없음</span></div>
          <div class="table-stage">
            <div class="seat-grid">
              <LoveLetterPlayerSeat
                v-for="player in opponents"
                :key="player.sessionId"
                :player="player"
                :current="player.sessionId === state?.currentTurnId"
                :favor-target="state?.favorTarget || 0"
                :turn-action="state?.actionPhase || ''"
              />
            </div>

            <div class="table-center">
              <div class="deck-area" :class="{ 'draw-ready': canDrawCard }">
                <LoveLetterCard
                  :card="null"
                  :interactive="canDrawCard"
                  :disabled="actionPending"
                  label="덱에서 카드 한 장 뽑기"
                  @select="drawCard"
                />
                <strong>{{ state?.deckCount || 0 }}</strong><span>{{ canDrawCard ? '클릭해서 뽑기' : '남은 편지' }}</span>
              </div>
              <div class="live-reveal" aria-live="polite">
                <template v-if="state?.lastPlayedCard?.id">
                  <LoveLetterCard :card="state.lastPlayedCard" compact />
                  <div>
                    <span>지금 공개된 행동</span>
                    <strong>{{ playerName(state.lastPlayedById) }} · {{ cardName(state.lastPlayedCard.character) }}</strong>
                    <small>{{ outcomeCopy }}</small>
                  </div>
                  <div v-if="state.lastDiscardedCard?.id" class="effect-discard">
                    <LoveLetterCard :card="state.lastDiscardedCard" compact />
                    <span>효과로 버림</span>
                  </div>
                </template>
                <template v-else>
                  <div class="reveal-placeholder">이번 라운드의 첫 행동을 기다리는 중</div>
                </template>
              </div>
            </div>

            <div v-if="state?.faceUpRemovedCards?.length" class="removed-cards">
              <span>2인전 공개 제외 카드</span>
              <div><LoveLetterCard v-for="card in state.faceUpRemovedCards" :key="card.id" :card="card" compact /></div>
            </div>

            <LoveLetterPlayerSeat v-if="myPlayer" :player="myPlayer" :current="isMyTurn" :favor-target="state?.favorTarget || 0" :turn-action="state?.actionPhase || ''" own />
          </div>
        </article>

        <aside class="side-stack">
          <section class="side-panel reference-panel" aria-labelledby="love-reference-title">
            <div class="panel-heading"><h2 id="love-reference-title">인물 안내</h2><span>카드 구성</span></div>
            <div class="role-reference">
              <div v-for="role in roles" :key="role.id"><b>{{ role.value }}</b><strong>{{ role.name }}</strong><span>×{{ role.count }}</span></div>
            </div>
            <p>사용된 카드 수를 따로 집계해 주지 않습니다. 테이블에서 본 정보를 직접 기억해 추리하세요.</p>
          </section>

          <section class="side-panel action-panel" aria-labelledby="love-action-title">
            <div class="panel-heading"><h2 id="love-action-title">이번 행동</h2><span>{{ actionStep }}</span></div>

            <div v-if="state?.gamePhase === 'round_result'" class="round-result">
              <p>ROUND {{ state.roundCount }}</p>
              <strong>{{ roundWinnerNames }} 라운드 승리</strong>
              <span>{{ roundRewardCopy }}</span>
              <button v-if="isHost" type="button" @click="nextRound">다음 라운드 시작</button>
              <small v-else>방장이 다음 라운드를 시작할 때까지 기다려주세요.</small>
            </div>

            <div v-else-if="state?.actionPhase === 'chancellor' && isMyTurn" class="chancellor-form">
              <strong>남길 카드 한 장을 고르세요.</strong>
              <span>나머지는 표시된 순서대로 덱 맨 아래에 놓입니다.</span>
              <div class="mini-choice">
                <button v-for="card in privateHand.cards" :key="card.id" type="button" :class="{ selected: chancellorKeepId === card.id }" @click="chancellorKeepId = card.id">
                  {{ card.value }} · {{ cardName(card.character) }}
                </button>
              </div>
              <ol v-if="chancellorReturns.length">
                <li v-for="card in chancellorReturns" :key="card.id">{{ cardName(card.character) }}</li>
              </ol>
              <button v-if="chancellorReturns.length > 1" type="button" class="secondary" @click="reverseReturns">아래에 놓을 순서 뒤집기</button>
              <button type="button" class="primary" :disabled="!chancellorKeepId || actionPending" @click="resolveChancellor">선택 확정</button>
            </div>

            <template v-else>
              <div class="phase-copy"><strong>{{ actionCopy.title }}</strong><span>{{ actionCopy.description }}</span></div>
              <div v-if="canChooseCard" class="selection-summary">
                <span>사용할 카드</span><strong>{{ selectedCard ? `${selectedCard.value} · ${cardName(selectedCard.character)}` : '손패에서 선택' }}</strong>
              </div>
              <div v-if="selectedCard && targetedCharacters.has(selectedCard.character) && validTargets.length" class="target-list">
                <span>대상 선택</span>
                <button v-for="player in validTargets" :key="player.sessionId" type="button" :class="{ selected: targetId === player.sessionId }" @click="targetId = player.sessionId">
                  {{ player.nickname }}<small v-if="player.sessionId === mySessionId">나</small>
                </button>
              </div>
              <label v-if="selectedCard?.character === 'guard' && validTargets.length" class="guess-field">
                추측할 인물
                <select v-model="guessedCharacter"><option value="">인물 선택</option><option v-for="role in guardGuessRoles" :key="role.id" :value="role.id">{{ role.value }} · {{ role.name }}</option></select>
              </label>
              <button v-if="canChooseCard" type="button" class="primary play-button" :disabled="!canSubmitPlay || actionPending" @click="playCard">이 카드 사용</button>
            </template>
          </section>
        </aside>
      </section>

      <section class="hand-panel" aria-labelledby="my-hand-title">
        <div class="panel-heading"><div><h2 id="my-hand-title">내 손패</h2><span>나에게만 보이는 카드</span></div><small v-if="countessRequired">왕·왕자와 함께 있어 백작부인을 반드시 사용해야 합니다.</small></div>
        <div class="hand-cards">
          <LoveLetterCard
            v-for="card in privateHand.cards"
            :key="card.id"
            :card="card"
            :interactive="canChooseCard"
            :selected="selectedCardId === card.id"
            :disabled="countessRequired && card.character !== 'countess'"
            @select="selectCard"
          />
          <p v-if="!privateHand.cards.length" class="empty-hand">{{ myPlayer?.eliminated ? '이번 라운드에서 탈락했습니다.' : '비공개 손패를 불러오는 중입니다.' }}</p>
        </div>
      </section>
    </template>

    <div v-if="privateReveal" class="reveal-backdrop" @click.self="privateReveal = null">
      <section class="private-reveal" role="dialog" aria-modal="true" aria-labelledby="private-reveal-title">
        <p>PRIVATE INFORMATION</p><h2 id="private-reveal-title">{{ playerName(privateReveal.targetSessionId) }}의 손패</h2>
        <LoveLetterCard :card="privateReveal.card" />
        <span>이 정보는 다른 플레이어에게 표시되지 않습니다. 닫으면 별도 기록에 남지 않습니다.</span>
        <button type="button" @click="privateReveal = null">확인</button>
      </section>
    </div>

    <LoveLetterResultModal v-if="state?.gamePhase === 'finished'" :players="rankingPlayers" :winner-ids="state.winnerSessionIds" @return="returnToTable" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { LOVE_LETTER_PROTOCOL } from '../../games/love-letter/protocol';
import { projectLoveLetterState } from '../../games/love-letter/state';
import LoveLetterCard from './love-letter/LoveLetterCard.vue';
import LoveLetterPlayerSeat from './love-letter/LoveLetterPlayerSeat.vue';
import LoveLetterResultModal from './love-letter/LoveLetterResultModal.vue';

const props = defineProps({ gameConnection: { type: Object, required: true } });
const emit = defineEmits(['move-to-game']);
const roles = [
  { id:'spy',name:'첩자',value:0,count:2 },{ id:'guard',name:'경비병',value:1,count:6 },{ id:'priest',name:'성직자',value:2,count:2 },
  { id:'baron',name:'남작',value:3,count:2 },{ id:'handmaid',name:'시녀',value:4,count:2 },{ id:'prince',name:'왕자',value:5,count:2 },
  { id:'chancellor',name:'재상',value:6,count:2 },{ id:'king',name:'왕',value:7,count:1 },{ id:'countess',name:'백작부인',value:8,count:1 },{ id:'princess',name:'공주',value:9,count:1 },
];
const targetedCharacters = new Set(['guard','priest','baron','prince','king']);
const room = computed(() => props.gameConnection ?? null);
const mySessionId = computed(() => props.gameConnection?.sessionId ?? '');
const state = ref(null);
const privateHand = ref({ revision:0, cards:[], chancellorPending:false });
const privateReveal = ref(null);
const selectedCardId = ref('');
const targetId = ref('');
const guessedCharacter = ref('');
const chancellorKeepId = ref('');
const chancellorReturnIds = ref([]);
const actionPending = ref(false);
const errorMessage = ref('');
let boundRoom = null;

watch(room, (nextRoom) => {
  if (!nextRoom || boundRoom === nextRoom) return;
  boundRoom = nextRoom;
  const applyState = (nextState) => { state.value = projectLoveLetterState(nextState); actionPending.value = false; };
  nextRoom.onStateChange(applyState);
  if (nextRoom.state) applyState(nextRoom.state);
  nextRoom.onMessage(LOVE_LETTER_PROTOCOL.messages.privateHand, (data) => {
    privateHand.value = { revision:Number.isInteger(data?.revision)?data.revision:0, cards:Array.isArray(data?.cards)?data.cards:[], chancellorPending:Boolean(data?.chancellorPending) };
    if (data?.chancellorPending && !chancellorKeepId.value) chancellorReturnIds.value = data.cards.map((card) => card.id);
    actionPending.value = false;
  });
  nextRoom.onMessage(LOVE_LETTER_PROTOCOL.messages.privateReveal, (data) => { if (data?.card) privateReveal.value = data; });
  nextRoom.onMessage('room_error', (data) => { errorMessage.value = data?.message || '요청을 처리하지 못했습니다.'; actionPending.value = false; });
  nextRoom.onMessage('move_room', (data) => emit('move-to-game', data));
  nextRoom.send(LOVE_LETTER_PROTOCOL.messages.requestPrivateState);
}, { immediate:true });

const players = computed(() => Object.values(state.value?.players || {}));
const connectedPlayerCount = computed(() => players.value.filter((player) => player.connected).length);
const myPlayer = computed(() => players.value.find((player) => player.sessionId === mySessionId.value));
const opponents = computed(() => players.value.filter((player) => player.sessionId !== mySessionId.value));
const isHost = computed(() => Boolean(myPlayer.value?.isHost));
const isMyTurn = computed(() => state.value?.gamePhase === 'playing' && state.value?.currentTurnId === mySessionId.value);
const canChooseCard = computed(() => isMyTurn.value && state.value?.actionPhase === 'choose' && !myPlayer.value?.eliminated);
const canDrawCard = computed(() => isMyTurn.value && state.value?.actionPhase === 'draw' && !myPlayer.value?.eliminated && (state.value?.deckCount || 0) > 0);
const selectedCard = computed(() => privateHand.value.cards.find((card) => card.id === selectedCardId.value));
const countessRequired = computed(() => privateHand.value.cards.some((card) => card.character === 'countess') && privateHand.value.cards.some((card) => ['king','prince'].includes(card.character)));
const validTargets = computed(() => {
  if (!selectedCard.value || !targetedCharacters.has(selectedCard.value.character)) return [];
  return players.value.filter((player) => player.connected && !player.eliminated && (
    selectedCard.value.character === 'prince' && player.sessionId === mySessionId.value ||
    player.sessionId !== mySessionId.value && !player.protected
  ));
});
const guardGuessRoles = computed(() => roles.filter((role) => role.id !== 'guard'));
const canSubmitPlay = computed(() => {
  if (!canChooseCard.value || !selectedCard.value) return false;
  if (countessRequired.value && selectedCard.value.character !== 'countess') return false;
  if (targetedCharacters.has(selectedCard.value.character) && validTargets.value.length && !targetId.value) return false;
  if (selectedCard.value.character === 'guard' && validTargets.value.length && !guessedCharacter.value) return false;
  return true;
});
const chancellorReturns = computed(() => chancellorReturnIds.value.map((id) => privateHand.value.cards.find((card) => card.id === id)).filter((card) => card && card.id !== chancellorKeepId.value));
const roundWinnerNames = computed(() => (state.value?.roundWinnerIds || []).map(playerName).join(', '));
const roundRewardCopy = computed(() => {
  const winnerCount = state.value?.roundWinnerIds?.length || 0;
  return winnerCount > 1
    ? `${roundWinnerNames.value}님이 라운드 승리 보상으로 호감 토큰을 각각 1개씩 얻었습니다.`
    : `${roundWinnerNames.value}님이 라운드 승리 보상으로 호감 토큰 1개를 얻었습니다.`;
});
const rankingPlayers = computed(() => (state.value?.rankings || []).map((id,index) => ({ ...(players.value.find((player) => player.sessionId === id)||{}),sessionId:id,nickname:playerName(id),rank:index+1 })));
const turnStatus = computed(() => {
  if (state.value?.gamePhase === 'waiting') return { label:'게임 준비',value:`${connectedPlayerCount.value}명 참가` };
  if (state.value?.gamePhase === 'round_result') return { label:'라운드 종료',value:roundWinnerNames.value };
  if (state.value?.gamePhase === 'finished') return { label:'게임 종료',value:'편지 전달 완료' };
  const phaseLabel = state.value?.actionPhase === 'draw' ? '카드 뽑기' : state.value?.actionPhase === 'chancellor' ? '재상 선택' : '카드 사용';
  return { label:isMyTurn.value?'내 차례':'현재 차례',value:`${playerName(state.value?.currentTurnId)} · ${phaseLabel}` };
});
const actionStep = computed(() => state.value?.gamePhase === 'round_result'?'라운드 결과':isMyTurn.value && state.value?.actionPhase === 'draw'?'카드 뽑기':isMyTurn.value?'내 차례':'상대 차례');
const actionCopy = computed(() => {
  if (myPlayer.value?.eliminated) return { title:'이번 라운드에서 탈락했습니다.',description:'다음 라운드까지 남은 플레이를 지켜보세요.' };
  if (isMyTurn.value && state.value?.actionPhase === 'draw') return { title:'덱을 클릭해 카드 한 장을 뽑으세요.',description:'카드를 뽑으면 두 장의 손패 중 사용할 카드 한 장을 선택할 수 있습니다.' };
  if (!isMyTurn.value && state.value?.actionPhase === 'draw') return { title:`${playerName(state.value?.currentTurnId)}님이 카드를 뽑기를 기다리는 중`,description:'카드를 뽑은 뒤 공개되는 행동을 잘 보고 기억하세요.' };
  if (!isMyTurn.value) return { title:`${playerName(state.value?.currentTurnId)}의 선택을 기다리는 중`,description:'공개되는 한 번의 행동을 잘 보고 기억하세요.' };
  return { title:'손패에서 사용할 카드 한 장을 고르세요.',description:'효과가 있는 카드라면 대상과 필요한 추측을 이어서 선택합니다.' };
});
const outcomeCopy = computed(() => ({guard_hit:'추측 적중 · 대상 탈락',guard_miss:'추측 실패',baron_tie:'비교 결과 동점',protected:'다음 차례까지 보호',no_target:'보호로 인해 효과 없음',princess_discarded:'공주를 버려 탈락',prince_replaced:'손패 교체',chancellor_choice:'재상이 카드를 확인 중',chancellor_resolved:'재상 선택 완료',hands_swapped:'손패 교환',princess_played:'공주를 사용해 탈락',eliminated:'플레이어 탈락'}[state.value?.lastOutcome] || '효과 처리 완료'));

watch(() => state.value?.turnRevision, () => { selectedCardId.value='';targetId.value='';guessedCharacter.value='';chancellorKeepId.value='';chancellorReturnIds.value=privateHand.value.cards.map((card)=>card.id);errorMessage.value=''; });

function cardName(character) { return roles.find((role) => role.id === character)?.name || '카드'; }
function playerName(id) { return players.value.find((player) => player.sessionId === id)?.nickname || '플레이어'; }
function selectCard(card) { selectedCardId.value=card.id;targetId.value='';guessedCharacter.value=''; }
function startGame() { room.value?.send(LOVE_LETTER_PROTOCOL.messages.startGame); }
function drawCard() { if (!canDrawCard.value || actionPending.value) return;actionPending.value=true;room.value?.send(LOVE_LETTER_PROTOCOL.messages.drawCard,{turnRevision:state.value.turnRevision}); }
function playCard() { if (!canSubmitPlay.value) return;actionPending.value=true;room.value?.send(LOVE_LETTER_PROTOCOL.messages.playCard,{cardId:selectedCard.value.id,targetSessionId:targetId.value,guessedCharacter:guessedCharacter.value,turnRevision:state.value.turnRevision}); }
function reverseReturns() { chancellorReturnIds.value=[...chancellorReturnIds.value].reverse(); }
function resolveChancellor() { if (!chancellorKeepId.value) return;actionPending.value=true;room.value?.send(LOVE_LETTER_PROTOCOL.messages.resolveChancellor,{keepCardId:chancellorKeepId.value,returnCardIds:chancellorReturns.value.map((card)=>card.id),turnRevision:state.value.turnRevision}); }
function nextRound() { room.value?.send(LOVE_LETTER_PROTOCOL.messages.nextRound); }
function returnToTable() { room.value?.send(LOVE_LETTER_PROTOCOL.messages.returnToTable); }
</script>

<style scoped>
.love-game{display:grid;gap:16px;color:#292725}.game-topbar{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.eyebrow{margin:0 0 5px;color:#8c8580;font-size:9px;font-weight:800;letter-spacing:.14em}.game-topbar h1{margin:0;font-size:32px;letter-spacing:-.04em}.game-topbar>div>p:last-child{margin:5px 0 0;color:#77716c;font-size:12px}.turn-chip{min-width:220px;padding:11px 14px;border:1px solid #dedbd7;border-radius:7px;background:#fff}.turn-chip span,.turn-chip strong{display:block}.turn-chip span{color:#88817b;font-size:9px}.turn-chip strong{margin-top:3px;font-size:12px}.turn-chip.mine{border-color:#3568b8;background:#f3f7fd}.status-strip{display:grid;grid-template-columns:repeat(var(--player-count),minmax(0,1fr));gap:1px;overflow:hidden;border:1px solid #dfdcd8;border-radius:8px;background:#e9e6e2}.status-strip>div{min-width:0;padding:11px 14px;background:#fff}.status-strip>div.mine{background:#f3f7fd}.status-strip span{display:block;overflow:hidden;color:#8a847f;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.favor-hearts{display:flex;align-items:center;gap:3px;min-height:17px;margin-top:3px}.favor-hearts i{color:#aaa39e;font:normal 16px/1 Georgia,serif}.favor-hearts i.filled{color:#b44367}.error-banner{margin:0;padding:10px 12px;border:1px solid #ecc8c8;border-radius:6px;background:#fff5f5;color:#a52d2d;font-size:11px}.waiting-panel{display:flex;align-items:center;justify-content:space-between;padding:24px;border:1px solid #dedbd7;border-radius:10px;background:white}.waiting-panel strong,.waiting-panel span{display:block}.waiting-panel span{margin-top:5px;color:#817b75;font-size:11px}.waiting-panel button,.primary,.round-result button{min-height:42px;padding:0 17px;border:0;border-radius:6px;background:#3568b8;color:white;font-weight:800;cursor:pointer}.play-grid{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:16px}.table-panel,.side-panel,.hand-panel{border:1px solid #dedbd7;border-radius:10px;background:#fff}.table-panel,.side-panel{padding:14px}.panel-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.panel-heading h2{margin:0;font-size:13px}.panel-heading span,.panel-heading small{color:#89827c;font-size:9px}.table-stage{min-height:540px;position:relative;display:grid;grid-template-rows:auto 1fr auto;gap:18px;padding:18px;margin-top:12px;border:1px solid #e6e2de;border-radius:8px;background:radial-gradient(circle at center,#faf9f7 0,#f4f1ed 72%)}.seat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}.table-center{display:flex;align-items:center;justify-content:center;gap:24px}.deck-area{position:relative;text-align:center}.deck-area.draw-ready :deep(.role-card){border-color:#3568b8;box-shadow:0 0 0 3px rgba(53,104,184,.18),0 8px 22px rgba(53,104,184,.22)}.deck-area.draw-ready>span{color:#3568b8;font-weight:800}.deck-area>strong{position:absolute;z-index:2;right:-9px;top:-9px;width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:#3568b8;color:white;font-size:11px}.deck-area>span{display:block;margin-top:5px;color:#85807a;font-size:9px}.live-reveal{min-width:300px;display:flex;align-items:center;justify-content:center;gap:13px}.live-reveal>div>span,.live-reveal>div>strong,.live-reveal>div>small{display:block}.live-reveal>div>span{color:#8a847e;font-size:8px;text-transform:uppercase;letter-spacing:.08em}.live-reveal>div>strong{margin-top:4px;font-size:12px}.live-reveal>div>small{margin-top:4px;color:#6f6964;font-size:9px}.effect-discard{display:grid;gap:4px;padding-left:12px;border-left:1px solid #dcd8d3}.reveal-placeholder{padding:28px;border:1px dashed #cfcac5;border-radius:8px;color:#8a847e;font-size:10px}.removed-cards{position:absolute;right:12px;bottom:12px}.removed-cards>span{display:block;margin-bottom:5px;color:#8a847e;font-size:8px;text-align:right}.removed-cards>div{display:flex}.removed-cards .role-card+ .role-card{margin-left:-60px}.side-stack{display:grid;align-content:start;gap:12px}.phase-copy,.selection-summary{margin-top:12px;padding:12px;border-radius:6px;background:#f5f3f1}.phase-copy strong,.phase-copy span,.selection-summary span,.selection-summary strong{display:block}.phase-copy strong{font-size:12px}.phase-copy span,.selection-summary span{margin-top:4px;color:#7e7872;font-size:10px}.selection-summary strong{margin-top:4px;font-size:12px}.target-list{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px}.target-list>span{grid-column:1/-1;color:#817b75;font-size:9px}.target-list button,.mini-choice button{min-height:36px;border:1px solid #dcd8d4;border-radius:5px;background:white;font-size:10px;cursor:pointer}.target-list button.selected,.mini-choice button.selected{border-color:#3568b8;background:#f0f5fc;color:#28558f}.target-list small{margin-left:4px;color:#3568b8}.guess-field{display:grid;gap:5px;margin-top:12px;color:#817b75;font-size:9px}.guess-field select{min-height:40px;padding:0 9px;border:1px solid #d8d4d0;border-radius:5px;background:white}.play-button{width:100%;margin-top:12px}.primary:disabled,.waiting-panel button:disabled{opacity:.45;cursor:not-allowed}.round-result{display:grid;gap:7px;padding:16px;margin-top:12px;border-radius:7px;background:#f7f2f4}.round-result p{margin:0;color:#9b516d;font-size:9px;font-weight:800;letter-spacing:.1em}.round-result strong{font-size:15px}.round-result span,.round-result small{color:#79736d;font-size:10px}.round-result button{margin-top:8px}.chancellor-form{display:grid;gap:8px;margin-top:12px}.chancellor-form>strong{font-size:12px}.chancellor-form>span{color:#79736d;font-size:9px}.mini-choice{display:grid;gap:5px}.chancellor-form ol{margin:0;padding:9px 9px 9px 28px;background:#f5f3f1;color:#69635d;font-size:10px}.secondary{min-height:36px;border:1px solid #d9d5d1;border-radius:5px;background:white;color:#5d5853;font-weight:700;cursor:pointer}.role-reference{display:grid;margin-top:10px}.role-reference>div{display:grid;grid-template-columns:24px 1fr auto;align-items:center;min-height:29px;border-bottom:1px solid #eeeae6;font-size:10px}.role-reference b{color:#9b516d;font:800 11px/1 ui-monospace,monospace}.role-reference span{color:#8c8580}.reference-panel>p{margin:12px 0 0;color:#766f69;font-size:9px;line-height:1.55}.hand-panel{padding:14px}.hand-panel>.panel-heading>div span{display:block;margin-top:3px}.hand-panel>.panel-heading>small{max-width:360px;color:#a3475f;text-align:right}.hand-cards{min-height:238px;display:flex;align-items:flex-end;justify-content:center;gap:13px;padding:12px 0 0}.empty-hand{color:#817b75;font-size:11px}.reveal-backdrop{position:fixed;z-index:70;inset:0;display:grid;place-items:center;padding:20px;background:rgba(32,27,22,.48)}.private-reveal{width:min(390px,100%);display:grid;justify-items:center;gap:12px;padding:25px;border-radius:11px;background:white}.private-reveal>p{justify-self:start;margin:0;color:#8b8580;font-size:9px;font-weight:800;letter-spacing:.12em}.private-reveal h2{justify-self:start;margin:-7px 0 3px;font-size:20px}.private-reveal>span{color:#77716b;font-size:10px;text-align:center}.private-reveal>button{width:100%;min-height:42px;border:0;border-radius:6px;background:#3568b8;color:white;font-weight:800;cursor:pointer}
@media(max-width:1080px){.play-grid{grid-template-columns:1fr}.side-stack{grid-template-columns:1fr 1fr}.table-stage{min-height:500px}}@media(max-width:720px){.game-topbar{align-items:flex-start;flex-direction:column}.turn-chip{width:100%}.status-strip{grid-template-columns:1fr 1fr}.play-grid{display:block}.side-stack{grid-template-columns:1fr;margin-top:12px}.table-center{flex-direction:column}.live-reveal{min-width:0;flex-wrap:wrap}.removed-cards{position:static}.table-stage{min-height:650px}.hand-cards{overflow-x:auto;justify-content:flex-start}.waiting-panel{align-items:flex-start;flex-direction:column;gap:15px}.waiting-panel button{width:100%}}@media(max-width:480px){.seat-grid{grid-template-columns:1fr}.status-strip>div{padding:9px}.table-panel,.side-panel,.hand-panel{padding:11px}.live-reveal{gap:8px}}
</style>
