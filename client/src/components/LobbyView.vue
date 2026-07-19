<template>
  <div class="lobby-screen">
    <header class="lobby-heading">
      <div>
        <p class="eyebrow"><span class="live-dot" :class="{ offline: lobbyError }" aria-hidden="true"></span> 실시간 공개 로비</p>
        <h1>함께할 테이블을 찾아보세요.</h1>
        <p class="lobby-description">
          원하는 게임을 고르고, 열려 있는 방에 바로 참여하세요. 마음에 드는 방이 없다면 새 테이블을 열 수 있습니다.
        </p>
      </div>
      <div class="connection-note" :class="{ offline: lobbyError }" role="status" aria-live="polite">
        <strong>{{ lobbyError ? '연결이 끊겼어요' : colyseusClient ? '온라인 상태' : '로비 연결 중' }}</strong>
        <span>{{ lobbyError ? '인터넷 연결을 확인해 주세요.' : colyseusClient ? '공개 방 목록 자동 갱신 중' : '공개 방을 불러오고 있어요.' }}</span>
      </div>
    </header>

    <aside v-if="GAME_CATALOG_ISSUES.length" class="catalog-warning" role="status">
      <strong>일부 게임을 사용할 수 없습니다.</strong>
      <ul>
        <li v-for="issue in GAME_CATALOG_ISSUES" :key="`${issue.gameId}-${issue.code}`">
          {{ issue.message }}
        </li>
      </ul>
    </aside>

    <section class="lobby-grid" aria-label="공개 방 둘러보기">
      <aside class="game-rail" aria-label="게임 필터">
        <h2 class="rail-title">게임 선택</h2>
        <div class="game-filter-list">
          <button
            type="button"
            class="game-filter"
            :class="{ 'is-active': selectedFilter === 'all' }"
            :aria-pressed="selectedFilter === 'all'"
            @click="selectedFilter = 'all'"
          >
            <span class="game-filter-icon all-games" aria-hidden="true">ALL</span>
            <span class="game-filter-name">전체 게임</span>
            <span class="game-filter-count">{{ availableRooms.length }}</span>
          </button>
          <button
            v-for="game in GAME_CATALOG"
            :key="game.id"
            type="button"
            class="game-filter"
            :class="{ 'is-active': selectedFilter === game.id }"
            :aria-pressed="selectedFilter === game.id"
            @click="selectedFilter = game.id"
          >
            <span class="game-filter-icon" :style="gameTone(game.id)" aria-hidden="true">
              {{ game.shortLabel }}
            </span>
            <span class="game-filter-name">{{ game.label }}</span>
            <span class="game-filter-count">{{ roomCountByGame[game.id] || 0 }}</span>
          </button>
        </div>
      </aside>

      <section class="room-panel" aria-labelledby="room-list-title">
        <h2 id="room-list-title" class="sr-only">공개 방 목록</h2>
        <div class="room-toolbar">
          <label class="room-search">
            <span class="search-mark" aria-hidden="true"></span>
            <span class="sr-only">방 검색</span>
            <input
              v-model.trim="searchQuery"
              type="search"
              placeholder="방 제목 또는 게임 검색"
              autocomplete="off"
            />
          </label>
          <label>
            <span class="sr-only">정렬 기준</span>
            <select v-model="roomSort" class="sort-select">
              <option value="available">입장 가능한 방</option>
              <option value="newest">최근 생성순</option>
              <option value="players">참여자 많은 순</option>
            </select>
          </label>
        </div>
        <div class="room-list-header" aria-hidden="true">
          <span>방</span>
          <span>게임</span>
          <span>인원</span>
          <span>참여</span>
        </div>
        <ul class="room-list" aria-live="polite">
          <li v-if="filteredRooms.length === 0" class="empty">
            <strong>{{ emptyRoomTitle }}</strong>
            <span>{{ emptyRoomDescription }}</span>
            <button type="button" class="empty-create-button" @click="openCreateModal">새 테이블 열기</button>
          </li>
          <li v-for="room in displayedRooms" :key="room.roomId" class="room-item">
            <div class="room-main">
              <span class="room-icon" :style="gameTone(room.metadata?.gameType)" aria-hidden="true">
                {{ gameShortLabel(room.metadata?.gameType) }}
              </span>
              <div class="room-copy">
                <strong class="room-title">{{ room.metadata?.roomName || '방 제목 없음' }}</strong>
                <span class="room-info">공개 테이블</span>
              </div>
            </div>
            <span class="room-game">{{ gameLabel(room.metadata?.gameType) }}</span>
            <div class="room-capacity">
              <span class="room-members">{{ room.clients }} / {{ room.maxClients }}</span>
              <span class="room-status" :class="{ full: room.clients >= room.maxClients }">
                {{ room.clients >= room.maxClients ? '정원 마감' : '입장 가능' }}
              </span>
            </div>
            <button
              type="button"
              class="join-button"
              @click="joinRoom(room.roomId)"
              :disabled="room.clients >= room.maxClients"
              :aria-label="`${gameLabel(room.metadata?.gameType)} ${room.metadata?.roomName || '방 제목 없음'} 입장하기`"
            >
              {{ room.clients >= room.maxClients ? '가득 참' : '입장하기' }}
            </button>
          </li>
        </ul>
        <button v-if="hasMoreRooms" type="button" class="load-more" @click="visibleRoomLimit += 100">
          방 {{ Math.min(100, filteredRooms.length - displayedRooms.length) }}개 더 보기
        </button>
      </section>
    </section>

    <div
      v-if="createModalOpen"
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-room-title"
      aria-describedby="create-room-description"
      @click.self="closeCreateModal"
    >
      <form class="create-modal" @submit.prevent="createRoom">
        <div class="modal-header">
          <div>
            <h2 id="create-room-title">새 테이블 열기</h2>
            <p id="create-room-description">게임과 기본 설정을 고르면 바로 대기실이 만들어집니다.</p>
          </div>
          <button class="modal-close" type="button" aria-label="닫기" @click="closeCreateModal">×</button>
        </div>
        <div class="modal-body">
          <fieldset class="game-choice-field">
            <legend>게임 선택</legend>
            <div class="game-choice-grid">
              <label v-for="game in GAME_CATALOG" :key="game.id" class="game-choice">
                <input v-model="newRoomGame" type="radio" name="newRoomGame" :value="game.id" />
                <span>
                  <strong>{{ game.label }}</strong>
                  <small>{{ gameDescription(game.id) }}</small>
                </span>
              </label>
            </div>
          </fieldset>
          <label class="modal-field">
            <span>방 제목</span>
            <input
              ref="roomTitleInput"
              v-model="newRoomName"
              maxlength="60"
              placeholder="예: 퇴근 후 가볍게 한 판"
              aria-required="true"
            />
          </label>
          <label class="modal-field">
            <span>내 닉네임</span>
            <input
              v-model="nickname"
              maxlength="40"
              autocomplete="nickname"
              placeholder="닉네임을 입력하세요"
              aria-required="true"
            />
            <small class="field-help">방 생성과 입장에 사용되며 다른 사용자와 중복될 수 있습니다.</small>
          </label>
          <div class="switch-row">
            <div class="switch-copy">
              <strong>공개 방으로 만들기</strong>
              <span>{{ newRoomPublic ? '누구나 공개 목록에서 찾아 참여할 수 있어요.' : '초대받은 사용자만 방 ID로 참여할 수 있어요.' }}</span>
            </div>
            <label class="visibility-switch">
              <input v-model="newRoomPublic" type="checkbox" />
              <span class="sr-only">공개 방으로 만들기</span>
              <span class="switch-track" aria-hidden="true"></span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-cancel" type="button" @click="closeCreateModal">취소</button>
          <button class="modal-submit" type="submit" :disabled="!isSupportedGame(newRoomGame)">
            대기실 만들기
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, onUnmounted, watch } from 'vue';
import { showActionAlert, showConnectionAlert } from '../game-alerts';
import {
  DEFAULT_GAME_ID,
  GAME_CATALOG,
  GAME_CATALOG_ISSUES,
  gameLabel,
  gameShortLabel,
  gameTone,
  isSupportedGame,
} from '../games';

