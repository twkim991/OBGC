import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';

export class DavinciPublicTile extends Schema {
  @type('string') id: string = '';
  @type('string') color: string = 'light';
  @type('boolean') revealed: boolean = false;
  @type('number') number: number = -1;
}

export class DavinciPlayer extends Schema {
  @type('string') sessionId: string = '';
  @type('string') nickname: string = '';
  @type('boolean') isHost: boolean = false;
  @type('boolean') connected: boolean = true;
  @type('boolean') setupComplete: boolean = false;
  @type('boolean') eliminated: boolean = false;
  @type('number') hiddenCount: number = 0;
  @type('number') rank: number = 0;
  @type([DavinciPublicTile]) code = new ArraySchema<DavinciPublicTile>();
}

export class DavinciCodeState extends Schema {
  @type({ map: DavinciPlayer }) players = new MapSchema<DavinciPlayer>();
  @type('boolean') migrationReady: boolean = false;
  @type('string') hostSessionId: string = '';
  @type('string') currentTurnId: string = '';
  @type('number') turnDeadlineAt: number = 0;
  @type('string') gamePhase: string = 'waiting';
  @type('string') turnPhase: string = 'waiting';
  @type('number') turnRevision: number = 0;
  @type('number') turnCount: number = 0;
  @type('number') lightPoolCount: number = 0;
  @type('number') darkPoolCount: number = 0;
  @type('string') drawnTileColor: string = '';
  @type('string') winnerSessionId: string = '';
  @type(['string']) rankings = new ArraySchema<string>();
  @type('string') lastAction: string = '';
}
