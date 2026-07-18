<template>
  <div class="splendor-game">
    <header class="topbar">
      <div><p class="eyebrow">RENAISSANCE GEM TRADE</p><h1>스플렌더</h1></div>
      <div class="turn-status" :class="{mine:isMyTurn}" role="status"><span>{{ turnStatus.label }}</span><strong>{{ turnStatus.value }}</strong></div>
    </header>

    <section class="status-strip" aria-label="스플렌더 게임 상태">
      <div><span>내 명성</span><strong>{{ myPlayer?.prestige || 0 }}점</strong><small>15점부터 마지막 라운드</small></div>
      <div><span>보유 토큰</span><strong>{{ myTokenTotal }} / 10</strong><small>턴 종료 시 최대 10개</small></div>
      <div><span>예약 카드</span><strong>{{ myPlayer?.reservedCount || 0 }} / 3</strong><small>예약하면 가능한 경우 황금 1개</small></div>
      <div><span>시장 상태</span><strong>{{ marketCardCount }}장</strong><small>구매·예약 뒤 즉시 보충</small></div>
    </section>

    <p v-if="errorMessage" class="error-banner" role="alert">{{ errorMessage }}</p>

    <section v-if="state?.gamePhase === 'waiting'" class="waiting-panel">
      <div><strong>{{ isHost?'르네상스 상단을 열 준비가 됐나요?':'방장이 게임을 시작할 때까지 기다려주세요.' }}</strong><span>현재 {{ connectedPlayerCount }}명 · 2~4명 플레이</span></div>
      <button v-if="isHost" type="button" :disabled="connectedPlayerCount<2" @click="startGame">게임 시작</button>
    </section>

    <template v-else>
      <div class="play-grid">
        <article class="market-panel">
          <div class="panel-heading"><h2>개발 카드 시장</h2><span>카드를 선택해 비용을 확인하세요</span></div>
          <section class="opponents" aria-label="플레이어 현황">
            <SplendorPlayerPanel v-for="player in players" :key="player.sessionId" :player="player" :current="player.sessionId===state?.currentTurnId" :own="player.sessionId===mySessionId" />
          </section>
          <section class="nobles" aria-label="귀족 타일">
            <SplendorNoble v-for="noble in state?.nobles || []" :key="noble.id" :noble="noble" :selectable="canChooseNoble&&state.eligibleNobleIds.includes(noble.id)" :selected="selectedNobleId===noble.id" @select="selectedNobleId=$event.id" />
          </section>
          <section class="market" aria-label="개발 카드 시장">
            <div v-for="tier in [3,2,1]" :key="tier" class="tier-row">
              <button type="button" class="tier-deck" :class="{selected:selectedCard?.source==='deck'&&selectedCard?.tier===tier}" :disabled="!canSelectCards||!state.deckCounts[tier]" @click="selectDeck(tier)">
                <strong>{{ tier }}</strong><span>단계</span><small>{{ state.deckCounts[tier] }}장</small>
              </button>
              <div class="card-row">
                <SplendorCard v-for="card in state.markets[tier]" :key="card.id" :card="card" interactive :selected="selectedCard?.card?.id===card.id" :affordable="canAfford(card)" @select="selectMarketCard" />
              </div>
            </div>
          </section>
        </article>

        <aside class="side-stack">
          <section class="side-panel action-panel" aria-labelledby="splendor-action-title">
            <div class="panel-heading"><h2 id="splendor-action-title">이번 행동</h2><span>한 턴에 하나</span></div>

            <template v-if="canReturnTokens">
              <div class="action-copy"><strong>초과 토큰을 반환하세요.</strong><span>현재 {{ myTokenTotal }}개 · 정확히 {{ returnRequired }}개를 은행에 돌려놓습니다.</span></div>
              <div class="return-grid">
                <button v-for="color in tokenColors" :key="color" type="button" :disabled="(myPlayer?.tokens[color]||0)<=0" @click="toggleReturn(color)"><SplendorGem :color="color" /><span>{{ colorName(color) }}<b>{{ returnSelection[color]||0 }} / {{ myPlayer?.tokens[color]||0 }}</b></span></button>
              </div>
              <button class="btn primary wide" type="button" :disabled="returnSelectedTotal!==returnRequired||actionPending" @click="returnTokens">선택한 토큰 반환</button>
            </template>

            <template v-else-if="canChooseNoble">
              <div class="action-copy"><strong>방문받을 귀족을 고르세요.</strong><span>조건을 동시에 만족한 귀족 중 한 명만 선택할 수 있습니다.</span></div>
              <p class="selection-summary">{{ selectedNobleId?'귀족 선택 완료':'시장 위 귀족 타일을 선택하세요.' }}</p>
              <button class="btn primary wide" type="button" :disabled="!selectedNobleId||actionPending" @click="chooseNoble">이 귀족 방문받기</button>
            </template>

            <template v-else>
              <div class="mode-switch" role="group" aria-label="행동 종류"><button type="button" :aria-pressed="actionMode==='gems'" @click="setMode('gems')">보석 가져오기</button><button type="button" :aria-pressed="actionMode==='cards'" @click="setMode('cards')">카드 행동</button></div>
              <div class="action-copy"><strong>{{ actionCopy.title }}</strong><span>{{ actionCopy.description }}</span></div>
              <div class="selection-summary" aria-live="polite">
                <template v-if="actionMode==='gems'&&selectedGemEntries.length"><span v-for="entry in selectedGemEntries" :key="entry.color"><SplendorGem :color="entry.color" />{{ colorName(entry.color) }} {{ entry.count }}개</span></template>
                <template v-else-if="actionMode==='cards'&&selectedCard"><span>{{ selectedCardLabel }}</span></template>
                <template v-else>아직 선택한 항목이 없습니다.</template>
              </div>
              <div v-if="actionMode==='gems'" class="action-buttons"><button class="btn primary" type="button" :disabled="!gemSelectionValid||!canMainAction||actionPending" @click="takeGems">보석 가져오기</button><button class="btn" type="button" @click="selectedGems={}">선택 초기화</button></div>
              <div v-else class="action-buttons"><button class="btn primary" type="button" :disabled="!selectedCard?.card||!canAfford(selectedCard.card)||!canMainAction||actionPending" @click="purchaseCard">카드 구매</button><button class="btn" type="button" :disabled="!canReserveSelected||!canMainAction||actionPending" @click="reserveCard">카드 예약</button></div>
            </template>
          </section>

          <section class="side-panel bank-panel" aria-labelledby="splendor-bank-title">
            <div class="panel-heading"><h2 id="splendor-bank-title">보석 은행</h2><span>남은 토큰</span></div>
            <div class="gem-bank">
              <button v-for="color in tokenColors" :key="color" type="button" :disabled="color==='gold'||actionMode!=='gems'||!canMainAction||!state.bank[color]" :aria-pressed="Boolean(selectedGems[color])" @click="selectGem(color)"><SplendorGem :color="color" /><span><strong>{{ state.bank[color] }}</strong><small>{{ colorName(color) }}<template v-if="selectedGems[color]"> · 선택 {{ selectedGems[color] }}</template></small></span></button>
            </div>
          </section>

          <GameActivityPanel :messages="messages" title="공개 활동" title-id="splendor-activity-title" />
        </aside>
      </div>

      <section class="engine-panel">
        <div class="panel-heading"><h2>내 상단 · 영구 할인 엔진</h2><span>구매한 카드의 보석은 계속 적용됩니다</span></div>
        <div class="engine-grid">
          <div class="engine-section"><h3>할인과 보유 토큰</h3><p>숫자 왼쪽은 영구 할인, 오른쪽은 현재 토큰입니다.</p><div class="resource-row"><div v-for="color in tokenColors" :key="color" class="resource-stat"><SplendorGem :color="color" /><span><strong>{{ color==='gold'?'—':myPlayer?.bonuses[color]||0 }}</strong> / {{ myPlayer?.tokens[color]||0 }}</span></div></div></div>
          <div class="engine-section"><h3>예약 카드</h3><p>예약 카드의 정체는 나에게만 보이며 최대 3장입니다.</p><div class="reserved-row"><SplendorCard v-for="card in privateReservations.cards" :key="card.id" :card="card" interactive :selected="selectedCard?.source==='reserved'&&selectedCard?.card?.id===card.id" :affordable="canAfford(card)" @select="selectReservedCard" /><span v-if="!privateReservations.cards.length" class="empty">예약한 카드가 없습니다.</span></div></div>
        </div>
      </section>
    </template>

    <SplendorResultModal v-if="state?.gamePhase==='finished'" :players="rankingPlayers" :winner-ids="state.winnerSessionIds" @return="returnToTable" />
  </div>
