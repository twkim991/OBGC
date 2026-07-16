type LogLevel = 'info' | 'warn' | 'error';

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .slice(0, 300)
    .replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]');
}

export function logRoomEvent(
  level: LogLevel,
  event: string,
  context: Record<string, string | number | boolean | undefined> = {},
) {
  const payload = JSON.stringify({ level, event, ...context });
  if (level === 'error') console.error(payload);
  else if (level === 'warn') console.warn(payload);
  else console.log(payload);
}

export function logRoomError(
  event: string,
  error: unknown,
  context: Record<string, string | number | boolean | undefined> = {},
) {
  logRoomEvent('error', event, { ...context, message: safeMessage(error) });
}
