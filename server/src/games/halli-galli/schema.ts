import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';

export class HalliGalliPublicCard extends Schema {
  @type('string') id: string = '';
  @type('string') fruit: string = '';
  @type('number') count: number = 0;
}

export class HalliGalliPlayer extends Schema {
  @type('string') sessionId: string = '';
  @type('string') nickname: string = '';
  @type('boolean') isHost: boolean = false;
  @type('boolean') connected: boolean = true;
  @type('boolean') eliminated: boolean = false;
  @type('number') deckCount: number = 0;
  @type('number') faceUpCount: number = 0;
  @type('number') rank: number = 0;
  @type(HalliGalliPublicCard) topCard = new HalliGalliPublicCard();
}

export class HalliGalliState extends Schema {
  @type({ map: HalliGalliPlayer }) players = new MapSchema<HalliGalliPlayer>();
  @type('boolean') migrationReady: boolean = false;
  @type('string') hostSessionId: string = '';
  @type('string') currentTurnId: string = '';
  @type('number') turnDeadlineAt: number = 0;
  @type('string') gamePhase: string = 'waiting';
  @type('number') boardRevision: number = 0;
  @type('number') turnCount: number = 0;
  @type('number') roundCount: number = 0;
  @type('boolean') bellLocked: boolean = false;
  @type('boolean') finalRound: boolean = false;
  @type('string') exactFiveFruit: string = '';
  @type('string') lastBellPlayerId: string = '';
  @type('string') lastBellResult: string = '';
  @type('string') winnerSessionId: string = '';
  @type(['string']) rankings = new ArraySchema<string>();
  @type('string') lastAction: string = '';
}