</template>

<script setup>
import {computed,ref,watch} from 'vue';
import {SPLENDOR_PROTOCOL} from '../../games/splendor/protocol';
import {projectSplendorState} from '../../games/splendor/state';
import GameActivityPanel from './shared/GameActivityPanel.vue';
import SplendorCard from './splendor/SplendorCard.vue';
import SplendorGem from './splendor/SplendorGem.vue';
import SplendorNoble from './splendor/SplendorNoble.vue';
import SplendorPlayerPanel from './splendor/SplendorPlayerPanel.vue';
import SplendorResultModal from './splendor/SplendorResultModal.vue';

const props=defineProps({gameConnection:{type:Object,required:true}});const emit=defineEmits(['move-to-game']);
const colors=['white','blue','green','red','black'];const tokenColors=[...colors,'gold'];
const names={white:'다이아몬드',blue:'사파이어',green:'에메랄드',red:'루비',black:'오닉스',gold:'황금'};
const room=computed(()=>props.gameConnection??null);const mySessionId=computed(()=>props.gameConnection?.sessionId||'');
const state=ref(null);const privateReservations=ref({revision:0,cards:[]});const messages=ref([]);const errorMessage=ref('');const actionPending=ref(false);
const actionMode=ref('gems');const selectedGems=ref({});const selectedCard=ref(null);const selectedNobleId=ref('');const returnSelection=ref({});let boundRoom=null;