const props = defineProps(['colyseusClient', 'playerIdentity']);
const emit = defineEmits(['join-table', 'update-nickname']);

const availableRooms = ref([]);
const nickname = ref(props.playerIdentity?.nickname || '');
const newRoomName = ref('');
const newRoomGame = ref(DEFAULT_GAME_ID);
const newRoomPublic = ref(true);
const selectedFilter = ref('all');
const searchQuery = ref('');
const roomSort = ref('available');
const createModalOpen = ref(false);
const roomTitleInput = ref(null);
const lobbyError = ref('');
const visibleRoomLimit = ref(100);
let lobbyConnection = null;
let lobbyMetricPending = false;
let pendingMetricSource = 'initial';

const GAME_DESCRIPTIONS = Object.freeze({
  yutnori: '전략과 역전의 전통 게임',
  onecard: '빠른 판단의 카드 게임',
  rummikub: '타일 조합을 완성하는 전략 게임',
  'davinci-code': '숫자를 추리하는 심리전',
  'halli-galli': '과일을 세고 종을 울리는 반응 게임',
  'love-letter': '공개 기록으로 역할을 추리하는 카드 게임',
  splendor: '보석과 할인으로 상단을 키우는 전략 게임',
  'lost-cities': '오름차순 탐험대에 위험을 거는 2인 전략 게임',
});

