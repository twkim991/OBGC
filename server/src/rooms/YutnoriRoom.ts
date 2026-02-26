import { Room, Client, matchMaker } from 'colyseus';
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

  @type(['string']) skills = new ArraySchema<string>();
  @type('string') activeSkill: string = '';
  @type('boolean') usedSkillThisTurn: boolean = false; // 🔥 추가: 이번 턴에 스킬을 썼는지 추적
}
export class YutnoriState extends Schema {
  @type({ map: YutPlayer }) players = new MapSchema<YutPlayer>();
  @type('string') currentTurnId: string = '';
  @type(['number']) remainingThrows = new ArraySchema<number>();
  @type('string') gamePhase: string = 'throwing'; // throwing, moving, finished
  @type('string') winnerSessionId: string = ''; // 🔥 승리자 ID 저장용 변수 추가!
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
  19: 99,
  // 지름길 대각선
  20: 21,
  21: 22,
  23: 24,
  24: 15, // 🔥 누락됐던 23, 24번 직진 경로 추가!
  25: 26,
  26: 22,
  22: 27,
  27: 28,
  28: 99,
};

const FAST_MAP: Record<number, number> = { 5: 20, 10: 25, 22: 27 };

const PREV_MAP: Record<number, number> = {
  // 🔥 증발했던 외곽 한 바퀴 빽도 경로 완벽 복구
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

  // 특수 빽도 (대기실에서 빽도 치면 도착점 바로 앞인 19번으로 점프!)
  0: 19,

  // 대각선 지름길 빽도 경로
  20: 5,
  21: 20,
  25: 10,
  26: 25,
  22: 21,
  27: 22,
  28: 27,
  23: 22,
  24: 23,
};
export class YutnoriRoom extends Room<YutnoriState> {
  private isReturning = false; // 🔥 여러 명이 동시에 버튼을 눌러서 방이 여러 개 파지는 걸 막는 자물쇠!
  onCreate() {
    this.setState(new YutnoriState());
    this.maxClients = 4;

    this.onMessage('chat', (client, message) => {
      this.broadcast('chat', {
        clientId: client.sessionId,
        message: `[윷놀이] ${message}`,
      });
    });

    // 🎯 1. 윷 던지기 (윷, 모 나오면 무한 스택 적립!)
    this.onMessage('throw_yut', (client) => {
      if (
        client.sessionId !== this.state.currentTurnId ||
        this.state.gamePhase !== 'throwing'
      )
        return;

      // 총합 1000(100.0%) 기준의 가중치 배열 세팅
      const throwOptions = [
        { name: '개', steps: 2, weight: 345 }, // 34.5%
        { name: '걸', steps: 3, weight: 345 }, // 34.5%
        { name: '윷', steps: 4, weight: 130 }, // 13.0%
        { name: '도', steps: 1, weight: 115 }, // 11.5%
        { name: '빽도', steps: -1, weight: 38 }, // 3.8%
        { name: '모', steps: 5, weight: 27 }, // 2.7%
      ];

      // 0 ~ 999 사이의 랜덤 난수 생성
      let randomValue = Math.floor(Math.random() * 1000);
      let result = throwOptions[0];

      // 가중치 구간 체크 알고리즘
      for (const option of throwOptions) {
        if (randomValue < option.weight) {
          result = option;
          break;
        }
        randomValue -= option.weight; // 해당 구간이 아니면 가중치만큼 빼고 다음으로 패스
      }

      const player = this.state.players.get(client.sessionId);

      // 🔥 [초능력 실질적 적용 및 카드 소모]
      if (player.activeSkill) {
        const skillIndex = player.skills.indexOf(player.activeSkill);

        if (player.activeSkill === 'MO_MAGNET') {
          result = { name: '모', steps: 5, weight: 0 };
          this.broadcast('chat', {
            clientId: 'System',
            message: `🧲 [모 확정] 우주의 기운이 윷에 스며듭니다!`,
          });
        }

        let finalSteps = result.steps;
        if (player.activeSkill === 'BACK_GEAR') {
          finalSteps =
            result.steps > 0 ? -result.steps : Math.abs(result.steps);
          this.broadcast('chat', {
            clientId: 'System',
            message: `⏪ [백기어] 이번 윷은 무자비하게 뒤로 갑니다!`,
          });
        }

        // 스택 적립
        this.state.remainingThrows.push(finalSteps);

        if (player.activeSkill === 'DOUBLE_CAST') {
          this.state.remainingThrows.push(finalSteps);
          this.broadcast('chat', {
            clientId: 'System',
            message: `👯 [복제 술법] 스택이 2배로 쌓였습니다!`,
          });
        }

        // 🔥 효과가 적용된 '이 시점'에 진짜로 인벤토리에서 삭제!
        if (skillIndex !== -1) player.skills.splice(skillIndex, 1);
        player.activeSkill = '';
        player.usedSkillThisTurn = true; // 이번 턴 스킬 사용 끝!
      } else {
        // 스킬 안 썼으면 그냥 평범하게 스택 적립
        this.state.remainingThrows.push(result.steps);
      }

      let message = `🎲 ${client.sessionId}님이 [${result.name}]를 던졌습니다!`;

      // 🔥 윷(4)이나 모(5)가 나오면 페이즈 유지(한 번 더 던지기)!
      if (result.steps === 4 || result.steps === 5) {
        message += ' 한 번 더 던지세요!! 🔥';
      } else {
        message += ' 이동할 말과 사용할 윷을 선택하세요.';
        this.state.gamePhase = 'moving'; // 도, 개, 걸, 빽도면 던지기 끝!
      }

      this.broadcast('chat', { clientId: 'System', message });
    });

    // 🎯 2. 스택을 소비해서 말 이동하기 (업기 & 잡기 추가)
    this.onMessage('move_piece', (client, payload) => {
      if (
        client.sessionId !== this.state.currentTurnId ||
        this.state.gamePhase !== 'moving'
      )
        return;

      const { pieceIndex, throwIndex } = payload;

      const player = this.state.players.get(client.sessionId);
      const targetPiece = player.pieces[pieceIndex];
      const steps = this.state.remainingThrows[throwIndex];

      if (!targetPiece || targetPiece.position === 99 || steps === undefined)
        return;

      const startPosition = targetPiece.position;

      // 🔥 [업기 로직] 대기실(0번)이 아닌 필드 위에서 출발한다면, 같은 칸에 있는 내 말들을 싹 다 묶어서 연행한다!
      const movingPieces =
        startPosition === 0
          ? [targetPiece]
          : player.pieces.filter((p) => p.position === startPosition);
      // 목적지 계산 (묶인 말들은 목적지가 같으므로 한 번만 계산)
      // 🔥 목적지 계산 로직 업데이트
      let current = startPosition;
      let prev = startPosition; // 내가 어디서 왔는지 추적하는 변수 추가!

      if (steps < 0) {
        // 🔥 초능력 빽스텝 루프! (-3이면 3번 뒤로 감)
        for (let i = 0; i < Math.abs(steps); i++) {
          current = PREV_MAP[current] ?? current;
          if (current === 0) break; // 대기실보다 더 뒤로는 못 감
        }
      } else {
        for (let i = 0; i < steps; i++) {
          let nextNode;

          if (i === 0 && FAST_MAP[current] !== undefined) {
            nextNode = FAST_MAP[current];
          } else if (current === 22 && prev === 21) {
            // 🔥 핵심: 21번을 거쳐 정중앙(22번)으로 들어와서 계속 전진하는 경우!
            // 꺾지 않고 23번을 향해 무조건 직진하도록 강제
            nextNode = 23;
          } else {
            nextNode = NEXT_MAP[current] ?? 99;
          }

          prev = current; // 다음 루프를 위해 현재 위치를 과거로 저장
          current = nextNode; // 한 칸 전진!
          if (current === 99) break;
        }
      }
      const endPosition = current;

      // 묶여있는 모든 말의 위치를 목적지로 일괄 이동!
      movingPieces.forEach((p) => (p.position = endPosition));

      // 🔥 [잡기 로직] 목적지에 도착했는데 (완주 제외), 거기에 불쌍한 상대방 말이 있다면?
      let caughtOpponent = false;
      if (endPosition !== 0 && endPosition !== 99) {
        this.state.players.forEach((otherPlayer, otherSessionId) => {
          if (otherSessionId !== client.sessionId) {
            // 적군 확인!
            otherPlayer.pieces.forEach((opponentPiece) => {
              if (opponentPiece.position === endPosition) {
                // 상대방 말의 모가지를 비틀어서 대기실(0번)로 강제 송환!
                opponentPiece.position = 0;
                caughtOpponent = true;
              }
            });
          }
        });
      }

      // 사용한 윷 스택 소모
      this.state.remainingThrows.splice(throwIndex, 1);

      // 🔥 [승리 조건 체크] 내 말 4개가 모두 99번(완주)인지 확인!
      const hasWon = player.pieces.every((p) => p.position === 99);

      if (hasWon) {
        // 게임 끝! 승자 기록하고 페이즈를 finished로 변경
        this.state.winnerSessionId = client.sessionId;
        this.state.gamePhase = 'finished';
        this.broadcast('chat', {
          clientId: 'System',
          message: `🎉 게임 종료! ${client.sessionId}님이 윷놀이를 제패했습니다!`,
        });
        return; // 더 이상 턴을 넘기지 않고 여기서 함수 완전 종료
      }

      // 🔥 턴 판정: 잡았으면 피의 보너스 턴! 아니면 스택 체크 후 턴 넘기기
      if (caughtOpponent) {
        this.broadcast('chat', {
          clientId: 'System',
          message: `⚔️ 피의 숙청! ${client.sessionId}님이 상대방 말을 짓밟았습니다! 보너스 턴 획득!`,
        });
        this.state.gamePhase = 'throwing'; // 스택이 남아있어도 다시 던질 수 있는 권리 부여!
      } else if (this.state.remainingThrows.length === 0) {
        this.state.gamePhase = 'throwing';
        this.passTurn();
      }
    });

    // 🎯 3. 대기실 복귀 로직 추가!
    this.onMessage('return_to_table', async (client) => {
      // 게임이 끝난 상태가 아니거나, 이미 누군가 복귀 버튼을 눌러서 이동 중이면 무시
      if (this.state.gamePhase !== 'finished' || this.isReturning) return;
      this.isReturning = true; // 자물쇠 잠금!

      try {
        // 백그라운드에서 새로운 대기실(TableRoom) 생성
        const newTable = await matchMaker.createRoom('table_room', {
          roomName: '🔥 피 튀기는 리벤지 매치!', // 간판 이름 갱신
        });

        // 이 윷놀이 방에 남아있는 모든 유저에게 새 대기실 좌표를 쏘고 강제 이주!
        this.broadcast('move_room', {
          roomId: newTable.roomId,
          gameType: 'table', // 화면을 게임이 아닌 '대기실'로 바꾸라는 신호
        });
      } catch (e) {
        console.error('대기실 복귀 실패:', e);
        this.isReturning = false;
      }
    });

    // 🎯 [초능력 발동(장전) 로직]
    this.onMessage('activate_skill', (client, skillId: string) => {
      if (
        client.sessionId !== this.state.currentTurnId ||
        this.state.gamePhase !== 'throwing'
      )
        return;

      const player = this.state.players.get(client.sessionId);

      // 🔥 1. 턴당 1회 제한 방어 로직 (윷/모 나와서 한 번 더 던질 때 연속 사용 차단)
      if (player.usedSkillThisTurn) {
        return this.broadcast('chat', {
          clientId: 'System',
          message: `❌ 이번 턴에는 이미 초능력을 사용했습니다!`,
        });
      }

      // 🔥 2. 토글(취소) 기능: 이미 장전된 걸 또 누르면 장전 해제!
      if (player.activeSkill === skillId) {
        player.activeSkill = '';
        return this.broadcast('chat', {
          clientId: 'System',
          message: `🛡️ ${client.sessionId}님이 스킬 장전을 취소했습니다.`,
        });
      }

      const skillIndex = player.skills.indexOf(skillId);

      if (skillIndex !== -1) {
        // 🔥 3. 카드 소모(splice)는 아직 안 함! 장전만 덮어씌우기
        player.activeSkill = skillId;

        // 💥 대지진은 즉발이므로 여기서 바로 적용하고 소모까지 처리!
        if (skillId === 'EARTHQUAKE') {
          player.skills.splice(skillIndex, 1); // 이제서야 소모
          player.activeSkill = '';
          player.usedSkillThisTurn = true; // 스킬 사용 권한 박탈

          this.state.players.forEach((p) => {
            p.pieces.forEach((piece) => {
              if (piece.position !== 99) piece.position = 0;
            });
          });
          this.broadcast('chat', {
            clientId: 'System',
            message: `💥 [대지진] 발동!! 보드판 위의 모든 말이 대기실로 쳐박혔습니다!`,
          });
        } else {
          this.broadcast('chat', {
            clientId: 'System',
            message: `⚡ ${client.sessionId}님이 [${skillId}] 스킬을 장전했습니다! (다시 누르면 취소)`,
          });
        }
      }
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

    // 🔥 초능력 랜덤 2개 뽑기 로직
    const ALL_SKILLS = ['MO_MAGNET', 'DOUBLE_CAST', 'BACK_GEAR', 'EARTHQUAKE'];
    const shuffled = ALL_SKILLS.sort(() => 0.5 - Math.random());
    player.skills.push(shuffled[0], shuffled[1]);

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

    // 🔥 다음 턴으로 넘어가므로 상태 완전 초기화!
    this.state.players.forEach((p) => {
      p.usedSkillThisTurn = false; // 스킬 사용 제한 해제
      p.activeSkill = ''; // 혹시 장전만 해놓고 턴 넘긴 멍청한(?) 상태 방지
    });
  }
}