watch(room,nextRoom=>{if(!nextRoom||boundRoom===nextRoom)return;boundRoom=nextRoom;const apply=s=>{state.value=projectSplendorState(s);actionPending.value=false};nextRoom.onStateChange(apply);if(nextRoom.state)apply(nextRoom.state);nextRoom.onMessage('chat',data=>messages.value.push(data));nextRoom.onMessage(SPLENDOR_PROTOCOL.messages.privateReservations,data=>{privateReservations.value={revision:Number.isInteger(data?.revision)?data.revision:0,cards:Array.isArray(data?.cards)?data.cards:[]};actionPending.value=false});nextRoom.onMessage('room_error',data=>{errorMessage.value=data?.message||'요청을 처리하지 못했습니다.';actionPending.value=false});nextRoom.onMessage('move_room',data=>emit('move-to-game',data));nextRoom.send(SPLENDOR_PROTOCOL.messages.requestPrivateState)}, {immediate:true});

const players=computed(()=>Object.values(state.value?.players||{}));const connectedPlayerCount=computed(()=>players.value.filter(p=>p.connected).length);const myPlayer=computed(()=>players.value.find(p=>p.sessionId===mySessionId.value));const isHost=computed(()=>Boolean(myPlayer.value?.isHost));const isMyTurn=computed(()=>state.value?.gamePhase==='playing'&&state.value?.currentTurnId===mySessionId.value);const canMainAction=computed(()=>isMyTurn.value&&state.value?.actionPhase==='main');const canReturnTokens=computed(()=>isMyTurn.value&&state.value?.actionPhase==='return_tokens');const canChooseNoble=computed(()=>isMyTurn.value&&state.value?.actionPhase==='choose_noble');const canSelectCards=computed(()=>canMainAction.value&&actionMode.value==='cards');
const myTokenTotal=computed(()=>Object.values(myPlayer.value?.tokens||{}).reduce((sum,n)=>sum+n,0));const marketCardCount=computed(()=>state.value?Object.values(state.value.markets).reduce((sum,cards)=>sum+cards.length,0):0);const returnRequired=computed(()=>Math.max(0,myTokenTotal.value-10));const returnSelectedTotal=computed(()=>Object.values(returnSelection.value).reduce((sum,n)=>sum+n,0));
const selectedGemEntries=computed(()=>colors.filter(color=>selectedGems.value[color]).map(color=>({color,count:selectedGems.value[color]})));const gemSelectionValid=computed(()=>{const entries=selectedGemEntries.value;const total=entries.reduce((s,e)=>s+e.count,0);return entries.length===3&&total===3&&entries.every(e=>e.count===1&&state.value.bank[e.color]>=1)||entries.length===1&&total===2&&state.value.bank[entries[0].color]>=4});
const canReserveSelected=computed(()=>selectedCard.value&&selectedCard.value.source!=='reserved'&&(myPlayer.value?.reservedCount||0)<3);const selectedCardLabel=computed(()=>selectedCard.value?.source==='deck'?`${selectedCard.value.tier}단계 덱 맨 위 비공개 카드`:selectedCard.value?.card?`${selectedCard.value.card.tier}단계 · ${names[selectedCard.value.card.bonus]} 개발`:'');
const currentPlayer=computed(()=>players.value.find(p=>p.sessionId===state.value?.currentTurnId));const turnStatus=computed(()=>{if(state.value?.gamePhase==='waiting')return{label:'게임 준비',value:`${connectedPlayerCount.value}명 참가`};if(state.value?.gamePhase==='finished')return{label:'게임 종료',value:state.value.lastAction};if(state.value?.finalRoundTriggered)return{label:'마지막 라운드',value:`${currentPlayer.value?.nickname||'-'} · ${phaseLabel.value}`};return{label:isMyTurn.value?'내 차례':'현재 차례',value:`${currentPlayer.value?.nickname||'-'} · ${phaseLabel.value}`}});const phaseLabel=computed(()=>state.value?.actionPhase==='return_tokens'?'초과 토큰 반환':state.value?.actionPhase==='choose_noble'?'귀족 선택':'행동 1개 선택');
const actionCopy=computed(()=>{if(!canMainAction.value)return{title:'상대의 행동을 기다리는 중입니다.',description:'시장과 보석 은행의 변화를 확인하세요.'};if(actionMode.value==='gems')return{title:'보석을 선택하세요.',description:'서로 다른 색 3개 또는 재고가 4개 이상인 같은 색 2개를 가져옵니다.'};return{title:selectedCard.value?selectedCardLabel.value:'개발 카드를 선택하세요.',description:selectedCard.value?.card?(canAfford(selectedCard.value.card)?'현재 자원으로 구매할 수 있습니다.':'구매 자원이 부족하지만 공개 카드는 예약할 수 있습니다.'):'시장·예약 카드 또는 단계 덱을 선택하세요.'}});
const rankingPlayers=computed(()=>(state.value?.rankings||[]).map((id,index)=>{const player=players.value.find(p=>p.sessionId===id);return{...player,sessionId:id,nickname:player?.nickname||id,rank:player?.rank||index+1}}));