const gameDescription = (gameId) => GAME_DESCRIPTIONS[gameId] || '함께 즐기는 보드게임';

const scheduleLobbyMetric = (source) => {
  pendingMetricSource = source;
  if (lobbyMetricPending) return;

  const startedAt = performance.now();
  lobbyMetricPending = true;
  nextTick(() => {
    window.requestAnimationFrame(() => {
      lobbyMetricPending = false;
      console.info(
        JSON.stringify({
          level: 'info',
          event: 'lobby.rooms_rendered',
          source: pendingMetricSource,
          receivedRoomCount: availableRooms.value.length,
          filteredRoomCount: filteredRooms.value.length,
          renderedRoomCount: displayedRooms.value.length,
          durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
        })
      );
    });
  });
};

const roomCountByGame = computed(() => {
  const counts = Object.fromEntries(GAME_CATALOG.map((game) => [game.id, 0]));

  availableRooms.value.forEach((room) => {
    const gameType = room.metadata?.gameType;
    if (isSupportedGame(gameType)) counts[gameType] += 1;
  });

  return counts;
});

const filteredRooms = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase('ko-KR');
  const rooms = availableRooms.value.filter((room) => {
    const matchesGame =
      selectedFilter.value === 'all' || room.metadata?.gameType === selectedFilter.value;
    if (!matchesGame || !query) return matchesGame;

    const roomName = room.metadata?.roomName || '';
    const gameName = gameLabel(room.metadata?.gameType);
    return `${roomName} ${gameName}`.toLocaleLowerCase('ko-KR').includes(query);
  });

  if (roomSort.value === 'players') {
    rooms.sort((a, b) => b.clients - a.clients);
  } else if (roomSort.value === 'available') {
    rooms.sort(
      (a, b) =>
        Number(a.clients >= a.maxClients) - Number(b.clients >= b.maxClients) ||
        a.clients / a.maxClients - b.clients / b.maxClients
    );
  }
  return rooms;
});

const displayedRooms = computed(() => filteredRooms.value.slice(0, visibleRoomLimit.value));
const hasMoreRooms = computed(() => displayedRooms.value.length < filteredRooms.value.length);

watch(
  () => GAME_CATALOG.map((game) => game.id).join(','),
  () => {
    if (!isSupportedGame(newRoomGame.value)) {
      newRoomGame.value = GAME_CATALOG[0]?.id || '';
    }
    if (selectedFilter.value !== 'all' && !isSupportedGame(selectedFilter.value)) {
      selectedFilter.value = 'all';
    }
  },
  { immediate: true }
);

watch(selectedFilter, () => {
  visibleRoomLimit.value = 100;
});

watch(
  () => props.playerIdentity?.nickname,
  (value) => {
    if (value && value !== nickname.value) nickname.value = value;
  }
);

const emptyRoomTitle = computed(() =>
  searchQuery.value
    ? '검색 결과가 없습니다.'
    : availableRooms.value.length === 0
    ? '아직 열린 테이블이 없습니다.'
    : `${gameLabel(selectedFilter.value)} 방이 없습니다.`
);

const emptyRoomDescription = computed(() =>
  searchQuery.value
    ? '다른 검색어를 입력하거나 게임 필터를 바꿔보세요.'
    : availableRooms.value.length === 0
    ? '첫 테이블을 만들어 친구를 초대해보세요.'
    : '다른 게임을 선택하거나 새 테이블을 만들어보세요.'
);

const openCreateModal = async () => {
  createModalOpen.value = true;
  await nextTick();
  roomTitleInput.value?.focus();
};

const closeCreateModal = () => {
  createModalOpen.value = false;
};

defineExpose({ openCreateModal });

