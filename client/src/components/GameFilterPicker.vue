<template>
  <div class="game-filter-shell" @keydown.esc="closePicker">
    <div class="quick-filters" role="group" aria-label="게임별 방 필터">
      <button
        type="button"
        class="quick-filter"
        :class="{ active: modelValue === 'all' }"
        :aria-pressed="modelValue === 'all'"
        @click="selectGame('all')"
      >
        전체
        <span class="quick-count">{{ totalRoomCount }}</span>
      </button>
      <button
        v-for="game in quickGames"
        :key="game.id"
        type="button"
        class="quick-filter"
        :class="{ active: modelValue === game.id }"
        :aria-pressed="modelValue === game.id"
        @click="selectGame(game.id)"
      >
        {{ game.label }}
        <span class="quick-count">{{ roomCount(game.id) }}</span>
      </button>
      <button
        v-if="selectedOverflowGame"
        type="button"
        class="quick-filter active selected-overflow"
        aria-pressed="true"
        @click="selectGame(selectedOverflowGame.id)"
      >
        {{ selectedOverflowGame.label }}
        <span class="quick-count">{{ roomCount(selectedOverflowGame.id) }}</span>
      </button>
    </div>

    <div ref="pickerRoot" class="game-picker">
      <button
        type="button"
        class="picker-trigger"
        aria-haspopup="dialog"
        :aria-expanded="isOpen"
        aria-controls="game-filter-panel"
        @click="togglePicker"
      >
        게임 선택
        <span class="picker-chevron" :class="{ open: isOpen }" aria-hidden="true">⌄</span>
      </button>

      <div v-if="isOpen" class="picker-backdrop" aria-hidden="true" @click="closePicker"></div>
      <section
        v-if="isOpen"
        id="game-filter-panel"
        class="picker-panel"
        role="dialog"
        aria-labelledby="game-filter-title"
      >
        <header class="picker-header">
          <div>
            <p>게임 필터</p>
            <h3 id="game-filter-title">어떤 게임을 찾으세요?</h3>
          </div>
          <button type="button" class="picker-close" aria-label="게임 선택 닫기" @click="closePicker">
            ×
          </button>
        </header>

        <label class="search-field">
          <span class="sr-only">게임 이름 검색</span>
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="search"
            placeholder="게임 이름 검색"
            autocomplete="off"
          />
        </label>

        <div class="picker-list" role="group" aria-label="게임 목록">
          <button
            v-for="game in filteredGames"
            :key="game.id"
            type="button"
            class="picker-option"
            :class="{ selected: modelValue === game.id }"
            :aria-pressed="modelValue === game.id"
            @click="selectGame(game.id)"
          >
            <span class="option-copy">
              <strong>{{ game.label }}</strong>
              <span>{{ roomCount(game.id) > 0 ? '열린 방 있음' : '현재 열린 방 없음' }}</span>
            </span>
            <span class="option-count">{{ roomCount(game.id) }}</span>
          </button>
          <p v-if="filteredGames.length === 0" class="picker-empty">
            검색 결과가 없습니다.
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  games: {
    type: Array,
    required: true,
  },
  roomCounts: {
    type: Object,
    required: true,
  },
  quickLimit: {
    type: Number,
    default: 4,
  },
});

const emit = defineEmits(['update:modelValue']);

const isOpen = ref(false);
const searchQuery = ref('');
const pickerRoot = ref(null);
const searchInput = ref(null);

const roomCount = (gameId) => props.roomCounts[gameId] || 0;

const totalRoomCount = computed(() =>
  Object.values(props.roomCounts).reduce((total, count) => total + count, 0)
);

const quickGames = computed(() => {
  const preferred = props.games.filter((game) => game.quickFilter);
  const preferredIds = new Set(preferred.map((game) => game.id));
  const remaining = props.games
    .filter((game) => !preferredIds.has(game.id))
    .sort((a, b) => roomCount(b.id) - roomCount(a.id) || a.label.localeCompare(b.label, 'ko'));

  return [...preferred, ...remaining].slice(0, props.quickLimit);
});

const selectedOverflowGame = computed(() => {
  if (props.modelValue === 'all' || quickGames.value.some((game) => game.id === props.modelValue)) {
    return null;
  }

  return props.games.find((game) => game.id === props.modelValue) || null;
});

const filteredGames = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase('ko');

  return [...props.games]
    .filter((game) => {
      const searchText = `${game.label} ${game.id} ${game.shortLabel || ''}`.toLocaleLowerCase('ko');
      return !query || searchText.includes(query);
    })
    .sort((a, b) => roomCount(b.id) - roomCount(a.id) || a.label.localeCompare(b.label, 'ko'));
});

