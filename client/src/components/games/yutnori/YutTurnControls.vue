<template>
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
        @click="$emit('start')"
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
          @click="$emit('activate-skill', skill)"
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
          @click="$emit('select-throw', index)"
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
          @click="$emit('select-piece', index)"
        >
          <strong>말 {{ index + 1 }}</strong>
          <span>{{ piece.position === 99 ? '완주' : piece.position === 0 ? '대기' : `${piece.position}번 칸` }}</span>
          <small v-if="piece.isStealth">투명화</small>
        </button>
      </div>
    </section>

    <div class="primary-actions">
      <button
        v-if="isMyTurn && gamePhase === 'throwing'"
        class="button button-primary"
        type="button"
        @click="$emit('throw')"
      >
        윷 던지기
      </button>
      <button
        v-if="isMyTurn && gamePhase === 'moving'"
        class="button button-primary"
        type="button"
        @click="$emit('move')"
      >
        선택한 말 이동
      </button>
    </div>
  </article>
</template>

<script setup>
defineProps({
  phaseLabel: { type: String, required: true },
  phaseTitle: { type: String, required: true },
  phaseDescription: { type: String, required: true },
  gamePhase: { type: String, required: true },
  playerCount: { type: Number, required: true },
  isHost: { type: Boolean, required: true },
  mySkills: { type: Array, required: true },
  isMyTurn: { type: Boolean, required: true },
  myActiveSkill: { type: String, default: '' },
  skillInfo: { type: Object, required: true },
  remainingThrows: { type: Array, required: true },
  selectedThrowIndex: { type: Number, required: true },
  myPieces: { type: Array, required: true },
  selectedPieceIndex: { type: Number, required: true },
  getThrowName: { type: Function, required: true },
});

defineEmits([
  'start',
  'activate-skill',
  'throw',
  'move',
  'select-throw',
  'select-piece',
]);
</script>

<style scoped>
.control-panel { padding: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: var(--color-surface); }
.panel-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-3); }
.panel-heading h2 { margin: 0; font-size: 20px; letter-spacing: -.015em; }
.panel-heading > span { color: var(--color-muted); font-size: 13px; }
.phase-copy { padding: var(--space-3); border-radius: var(--radius-small); background: var(--color-surface-muted); }
.phase-copy strong, .phase-copy span { display: block; }
.phase-copy span { margin-top: var(--space-1); color: var(--color-muted); font-size: 14px; }
.waiting-actions { display: grid; gap: var(--space-3); margin-top: var(--space-4); }
.waiting-actions p { margin: 0; color: var(--color-muted); font-size: 14px; }
.control-section { margin-top: var(--space-5); }
.control-section h3 { margin: 0 0 var(--space-2); color: var(--color-muted); font-size: 13px; letter-spacing: .02em; }
.skill-list { display: grid; gap: var(--space-2); }
.skill-button { min-height: 62px; width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-small); background: var(--color-surface); color: var(--color-ink); text-align: left; cursor: pointer; }
.skill-button:hover:not(:disabled) { background: var(--color-surface-muted); }
.skill-button.active { border-color: color-mix(in oklab, var(--color-warning), var(--color-border) 60%); background: color-mix(in oklab, var(--color-warning) 7%, white); }
.skill-button:disabled, .throw-choice:disabled, .piece-choice:disabled, .button:disabled { cursor: not-allowed; opacity: .46; }
.skill-button strong, .skill-button small { display: block; }
.skill-button small { margin-top: 2px; color: var(--color-muted); line-height: 1.35; }
.skill-button code { color: var(--color-warning); font: 700 11px/1 ui-monospace, 'SF Mono', Consolas, monospace; }
.active-skill-notice { margin: var(--space-2) 0 0; color: var(--color-warning); font-size: 13px; font-weight: 700; }
.throw-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); }
.throw-choice { min-height: 52px; border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-ink); font-weight: 700; cursor: pointer; }
.throw-choice.selected { border-color: var(--color-ink); background: var(--color-ink); color: white; }
.piece-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-2); }
.piece-choice { min-height: 62px; padding: var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface-muted); color: var(--color-ink); cursor: pointer; }
.piece-choice strong, .piece-choice span, .piece-choice small { display: block; }
.piece-choice span, .piece-choice small { color: var(--color-muted); font-size: 11px; }
.piece-choice.selected { border-color: color-mix(in oklab, var(--color-primary), var(--color-border) 62%); background: color-mix(in oklab, var(--color-primary) 7%, white); }
.piece-choice.stealth { border-color: color-mix(in oklab, var(--color-purple), var(--color-border) 65%); }
.primary-actions { display: grid; margin-top: var(--space-5); }
.button { min-height: 48px; padding: 0 var(--space-4); border: 1px solid transparent; border-radius: var(--radius-control); font-weight: 700; cursor: pointer; }
.button-primary { background: var(--color-primary); color: white; box-shadow: var(--shadow-card); }
.button-primary:hover:not(:disabled) { background: var(--color-primary-hover); }

@media (max-width: 720px) { .piece-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 480px) { .throw-row { grid-template-columns: repeat(2, 1fr); } }
</style>
