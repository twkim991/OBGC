import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';

export class SplendorResources extends Schema {
  @type('number') white: number = 0;
  @type('number') blue: number = 0;
  @type('number') green: number = 0;
  @type('number') red: number = 0;
  @type('number') black: number = 0;
  @type('number') gold: number = 0;
}

export class SplendorPublicCard extends Schema {
  @type('string') id: string = '';
  @type('number') tier: number = 1;
  @type('string') bonus: string = 'white';
  @type('number') prestige: number = 0;
  @type(SplendorResources) cost = new SplendorResources();
}

export class SplendorPublicNoble extends Schema {
  @type('string') id: string = '';
  @type('number') prestige: number = 3;
  @type(SplendorResources) requirement = new SplendorResources();
}

export class SplendorPlayer extends Schema {
  @type('string') sessionId: string = '';
  @type('string') nickname: string = '';
  @type('boolean') isHost: boolean = false;
  @type('boolean') connected: boolean = true;
  @type('number') prestige: number = 0;
  @type('number') developmentCount: number = 0;
  @type('number') reservedCount: number = 0;
  @type(SplendorResources) tokens = new SplendorResources();
  @type(SplendorResources) bonuses = new SplendorResources();
  @type(['string']) nobleIds = new ArraySchema<string>();
  @type('number') rank: number = 0;
}

export class SplendorState extends Schema {
  @type({ map: SplendorPlayer }) players = new MapSchema<SplendorPlayer>();
  @type('boolean') migrationReady: boolean = false;
  @type('string') hostSessionId: string = '';
  @type('string') firstPlayerId: string = '';
  @type('string') currentTurnId: string = '';
  @type('string') gamePhase: string = 'waiting';
  @type('string') actionPhase: string = 'waiting';
  @type('number') turnRevision: number = 0;
  @type('number') turnCount: number = 0;
  @type(SplendorResources) bank = new SplendorResources();
  @type([SplendorPublicCard]) tierOne = new ArraySchema<SplendorPublicCard>();
  @type([SplendorPublicCard]) tierTwo = new ArraySchema<SplendorPublicCard>();
  @type([SplendorPublicCard]) tierThree = new ArraySchema<SplendorPublicCard>();
  @type('number') tierOneDeckCount: number = 0;
  @type('number') tierTwoDeckCount: number = 0;
  @type('number') tierThreeDeckCount: number = 0;
  @type([SplendorPublicNoble]) nobles = new ArraySchema<SplendorPublicNoble>();
  @type(['string']) eligibleNobleIds = new ArraySchema<string>();
  @type('boolean') finalRoundTriggered: boolean = false;
  @type('string') finalRoundTriggeredBy: string = '';
  @type(['string']) winnerSessionIds = new ArraySchema<string>();
  @type(['string']) rankings = new ArraySchema<string>();
  @type('string') lastAction: string = '';
}
