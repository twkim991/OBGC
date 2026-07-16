import {
  createRoomMigration,
  type MigrationParticipant,
} from './migration';
import type { GameMetadata } from './types';

export function createRematchTable(
  game: GameMetadata,
  participants: MigrationParticipant[],
) {
  return createRoomMigration(
    'table_room',
    {
      roomName: game.rematchTitle,
      gameType: game.id,
    },
    participants,
  );
}
