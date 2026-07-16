import { randomBytes } from 'crypto';
import { matchMaker } from 'colyseus';
import { isRecord, readProtocolVersions, readString } from './protocol';

export const MIGRATION_SEAT_SECONDS = 20;
export const MIGRATION_ABORT_MS = 25000;
export const MIGRATION_RETRY_MS = 27000;

export interface MigrationParticipant {
  sourceSessionId: string;
  playerId: string;
  nickname: string;
  isHost: boolean;
  protocolVersions: Record<string, number>;
}

export interface MigrationSeat extends MigrationParticipant {
  token: string;
}

export interface RoomMigration {
  roomId: string;
  reservations: Map<string, SeatReservationPayload>;
}

export interface SeatReservationPayload {
  sessionId: string;
  room: {
    name: string;
    roomId: string;
    processId: string;
  };
}

function readMigrationSeat(value: unknown): MigrationSeat | null {
  if (!isRecord(value)) return null;

  const token = readString(value.token, { maxLength: 128 });
  const sourceSessionId = readString(value.sourceSessionId, { maxLength: 128 });
  const playerId = readString(value.playerId, { maxLength: 128 });
  const nickname = readString(value.nickname, { maxLength: 40 });
  if (!token || !sourceSessionId || !playerId || !nickname) return null;

  return {
    token,
    sourceSessionId,
    playerId,
    nickname,
    isHost: value.isHost === true,
    protocolVersions: readProtocolVersions(value.protocolVersions),
  };
}

function readMigrationToken(options: unknown): string | null {
  if (!isRecord(options)) return null;
  return readString(options.migrationToken, { maxLength: 128 });
}

export class MigrationSeatRegistry {
  private readonly seats = new Map<string, MigrationSeat>();
  readonly total: number;

  constructor(options?: unknown) {
    const rawSeats =
      isRecord(options) && Array.isArray(options.migrationSeats)
        ? options.migrationSeats
        : [];

    rawSeats.forEach((rawSeat) => {
      const seat = readMigrationSeat(rawSeat);
      if (seat) this.seats.set(seat.token, seat);
    });

    this.total = this.seats.size;
  }

  get isRequired(): boolean {
    return this.total > 0 && this.seats.size > 0;
  }

  get isComplete(): boolean {
    return this.total > 0 && this.seats.size === 0;
  }

  authorize(options: unknown): boolean {
    if (!this.isRequired) return true;
    const token = readMigrationToken(options);
    return token !== null && this.seats.has(token);
  }

  claim(options: unknown): MigrationSeat | null {
    const token = readMigrationToken(options);
    if (!token) return null;

    const seat = this.seats.get(token) ?? null;
    if (seat) this.seats.delete(token);
    return seat;
  }

  expire() {
    this.seats.clear();
  }
}

export function isMigrationGroupReady(
  registry: MigrationSeatRegistry,
  connectedClientCount: number,
) {
  return registry.isComplete && connectedClientCount === registry.total;
}

export async function createRoomMigration(
  roomName: string,
  roomOptions: Record<string, unknown>,
  participants: MigrationParticipant[],
): Promise<RoomMigration> {
  if (participants.length === 0) {
    throw new Error('이동할 플레이어가 없습니다.');
  }

  const migrationSeats: MigrationSeat[] = participants.map((participant) => ({
    ...participant,
    // Cafe24의 구형 Node.js에서도 동작하며 URL에 안전한 192비트 토큰입니다.
    token: randomBytes(24).toString('hex'),
  }));

  const room = await matchMaker.createRoom(roomName, {
    ...roomOptions,
    migrationSeats,
  });

  const reservations = new Map<string, SeatReservationPayload>();

  try {
    for (const seat of migrationSeats) {
      const reservation = await matchMaker.joinById(room.roomId, {
        migrationToken: seat.token,
      });
      reservations.set(seat.sourceSessionId, {
        sessionId: reservation.sessionId,
        room: {
          name: reservation.room.name,
          roomId: reservation.room.roomId,
          processId: reservation.room.processId,
        },
      });
    }

    await matchMaker.remoteRoomCall(room.roomId, 'lock');
  } catch (error) {
    await matchMaker.remoteRoomCall(room.roomId, 'disconnect').catch(() => undefined);
    throw error;
  }

  return { roomId: room.roomId, reservations };
}
