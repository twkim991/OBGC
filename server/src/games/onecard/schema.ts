import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';
import type { Card, CardColor, CardType } from './domain/types';

export class OneCardCard extends Schema {
  @type('string') id: string = '';
  @type('string') color: CardColor = 'red';
  @type('string') type: CardType = 'number';
  @type('number') number: number = 0;
}

export function toOneCardSchemaCard(source: Card): OneCardCard {
  const card = new OneCardCard();
  card.id = source.id;
  card.color = source.color;
  card.type = source.type;
  card.number = source.number ?? 0;
  return card;
}

export class OneCardPlayer extends Schema {
  @type('string') sessionId: string = '';
  @type('string') nickname: string = '';
  @type('boolean') isHost: boolean = false;
  @type('number') handCount: number = 0;
  @type('boolean') alive: boolean = true;
  @type('boolean') bankrupt: boolean = false;
  @type('number') rank: number = 0;
  @type('boolean') shieldActive: boolean = false;
  @type('boolean') shieldPendingExpire: boolean = false;
}

export class MapleOneCardState extends Schema {
  @type({ map: OneCardPlayer }) players = new MapSchema<OneCardPlayer>();
  @type('boolean') migrationReady: boolean = false;
  @type('string') hostSessionId: string = '';
  @type([OneCardCard]) discardPile = new ArraySchema<OneCardCard>();
  @type('string') currentTurnId: string = '';
  @type('number') turnDeadlineAt: number = 0;
  @type('number') direction: number = 1;
  @type('string') gamePhase: string = 'waiting';
  @type('string') currentColor: string = '';
  @type('number') pendingAttack: number = 0;
  @type('string') winnerSessionId: string = '';
  @type(['string']) rankings = new ArraySchema<string>();
  @type('string') lastAction: string = '';
  @type('number') turnCount: number = 0;
}
