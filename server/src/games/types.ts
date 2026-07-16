import type { Room } from 'colyseus';

export type GameRoomClass = new (...args: any[]) => Room;

export interface GameMetadata<GameId extends string = string> {
  id: GameId;
  label: string;
  minPlayers: number;
  maxPlayers: number;
  protocolVersion: number;
  enabled: boolean;
  rematchTitle: string;
}

export type PublicGameMetadata<GameId extends string = string> = Omit<
  GameMetadata<GameId>,
  'rematchTitle'
>;

export interface GameDefinition<GameId extends string = string>
  extends GameMetadata<GameId> {
  room: GameRoomClass;
}