watch(()=>state.value?.turnRevision,()=>{selectedGems.value={};selectedCard.value=null;selectedNobleId.value='';returnSelection.value={};errorMessage.value='';actionPending.value=false});
function colorName(color){return names[color]||color}function setMode(mode){actionMode.value=mode;selectedGems.value={};selectedCard.value=null}
function selectGem(color){const current=selectedGems.value[color]||0;const entries=selectedGemEntries.value;if(current){if(current===1&&entries.length===1&&state.value.bank[color]>=4)selectedGems.value={ [color]:2 };else{const next={...selectedGems.value};delete next[color];selectedGems.value=next}}else if(entries.reduce((s,e)=>s+e.count,0)<3)selectedGems.value={...selectedGems.value,[color]:1}}
function canAfford(card){if(!card||!myPlayer.value)return false;let gold=myPlayer.value.tokens.gold;for(const color of colors){let need=Math.max(0,(card.cost[color]||0)-(myPlayer.value.bonuses[color]||0));need-=Math.min(myPlayer.value.tokens[color]||0,need);const use=Math.min(gold,need);gold-=use;need-=use;if(need>0)return false}return true}
function selectMarketCard(card){if(!canSelectCards.value)return;selectedCard.value={source:'market',card,tier:card.tier}}function selectReservedCard(card){if(!canSelectCards.value)return;selectedCard.value={source:'reserved',card,tier:card.tier}}function selectDeck(tier){if(!canSelectCards.value)return;selectedCard.value={source:'deck',card:null,tier}}
function startGame(){room.value?.send(SPLENDOR_PROTOCOL.messages.startGame)}function takeGems(){if(!gemSelectionValid.value)return;actionPending.value=true;room.value?.send(SPLENDOR_PROTOCOL.messages.takeGems,{selection:selectedGems.value,turnRevision:state.value.turnRevision})}
function reserveCard(){if(!canReserveSelected.value)return;actionPending.value=true;room.value?.send(SPLENDOR_PROTOCOL.messages.reserveCard,{source:selectedCard.value.source==='deck'?'deck':'market',cardId:selectedCard.value.card?.id||'',tier:selectedCard.value.tier,turnRevision:state.value.turnRevision})}
function purchaseCard(){if(!selectedCard.value?.card)return;actionPending.value=true;room.value?.send(SPLENDOR_PROTOCOL.messages.purchaseCard,{source:selectedCard.value.source,cardId:selectedCard.value.card.id,turnRevision:state.value.turnRevision})}
function toggleReturn(color){const current=returnSelection.value[color]||0;if(current>=(myPlayer.value?.tokens[color]||0)){const next={...returnSelection.value};delete next[color];returnSelection.value=next;return}if(returnSelectedTotal.value<returnRequired.value)returnSelection.value={...returnSelection.value,[color]:current+1}}
function returnTokens(){actionPending.value=true;room.value?.send(SPLENDOR_PROTOCOL.messages.returnTokens,{returned:returnSelection.value,turnRevision:state.value.turnRevision})}function chooseNoble(){actionPending.value=true;room.value?.send(SPLENDOR_PROTOCOL.messages.chooseNoble,{nobleId:selectedNobleId.value,turnRevision:state.value.turnRevision})}function returnToTable(){room.value?.send(SPLENDOR_PROTOCOL.messages.returnToTable)}
</script>

