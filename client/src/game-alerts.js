import { reactive } from 'vue';
import { normalizeRoomError } from './games/errors';

const DEFAULT_ALERT = Object.freeze({
  tone: 'neutral',
  label: '안내',
  title: '',
  message: '',
  note: '',
  primaryLabel: '확인',
  secondaryLabel: '',
  destructive: false,
  dismissible: true,
});

export const gameAlertState = reactive({
  ...DEFAULT_ALERT,
  open: false,
  revision: 0,
});

export const gameAlertToast = reactive({
  message: '',
  visible: false,
});

let activeResolve = null;
let toastTimer = null;

export function openGameAlert(options = {}) {
  if (activeResolve) {
    activeResolve('replaced');
    activeResolve = null;
  }

  Object.assign(gameAlertState, DEFAULT_ALERT, options, {
    open: true,
    revision: gameAlertState.revision + 1,
  });

  return new Promise((resolve) => {
    activeResolve = resolve;
  });
}

export function resolveGameAlert(result = 'dismiss') {
  gameAlertState.open = false;
  const resolve = activeResolve;
  activeResolve = null;
  if (resolve) resolve(result);
}

export function notifyGameAlert(message) {
  gameAlertToast.message = String(message || '');
  gameAlertToast.visible = Boolean(gameAlertToast.message);
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    gameAlertToast.visible = false;
  }, 2600);
}

export function showActionAlert(message, options = {}) {
  return openGameAlert({
    tone: 'info',
    label: '행동 안내',
    title: options.title || '지금은 이 행동을 할 수 없어요',
    message,
    primaryLabel: options.primaryLabel || '확인',
    ...options,
  });
}

export function showRoomErrorAlert(data) {
  const error = normalizeRoomError(data);
  return openGameAlert({
    tone: 'info',
    label: '행동 안내',
    title: '요청을 처리하지 못했어요',
    message: error.message,
    note: error.code === 'UNKNOWN_ROOM_ERROR' ? '' : `오류 코드 · ${error.code}`,
    primaryLabel: '확인',
  });
}

export function showConnectionAlert(message, options = {}) {
  return openGameAlert({
    tone: 'error',
    label: '연결 오류',
    title: options.title || '게임 연결이 끊겼어요',
    message,
    primaryLabel: options.primaryLabel || '확인',
    dismissible: options.dismissible ?? false,
    ...options,
  });
}

export function showTurnTimeoutAlert(message, options = {}) {
  return openGameAlert({
    tone: 'warning',
    label: '시간 경고',
    title: options.title || '차례가 곧 끝나요',
    message,
    primaryLabel: options.primaryLabel || '확인',
    ...options,
  });
}

export function showGameCompleteAlert(message, options = {}) {
  return openGameAlert({
    tone: 'success',
    label: '게임 종료',
    title: options.title || '이번 게임이 끝났어요',
    message,
    primaryLabel: options.primaryLabel || '결과 계속 보기',
    ...options,
  });
}