const handleModalKeydown = (event) => {
  if (event.key === 'Escape' && createModalOpen.value) closeCreateModal();
};

watch(createModalOpen, (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

onMounted(() => window.addEventListener('keydown', handleModalKeydown));

// props.colyseusClient가 초기화된 후 로비 접속
watch(
  () => props.colyseusClient,
  async (client) => {
    if (client) {
      try {
        lobbyConnection = await client.joinOrCreate('lobby');
        lobbyError.value = '';

        lobbyConnection.onMessage('rooms', (rooms) => {
          availableRooms.value = rooms;
          scheduleLobbyMetric('snapshot');
        });
        lobbyConnection.onMessage('+', ([roomId, room]) => {
          const exists = availableRooms.value.findIndex((r) => r.roomId === roomId);
          if (exists !== -1) availableRooms.value[exists] = room;
          else availableRooms.value.push(room);
          scheduleLobbyMetric(exists === -1 ? 'room_added' : 'room_updated');
        });
        lobbyConnection.onMessage('-', (roomId) => {
          availableRooms.value = availableRooms.value.filter((r) => r.roomId !== roomId);
          scheduleLobbyMetric('room_removed');
        });
      } catch (e) {
        console.error('로비 접속 에러:', e);
        lobbyError.value = '실시간 방 목록에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.';
        void showConnectionAlert(lobbyError.value, {
          title: '실시간 테이블에 연결하지 못했어요',
          note: '서버가 준비되면 페이지를 새로고침해 다시 연결할 수 있습니다.',
          primaryLabel: '확인',
          dismissible: true,
        });
      }
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  if (lobbyConnection) lobbyConnection.leave();
  document.body.style.overflow = '';
  window.removeEventListener('keydown', handleModalKeydown);
});

const getPlayerIdentity = () => {
  const normalizedNickname = nickname.value.trim();
  if (!normalizedNickname) {
    lobbyError.value = '방을 만들거나 입장하려면 닉네임을 입력해주세요.';
    void showActionAlert(lobbyError.value, {
      title: '닉네임이 필요해요',
      primaryLabel: '입력하기',
    });
    return null;
  }

  nickname.value = normalizedNickname;
  emit('update-nickname', normalizedNickname);
  return {
    ...props.playerIdentity,
    nickname: normalizedNickname,
  };
};

const createRoom = async () => {
  if (!newRoomName.value.trim()) {
    await showActionAlert('새 테이블을 구분할 수 있도록 방 제목을 입력해주세요.', {
      title: '방 제목이 필요해요',
      primaryLabel: '입력하기',
    });
    return;
  }
  if (!isSupportedGame(newRoomGame.value)) {
    await showActionAlert('현재 이용할 수 있는 게임 중 하나를 선택해주세요.', {
      title: '플레이할 게임을 선택해주세요',
      primaryLabel: '게임 선택',
    });
    return;
  }
  if (!props.colyseusClient) return;
  const playerIdentity = getPlayerIdentity();
  if (!playerIdentity) return;
  try {
    lobbyError.value = '';
    const connection = await props.colyseusClient.create('table_room', {
      roomName: newRoomName.value.trim(),
      gameType: newRoomGame.value,
      publicRoom: newRoomPublic.value,
      ...playerIdentity,
    });
    closeCreateModal();
    emit('join-table', connection); // 부모에게 접속 정보 전달
  } catch (e) {
    console.error('방 생성 에러:', e);
    lobbyError.value = '방을 만들지 못했습니다. 입력 내용과 서버 연결을 확인해주세요.';
    void showConnectionAlert(lobbyError.value, {
      title: '새 테이블을 만들지 못했어요',
      primaryLabel: '확인',
      dismissible: true,
    });
  }
};

const joinRoom = async (roomId) => {
  if (!props.colyseusClient) return;
  const playerIdentity = getPlayerIdentity();
  if (!playerIdentity) return;
  try {
    lobbyError.value = '';
    const connection = await props.colyseusClient.joinById(roomId, playerIdentity);
    emit('join-table', connection);
  } catch (e) {
    console.error('방 입장 에러:', e);
    lobbyError.value = '방에 입장하지 못했습니다. 방이 시작되었거나 인원이 가득 찼을 수 있습니다.';
    void showConnectionAlert(lobbyError.value, {
      title: '테이블에 입장하지 못했어요',
      primaryLabel: '다른 테이블 보기',
      dismissible: true,
    });
  }
};
</script>

<style scoped src="./LobbyView.css"></style>