<style scoped>
.splendor-game{display:grid;gap:16px;color:#282624}.topbar{display:flex;align-items:flex-end;justify-content:space-between;gap:24px}.eyebrow{margin:0;color:#6e6964;font-size:9px;font-weight:800;letter-spacing:.12em}.topbar h1{margin:6px 0 0;font-size:38px;line-height:1;letter-spacing:-.04em}.turn-status{min-width:236px;padding:11px 14px;border:1px solid rgba(0,0,0,.1);border-radius:8px;background:#f6f5f4}.turn-status span,.turn-status strong{display:block}.turn-status span{color:#77716b;font-size:9px}.turn-status strong{margin-top:3px;font-size:12px}.turn-status.mine{border-color:#0075de;background:#f2f8fd}.status-strip{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid rgba(0,0,0,.1);border-radius:10px;background:#f6f5f4;overflow:hidden}.status-strip>div{padding:13px 15px;border-right:1px solid rgba(0,0,0,.06)}.status-strip>div:last-child{border:0}.status-strip span,.status-strip strong,.status-strip small{display:block}.status-strip span{color:#6f6963;font-size:9px}.status-strip strong{margin-top:3px;font:800 17px/1 ui-monospace,monospace}.status-strip small{margin-top:4px;color:#9a948e;font-size:8px}.error-banner{margin:0;padding:10px 12px;border:1px solid #efcaca;border-radius:6px;background:#fff5f5;color:#a82d2d;font-size:11px}.waiting-panel{display:flex;align-items:center;justify-content:space-between;padding:24px;border:1px solid rgba(0,0,0,.1);border-radius:10px;background:#fff}.waiting-panel strong,.waiting-panel span{display:block}.waiting-panel span{margin-top:5px;color:#77716b;font-size:10px}.waiting-panel button{min-height:44px;padding:0 18px;border:0;border-radius:5px;background:#0075de;color:#fff;font-weight:800}.play-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(300px,.68fr);gap:16px;align-items:start}.market-panel,.side-panel,.engine-panel{border:1px solid rgba(0,0,0,.1);border-radius:10px;background:#fff;box-shadow:0 4px 18px rgba(0,0,0,.04)}.market-panel{overflow:hidden}.panel-heading{min-height:56px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 15px;border-bottom:1px solid rgba(0,0,0,.06)}.panel-heading h2{margin:0;font-size:13px}.panel-heading span{color:#77716b;font-size:9px}.opponents{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:8px;padding:14px;border-bottom:1px solid rgba(0,0,0,.06);background:#f6f5f4}.nobles{display:flex;gap:10px;overflow-x:auto;padding:14px;border-bottom:1px solid rgba(0,0,0,.06)}.market{display:grid;gap:11px;padding:14px}.tier-row{min-width:0;display:grid;grid-template-columns:62px minmax(0,1fr);gap:10px}.tier-deck{min-height:136px;display:grid;place-content:center;border:1px solid #31302e;border-radius:8px;background:#31302e;color:#fff;text-align:center;cursor:pointer}.tier-deck strong{font:800 21px/1 ui-monospace,monospace}.tier-deck span,.tier-deck small{display:block;margin-top:4px;font-size:8px}.tier-deck.selected{box-shadow:0 0 0 3px rgba(0,117,222,.35)}.tier-deck:disabled{opacity:.42}.card-row{min-width:0;display:grid;grid-template-columns:repeat(4,minmax(124px,1fr));gap:7px}.side-stack{display:grid;gap:14px}.side-panel{overflow:hidden}.action-panel,.bank-panel{padding-bottom:14px}.mode-switch{display:grid;grid-template-columns:1fr 1fr;margin:14px;padding:4px;border-radius:7px;background:#f6f5f4}.mode-switch button{min-height:42px;border:0;border-radius:4px;background:transparent;color:#6e6964;font-size:11px;font-weight:700;cursor:pointer}.mode-switch button[aria-pressed=true]{background:#fff;color:#282624;box-shadow:0 0 0 1px rgba(0,0,0,.1)}.action-copy{margin:14px;padding:11px;border-radius:7px;background:#f6f5f4}.action-copy strong,.action-copy span{display:block}.action-copy strong{font-size:12px}.action-copy span{margin-top:4px;color:#77716b;font-size:10px}.selection-summary{min-height:42px;display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin:10px 14px 0;color:#77716b;font-size:10px}.selection-summary>span{display:flex;align-items:center;gap:4px}.action-buttons{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:10px 14px 0}.btn{min-height:44px;border:1px solid rgba(0,0,0,.11);border-radius:4px;background:#fff;color:#282624;font-size:11px;font-weight:800;cursor:pointer}.btn.primary{border-color:transparent;background:#0075de;color:#fff}.btn.wide{width:calc(100% - 28px);margin:10px 14px 0}.btn:disabled{opacity:.43;cursor:not-allowed}.gem-bank{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;padding:14px}.gem-bank button{min-height:64px;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:7px;padding:7px;border:1px solid rgba(0,0,0,.1);border-radius:7px;background:#fff;text-align:left;cursor:pointer}.gem-bank button[aria-pressed=true]{border-color:#282624;box-shadow:0 0 0 2px #282624}.gem-bank button:disabled{opacity:.46}.gem-bank strong,.gem-bank small{display:block}.gem-bank strong{font:800 16px/1 ui-monospace,monospace}.gem-bank small{margin-top:4px;color:#77716b;font-size:8px}.return-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:12px 14px}.return-grid button{display:flex;align-items:center;gap:8px;padding:7px;border:1px solid rgba(0,0,0,.1);border-radius:7px;background:#fff;text-align:left}.return-grid button>span:last-child{font-size:9px}.return-grid b{display:block;margin-top:3px;font:800 10px/1 ui-monospace,monospace}.engine-panel{overflow:hidden}.engine-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,.65fr);gap:15px;padding:15px}.engine-section h3{margin:0;font-size:12px}.engine-section>p{margin:3px 0 0;color:#77716b;font-size:9px}.resource-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:11px}.resource-stat{min-width:76px;display:flex;align-items:center;gap:7px;padding:7px;border:1px solid rgba(0,0,0,.1);border-radius:7px;background:#f6f5f4;font-size:10px}.resource-stat strong{font-family:ui-monospace,monospace}.reserved-row{display:flex;gap:7px;margin-top:11px;overflow-x:auto;padding:2px}.reserved-row .development-card{min-width:155px;flex:1 0 155px}.reserved-row .empty{color:#89837d;font-size:10px}
@media(max-width:1180px){.play-grid{grid-template-columns:1fr}.side-stack{grid-template-columns:1fr 1fr}.side-stack>:last-child{grid-column:1/-1}}@media(max-width:820px){.card-row{display:flex;overflow-x:auto;padding:2px}.card-row .development-card{min-width:150px}.engine-grid{grid-template-columns:1fr}}@media(max-width:760px){.topbar{align-items:flex-start;flex-direction:column}.turn-status{width:100%}.status-strip{grid-template-columns:1fr 1fr}.status-strip>div:nth-child(2){border-right:0}.status-strip>div:nth-child(-n+2){border-bottom:1px solid rgba(0,0,0,.06)}.opponents{grid-template-columns:1fr 1fr}.side-stack{grid-template-columns:1fr}.side-stack>:last-child{grid-column:auto}.tier-row{grid-template-columns:50px minmax(0,1fr)}.tier-deck{min-height:128px}.waiting-panel{align-items:flex-start;flex-direction:column;gap:14px}.waiting-panel button{width:100%}}@media(max-width:430px){.opponents{grid-template-columns:1fr}.gem-bank{grid-template-columns:1fr 1fr}.market{padding:11px}.nobles{padding:11px}.action-buttons{grid-template-columns:1fr}}
</style>