const selectGame = (gameId) => {
  emit('update:modelValue', gameId);
  closePicker();
};

const togglePicker = async () => {
  isOpen.value = !isOpen.value;
  if (!isOpen.value) return;

  searchQuery.value = '';
  await nextTick();
  searchInput.value?.focus();
};

const closePicker = () => {
  isOpen.value = false;
  searchQuery.value = '';
};

const handleOutsideClick = (event) => {
  if (isOpen.value && pickerRoot.value && !pickerRoot.value.contains(event.target)) {
    closePicker();
  }
};

watch(isOpen, (open) => {
  if (open) document.addEventListener('pointerdown', handleOutsideClick);
  else document.removeEventListener('pointerdown', handleOutsideClick);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleOutsideClick);
});
</script>

<style scoped>
.game-filter-shell {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}

.quick-filters {
  display: inline-flex;
  min-width: 0;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-small);
  background: var(--color-surface);
}

.quick-filter,
.picker-trigger {
  min-height: 32px;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.quick-filter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 var(--space-3);
}

.quick-filter:hover,
.picker-trigger:hover {
  background: var(--color-surface-muted);
  color: var(--color-ink);
}

.quick-filter.active {
  background: var(--color-ink);
  color: white;
}

.quick-count {
  min-width: 18px;
  padding: 1px 5px;
  border-radius: var(--radius-pill);
  background: rgba(0, 0, 0, 0.06);
  color: inherit;
  font-size: 10px;
  text-align: center;
}

.quick-filter.active .quick-count {
  background: rgba(255, 255, 255, 0.18);
}

.game-picker {
  position: relative;
  flex: 0 0 auto;
}

.picker-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-ink-soft);
}

.picker-chevron {
  display: inline-block;
  font-size: 15px;
  line-height: 1;
  transition: transform 150ms ease;
}

.picker-chevron.open {
  transform: rotate(180deg);
}

.picker-backdrop {
  display: none;
}

.picker-panel {
  position: absolute;
  z-index: 30;
  top: calc(100% + 8px);
  right: 0;
  width: min(360px, calc(100vw - 32px));
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
  box-shadow: 0 20px 50px rgba(32, 27, 22, 0.16);
}

.picker-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-5) var(--space-3);
}

.picker-header p {
  margin: 0 0 4px;
  color: var(--color-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.picker-header h3 {
  margin: 0;
  color: var(--color-ink);
  font-size: 18px;
}

.picker-close {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  border: 0;
  border-radius: 50%;
  background: var(--color-surface-muted);
  color: var(--color-muted);
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
}

.search-field {
  display: block;
  padding: 0 var(--space-5) var(--space-3);
}

.search-field input {
  width: 100%;
  min-height: 42px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  color: var(--color-ink);
  font-size: 14px;
}

.search-field input:focus {
  border-color: var(--color-primary);
  background: var(--color-surface);
}

.picker-list {
  max-height: 340px;
  overflow-y: auto;
  padding: 0 var(--space-3) var(--space-3);
}

.picker-option {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 0;
  border-radius: var(--radius-small);
  background: transparent;
  color: var(--color-ink);
  cursor: pointer;
  text-align: left;
}

.picker-option:hover,
.picker-option.selected {
  background: var(--color-surface-muted);
}

.picker-option.selected {
  box-shadow: inset 3px 0 0 var(--color-primary);
}

.option-copy {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.option-copy strong {
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-copy span {
  color: var(--color-muted);
  font-size: 11px;
}

.option-count {
  min-width: 30px;
  min-height: 26px;
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-muted);
  font-size: 11px;
  font-weight: 800;
}

.picker-empty {
  margin: 0;
  padding: var(--space-8) var(--space-4);
  color: var(--color-muted);
  text-align: center;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 760px) {
  .game-filter-shell {
    width: 100%;
    justify-content: space-between;
  }

  .quick-filters {
    max-width: 100%;
    overflow-x: auto;
  }

  .picker-backdrop {
    position: fixed;
    z-index: 80;
    inset: 0;
    display: block;
    background: rgba(32, 27, 22, 0.32);
  }

  .picker-panel {
    position: fixed;
    z-index: 81;
    inset: auto 0 0;
    width: 100%;
    max-height: min(78vh, 620px);
    border-width: 1px 0 0;
    border-radius: var(--radius-panel) var(--radius-panel) 0 0;
  }

  .picker-list {
    max-height: min(52vh, 400px);
    padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
  }
}

@media (max-width: 520px) {
  .game-filter-shell {
    align-items: stretch;
    flex-direction: column;
  }

  .game-picker,
  .picker-trigger {
    width: 100%;
  }

  .picker-trigger {
    justify-content: space-between;
    min-height: 40px;
  }
}
</style>
