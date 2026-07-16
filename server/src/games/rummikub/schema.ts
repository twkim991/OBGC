import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';

export class RummikubPublicTile extends Schema {
  @type('string') id: string = '';
  @type('string') color: string = 'red';
  @type('number') number: number = 0;
  @type('boolean') isJoker: boolean = false;
}

export class RummikubPublicMeld extends Schema {
  @type([RummikubPublicTile]) tiles = new ArraySchema<RummikubPublicTile>();
}

export class RummikubPlayer extends Schema {
  @type('string') sessionId: string = '';
  @type('string') nickname: string = '';
  @type('boolean') isHost: boolean = false;
  @type('boolean') connected: boolean = true;
  @type('number') handCount: number = 0;
  @type('boolean') hasInitialMeld: boolean = false;
  @type('number') score: number = 0;
  @type('number') rank: number = 0;
}

export class RummikubState extends Schema {
  @type({ map: RummikubPlayer }) players = new MapSchema<RummikubPlayer>();
  @type([RummikubPublicMeld]) melds = new ArraySchema<RummikubPublicMeld>();
  @type('boolean') migrationReady: boolean = false;
  @type('string') hostSessionId: string = '';
  @type('string') currentTurnId: string = '';
  @type('string') gamePhase: string = 'waiting';
  @type('number') poolCount: number = 0;
  @type('number') boardRevision: number = 0;
  @type('number') consecutivePasses: number = 0;
  @type('number') turnCount: number = 0;
  @type('string') winnerSessionId: string = '';
  @type(['string']) rankings = new ArraySchema<string>();
  @type('string') lastAction: string = '';
}

