import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';

export class YutPiece extends Schema {
  @type('string') id: string = '';
  @type('number') position: number = 0;
  @type('boolean') isStealth: boolean = false;
}

export class YutPlayer extends Schema {
  @type('string') sessionId: string = '';
  @type('string') nickname: string = '';
  @type('boolean') isHost: boolean = false;
  @type('string') teamColor: string = '';
  @type([YutPiece]) pieces = new ArraySchema<YutPiece>();
  @type('number') skillCount: number = 0;
  @type('string') activeSkill: string = '';
  @type('boolean') usedSkillThisTurn: boolean = false;
}

export class YutnoriState extends Schema {
  @type({ map: YutPlayer }) players = new MapSchema<YutPlayer>();
  @type('boolean') migrationReady: boolean = false;
  @type('string') hostSessionId: string = '';
  @type('string') currentTurnId: string = '';
  @type('number') turnDeadlineAt: number = 0;
  @type(['number']) remainingThrows = new ArraySchema<number>();
  @type('string') gamePhase: string = 'waiting';
  @type('string') winnerSessionId: string = '';
  @type(['number']) titans = new ArraySchema<number>();
}
