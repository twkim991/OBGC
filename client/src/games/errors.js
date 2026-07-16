export function normalizeRoomError(data) {
  return {
    code: typeof data?.code === 'string' ? data.code : 'UNKNOWN_ROOM_ERROR',
    message:
      typeof data?.message === 'string' && data.message.trim()
        ? data.message.trim()
        : '요청을 처리하지 못했습니다.',
  };
}

export function toSystemErrorMessage(data) {
  const error = normalizeRoomError(data);
  return {
    clientId: 'System',
    message: error.message,
    errorCode: error.code,
  };
}
