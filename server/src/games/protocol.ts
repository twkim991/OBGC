import type { Client } from 'colyseus';

export const CHAT_MAX_LENGTH = 300;

export interface RoomErrorPayload {
  code: string;
  message: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readString(
  value: unknown,
  options: { minLength?: number; maxLength?: number } = {},
): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  const minLength = options.minLength ?? 1;
  const maxLength = options.maxLength ?? Number.MAX_SAFE_INTEGER;

  if (normalized.length < minLength || normalized.length > maxLength) {
    return null;
  }

  return normalized;
}

export function readInteger(
  value: unknown,
  options: { min?: number; max?: number } = {},
): number | null {
  if (!Number.isInteger(value)) return null;

  const parsed = value as number;
  if (options.min !== undefined && parsed < options.min) return null;
  if (options.max !== undefined && parsed > options.max) return null;
  return parsed;
}

export function readChatMessage(value: unknown): string | null {
  return readString(value, { maxLength: CHAT_MAX_LENGTH });
}

export function readProtocolVersions(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};

  return Object.entries(value)
    .slice(0, 50)
    .reduce<Record<string, number>>((versions, [gameId, version]) => {
      const normalizedId = readString(gameId, { maxLength: 60 });
      const normalizedVersion = readInteger(version, { min: 1, max: 10000 });
      if (normalizedId && normalizedVersion !== null) {
        versions[normalizedId] = normalizedVersion;
      }
      return versions;
    }, {});
}

export function sendRoomError(
  client: Client,
  code: string,
  message: string,
) {
  const payload: RoomErrorPayload = { code, message };
  client.send('room_error', payload);
}

export class SlidingWindowRateLimiter {
  private readonly attempts = new Map<string, number[]>();

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
  ) {}

  allow(key: string, now = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const recent = (this.attempts.get(key) ?? []).filter(
      (timestamp) => timestamp > cutoff,
    );

    if (recent.length >= this.maxAttempts) {
      this.attempts.set(key, recent);
      return false;
    }

    recent.push(now);
    this.attempts.set(key, recent);
    return true;
  }

  clear(key: string) {
    this.attempts.delete(key);
  }
}
