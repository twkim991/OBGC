import { Room, Client } from 'colyseus';
import { Schema, MapSchema, ArraySchema, type } from '@colyseus/schema';

// --- 스키마 정의 ---
export class YutPiece extends Schema {
  @type('string') id: string;
  @type('number') position: number = 0; // 0: 시작점, 99: 완주
}
export class YutPlayer extends Schema {
  @type('string') sessionId: string;
  @type('string') teamColor: string;
  @type([YutPiece]) pieces = new ArraySchema<YutPiece>();
}
export class YutnoriState extends Schema {
  @type({ map: YutPlayer }) players = new MapSchema<YutPlayer>();
  @type('string') currentTurnId: string = '';
  @type('string') lastThrowResult: string = '';
  @type('number') lastThrowSteps: number = 0; // 🔥 추가: 방금 던진 윷의 이동 칸 수 기억
  @type('string') gamePhase: string = 'throwing'; // 🔥 'throwing'(던지기) -> 'moving'(이동하기)
}

// --- 🎯 윷놀이 길찾기 맵 (핵심 알고리즘) ---
const NEXT_MAP: Record<number, number> = {
  // 외곽 한 바퀴
  0: 1,
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
  6: 7,
  7: 8,
  8: 9,
  9: 10,
  10: 11,
  11: 12,
  12: 13,
  13: 14,
  14: 15,
  15: 16,
  16: 17,
  17: 18,
  18: 19,
  19: 99, // 99는 완주
  // 지름길 대각선
  20: 21,
  21: 22,
  25: 26,
  26: 22,
  22: 27,
  27: 28,
  28: 99,
};
// 코너에서 '처음' 출발할 때만 타는 지름길
const FAST_MAP: Record<number, number> = { 5: 20, 10: 25, 22: 27 };
// 빽도 전용 뒤로 가기 맵
const PREV_MAP: Record<number, number> = {
  1: 0,
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 7,
  9: 8,
  10: 9,
  11: 10,
  12: 11,
  13: 12,
  14: 13,
  15: 14,
  16: 15,
  17: 16,
  18: 17,
  19: 18,
  0: 19, // 시작점에서 빽도 치면 도착점 바로 앞으로 점프! (꿀잼 룰)
  20: 5,
  21: 20,
  25: 10,
  26: 25,
  22: 21,
  27: 22,
  28: 27,
};

export class YutnoriRoom extends Room<YutnoriState> {
  onCreate() {
    this.setState(new YutnoriState());
    this.maxClients = 4;

    this.onMessage('chat', (client, message) => {
      this.broadcast('chat', {
        clientId: client.sessionId,
        message: `[윷놀이] ${message}`,
      });
    });

    this.onMessage('throw_yut', (client) => {
      if (
        client.sessionId !== this.state.currentTurnId ||
        this.state.gamePhase !== 'throwing'
      )
        return;

      const results = [
        { name: '도', steps: 1 },
        { name: '개', steps: 2 },
        { name: '걸', steps: 3 },
        { name: '윷', steps: 4 },
        { name: '모', steps: 5 },
        { name: '빽도', steps: -1 },
      ];
      const result = results[Math.floor(Math.random() * results.length)];

      this.state.lastThrowResult = result.name;
      this.state.lastThrowSteps = result.steps; // 이동할 칸 수 저장
      this.state.gamePhase = 'moving'; // 🔥 이제 '이동 대기' 상태로 변경!

      this.broadcast('chat', {
        clientId: 'System',
        message: `🎲 ${client.sessionId}님이 [${result.name}]를 던졌습니다! 이동할 말을 선택하세요.`,
      });
    });

    // 🎯 2. 선택한 말 이동하기 로직 (새로 추가!)
    this.onMessage('move_piece', (client, pieceIndex: number) => {
      if (
        client.sessionId !== this.state.currentTurnId ||
        this.state.gamePhase !== 'moving'
      )
        return;

      const player = this.state.players.get(client.sessionId);
      const pieceToMove = player.pieces[pieceIndex]; // 유저가 선택한 번호의 말!

      // 이미 완주한 말은 선택 불가
      if (!pieceToMove || pieceToMove.position === 99) return;

      let current = pieceToMove.position;
      const steps = this.state.lastThrowSteps;

      if (steps === -1) {
        current = PREV_MAP[current] ?? current;
      } else {
        for (let i = 0; i < steps; i++) {
          if (i === 0 && FAST_MAP[current] !== undefined) {
            current = FAST_MAP[current];
          } else {
            current = NEXT_MAP[current] ?? 99;
          }
          if (current === 99) break;
        }
      }
      pieceToMove.position = current;

      // 이동이 끝났으니 다시 '던지기' 상태로 바꾸고 턴 넘기기
      this.state.gamePhase = 'throwing';
      this.passTurn();
    });
  }

  onJoin(client: Client) {
    const player = new YutPlayer();
    player.sessionId = client.sessionId;
    player.teamColor = this.state.players.size % 2 === 0 ? 'red' : 'blue';

    // 4개의 말 생성
    for (let i = 0; i < 4; i++) {
      const piece = new YutPiece();
      piece.id = `${client.sessionId}-p${i}`;
      piece.position = 0;
      player.pieces.push(piece);
    }

    this.state.players.set(client.sessionId, player);

    if (this.state.players.size === 1) {
      this.state.currentTurnId = client.sessionId;
    }

    this.broadcast('chat', {
      clientId: 'System',
      message: `${client.sessionId} 님이 입장했습니다.`,
    });
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }

  passTurn() {
    const playerIds = Array.from(this.state.players.keys());
    const currentIndex = playerIds.indexOf(this.state.currentTurnId);
    this.state.currentTurnId = playerIds[(currentIndex + 1) % playerIds.length];
  }
}
