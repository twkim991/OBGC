import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';

export class LostCitiesPublicCard extends Schema {
  @type('string') id = '';
  @type('string') color = '';
  @type('string') kind = '';
  @type('number') value = 0;
}

export class LostCitiesExpedition extends Schema {
  @type([LostCitiesPublicCard]) cards = new ArraySchema<LostCitiesPublicCard>();
  @type('number') score = 0;
}

export class LostCitiesExpeditions extends Schema {
  @type(LostCitiesExpedition) yellow = new LostCitiesExpedition();
  @type(LostCitiesExpedition) blue = new LostCitiesExpedition();
  @type(LostCitiesExpedition) white = new LostCitiesExpedition();
  @type(LostCitiesExpedition) green = new LostCitiesExpedition();
  @type(LostCitiesExpedition) red = new LostCitiesExpedition();
}

export class LostCitiesDiscardPile extends Schema {
  @type('number') count = 0;
  @type(LostCitiesPublicCard) topCard = new LostCitiesPublicCard();
}

export class LostCitiesDiscardPiles extends Schema {
  @type(LostCitiesDiscardPile) yellow = new LostCitiesDiscardPile();
  @type(LostCitiesDiscardPile) blue = new LostCitiesDiscardPile();
  @type(LostCitiesDiscardPile) white = new LostCitiesDiscardPile();
  @type(LostCitiesDiscardPile) green = new LostCitiesDiscardPile();
  @type(LostCitiesDiscardPile) red = new LostCitiesDiscardPile();
}

export class LostCitiesPlayer extends Schema {
  @type('string') sessionId = '';
  @type('string') nickname = '';
  @type('boolean') isHost = false;
  @type('boolean') connected = true;
  @type('number') handCount = 0;
  @type('number') roundScore = 0;
  @type('number') totalScore = 0;
  @type('number') rank = 0;
  @type(LostCitiesExpeditions) expeditions = new LostCitiesExpeditions();
}

export class LostCitiesState extends Schema {
  @type({ map: LostCitiesPlayer }) players = new MapSchema<LostCitiesPlayer>();
  @type('boolean') migrationReady = false;
  @type('string') hostSessionId = '';
  @type('string') currentTurnId = '';
  @type('number') turnDeadlineAt = 0;
  @type('string') roundStarterId = '';
  @type('string') gamePhase = 'waiting';
  @type('string') actionPhase = 'waiting';
  @type('number') turnRevision = 0;
  @type('number') turnCount = 0;
  @type('number') roundCount = 0;
  @type('number') deckCount = 0;
  @type('string') blockedDiscardColor = '';
  @type(LostCitiesDiscardPiles) discards = new LostCitiesDiscardPiles();
  @type(['string']) roundWinnerIds = new ArraySchema<string>();
  @type(['string']) winnerSessionIds = new ArraySchema<string>();
  @type(['string']) rankings = new ArraySchema<string>();
  @type('string') lastAction = '';
}
