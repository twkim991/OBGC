// server/src/rooms/maple-onecard/types.ts
export type CardColor = 'red' | 'yellow' | 'green' | 'blue' | 'purple';

export type CardType =
  | 'number'
  | 'jump'
  | 'reverse'
  | 'plus1'
  | 'wild'
  | 'attack2'
  | 'attack3'
  | 'oz'
  | 'mihile'
  | 'hawkeye'
  | 'irina'
  | 'ikart';

export interface Card {
  id: string;
  color: CardColor;
  type: CardType;
  number?: number; // 1~6
}

export interface PlayerState {
  sessionId: string;
  nickname: string;
  hand: Card[];
  alive: boolean;
  bankrupt: boolean;
  shieldUntilTurn?: number; // 미하일 지속 종료 기준
  rank?: number;
}

export interface GameState {
  players: PlayerState[];
  deck: Card[];
  discardPile: Card[]; // 실제로 테이블 위에 남아 있는 카드
  currentPlayerIndex: number;
  direction: 1 | -1;
  started: boolean;
  ended: boolean;

  turnCount: number; // 몇 번째 턴인지
  currentColor: 'red' | 'yellow' | 'green' | 'blue' | null;
  pendingAttack: number; // 누적 공격력
  pendingAttackSource?: string; // 디버깅용
  lastAction?: string;

  winnerSessionId?: string;
  rankings: string[]; // sessionId 순서대로
}
