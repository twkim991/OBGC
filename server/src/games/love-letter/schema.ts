import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';

export class LoveLetterPublicCard extends Schema {
  @type('string') id: string = '';
  @type('string') character: string = '';
  @type('number') value: number = -1;
}

export class LoveLetterPlayer extends Schema {
  @type('string') sessionId: string = '';
  @type('string') nickname: string = '';
  @type('boolean') isHost: boolean = false;
  @type('boolean') connected: boolean = true;
  @type('boolean') eliminated: boolean = false;
  @type('boolean') protected: boolean = false;
  @type('number') favorTokens: number = 0;
  @type('number') handCount: number = 0;
  @type('number') rank: number = 0;
}

export class LoveLetterState extends Schema {
  @type({ map: LoveLetterPlayer }) players = new MapSchema<LoveLetterPlayer>();
  @type('boolean') migrationReady: boolean = false;
  @type('string') hostSessionId: string = '';
  @type('string') currentTurnId: string = '';
  @type('string') gamePhase: string = 'waiting';
  @type('string') actionPhase: string = 'waiting';
  @type('number') turnRevision: number = 0;
  @type('number') roundCount: number = 0;
  @type('number') deckCount: number = 0;
  @type('number') activeCount: number = 0;
  @type('number') favorTarget: number = 0;
  @type([LoveLetterPublicCard]) faceUpRemovedCards = new ArraySchema<LoveLetterPublicCard>();
  @type(LoveLetterPublicCard) lastPlayedCard = new LoveLetterPublicCard();
  @type(LoveLetterPublicCard) lastDiscardedCard = new LoveLetterPublicCard();
  @type('string') lastPlayedById: string = '';
  @type('string') lastTargetId: string = '';
  @type('string') lastGuessCharacter: string = '';
  @type('string') lastOutcome: string = '';
  @type(['string']) roundWinnerIds = new ArraySchema<string>();
  @type(['string']) winnerSessionIds = new ArraySchema<string>();
  @type(['string']) rankings = new ArraySchema<string>();
  @type('string') lastAction: string = '';
}
