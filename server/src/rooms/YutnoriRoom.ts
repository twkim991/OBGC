import { Room, Client, matchMaker } from 'colyseus';
import { Schema, MapSchema, ArraySchema, type } from '@colyseus/schema';

// --- 스키마 정의 ---
export class YutPiece extends Schema {
  @type('string') id: string;
  @type('number') position: number;
  @type('boolean') isStealth: boolean = false; // 🔥 스텔스 유무
}
export class YutPlayer extends Schema {
  @type('string') sessionId: string;
  @type('string') teamColor: string;
  @type([YutPiece]) pieces = new ArraySchema<YutPiece>();

  @type(['string']) skills = new ArraySchema<string>();
  @type('string') activeSkill: string = '';
  @type('boolean') usedSkillThisTurn: boolean = false; // 이번 턴에 스킬을 썼는지 추적
}
export class YutnoriState extends Schema {
  @type({ map: YutPlayer }) players = new MapSchema<YutPlayer>();
  @type('string') currentTurnId: string = '';
  @type(['number']) remainingThrows = new ArraySchema<number>();
  @type('string') gamePhase: string = 'throwing'; // throwing, moving, finished
  @type('string') winnerSessionId: string = ''; // 승리자 ID 저장용 변수
  @type(['number']) titans = new ArraySchema<number>(); // 🔥 거인 위치 배열
}

// --- 🎯 윷놀이 길찾기 맵 (핵심 알고리즘) ---
const NEXT_MAP: Record<number, number> = {
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
  20: 21,
  21: 22,
  23: 24,
  24: 15,
  25: 26,
  26: 22,
  22: 27,
  27: 28,
  28: 99,
};

const FAST_MAP: Record<number, number> = { 5: 20, 10: 25, 22: 27 };

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
  0: 19,
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
  private isReturning = false;

  onCreate() {
    this.setState(new YutnoriState());
    this.maxClients = 4;

    this.onMessage('chat', (client, message) => {
      this.broadcast('chat', {
        clientId: client.sessionId,
        message: `[윷놀이] ${message}`,
      });
    });

    // 🎯 1. 윷 던지기
    this.onMessage('throw_yut', (client) => {
      if (
        client.sessionId !== this.state.currentTurnId ||
        this.state.gamePhase !== 'throwing'
      )
        return;

      const throwOptions = [
        { name: '개', steps: 2, weight: 345 },
        { name: '걸', steps: 3, weight: 345 },
        { name: '윷', steps: 4, weight: 130 },
        { name: '도', steps: 1, weight: 115 },
        { name: '빽도', steps: -1, weight: 38 },
        { name: '모', steps: 5, weight: 27 },
      ];

      let randomValue = Math.floor(Math.random() * 1000);
      let result = throwOptions[0];

      for (const option of throwOptions) {
        if (randomValue < option.weight) {
          result = option;
          break;
        }
        randomValue -= option.weight;
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

        this.state.remainingThrows.push(finalSteps);

        if (player.activeSkill === 'DOUBLE_CAST') {
          this.state.remainingThrows.push(finalSteps);
          this.broadcast('chat', {
            clientId: 'System',
            message: `👯 [복제 술법] 스택이 2배로 쌓였습니다!`,
          });
        }

        // 🔥 스텔스 모드는 말을 움직일 때 소모되므로 여기서 지우면 안 됨!
        if (player.activeSkill !== 'STEALTH_MODE') {
          if (skillIndex !== -1) player.skills.splice(skillIndex, 1);
          player.activeSkill = '';
          player.usedSkillThisTurn = true;
        }
      } else {
        this.state.remainingThrows.push(result.steps);
      }

      let message = `🎲 ${client.sessionId}님이 [${result.name}]를 던졌습니다!`;

      if (result.steps === 4 || result.steps === 5) {
        message += ' 한 번 더 던지세요!! 🔥';
      } else {
        message += ' 이동할 말과 사용할 윷을 선택하세요.';
        this.state.gamePhase = 'moving';
      }

      this.broadcast('chat', { clientId: 'System', message });
    });

    // 🎯 2. 스택을 소비해서 말 이동하기 (스텔스 & 거인 판정 추가!)
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
      const movingPieces =
        startPosition === 0
          ? [targetPiece]
          : player.pieces.filter((p) => p.position === startPosition);

      let current = startPosition;
      let prev = startPosition;
      let eatenByTitan = false; // 🔥 거인에게 먹혔는지 체크

      // 👻 [스텔스 버프 부여 및 스킬 소모]
      if (player.activeSkill === 'STEALTH_MODE') {
        movingPieces.forEach((p) => (p.isStealth = true));
        const skillIndex = player.skills.indexOf('STEALTH_MODE');
        if (skillIndex !== -1) player.skills.splice(skillIndex, 1);
        player.activeSkill = '';
        player.usedSkillThisTurn = true;
        this.broadcast('chat', {
          clientId: 'System',
          message: `👻 [스텔스 모드] 가동! ${client.sessionId}의 말이 투명해졌습니다!`,
        });
      }

      // 💥 [이동 루프 및 거인 충돌 체크]
      if (steps < 0) {
        for (let i = 0; i < Math.abs(steps); i++) {
          current = PREV_MAP[current] ?? current;
          if (current === 0) break;

          // 거인 포식 체크
          const titanIndex = this.state.titans.indexOf(current);
          if (titanIndex !== -1) {
            if (movingPieces[0].isStealth) {
              this.broadcast('chat', {
                clientId: 'System',
                message: `💨 스텔스 말이 거인의 다리 사이를 무사히 통과했습니다!`,
              });
            } else {
              eatenByTitan = true;
              this.state.titans.splice(titanIndex, 1); // 밥 먹은 거인은 퇴근
              this.broadcast('chat', {
                clientId: 'System',
                message: `🩸 콰직!! 무지성거인이 ${client.sessionId}의 말을 잡아먹고 사라졌습니다!`,
              });
              break; // 강제 종료
            }
          }
        }
      } else {
        for (let i = 0; i < steps; i++) {
          let nextNode;
          if (i === 0 && FAST_MAP[current] !== undefined) {
            nextNode = FAST_MAP[current];
          } else if (current === 22 && prev === 21) {
            nextNode = 23;
          } else {
            nextNode = NEXT_MAP[current] ?? 99;
          }

          prev = current;
          current = nextNode;
          if (current === 99) break;

          // 거인 포식 체크
          const titanIndex = this.state.titans.indexOf(current);
          if (titanIndex !== -1) {
            if (movingPieces[0].isStealth) {
              this.broadcast('chat', {
                clientId: 'System',
                message: `💨 스텔스 말이 거인의 다리 사이를 무사히 통과했습니다!`,
              });
            } else {
              eatenByTitan = true;
              this.state.titans.splice(titanIndex, 1);
              this.broadcast('chat', {
                clientId: 'System',
                message: `🩸 콰직!! 무지성거인이 ${client.sessionId}의 말을 잡아먹고 사라졌습니다!`,
              });
              break;
            }
          }
        }
      }

      // 묶여있는 모든 말의 위치를 목적지로 일괄 이동 (먹혔으면 0번)
      const endPosition = eatenByTitan ? 0 : current;
      movingPieces.forEach((p) => {
        p.position = endPosition;
        if (eatenByTitan) p.isStealth = false; // 먹히면 스텔스 풀림
      });

      // 🔥 [잡기 로직] 거인에게 안 먹히고 무사히 도착했을 때 적을 덮침
      let caughtOpponent = false;
      if (endPosition !== 0 && endPosition !== 99 && !eatenByTitan) {
        this.state.players.forEach((otherPlayer, otherSessionId) => {
          if (otherSessionId !== client.sessionId) {
            otherPlayer.pieces.forEach((opponentPiece) => {
              if (opponentPiece.position === endPosition) {
                // 👻 적군이 스텔스면 잡지 못함!
                if (opponentPiece.isStealth) {
                  this.broadcast('chat', {
                    clientId: 'System',
                    message: `👻 스텔스 상태인 적 말을 덮쳤지만 통과해 버렸습니다! (동거 시작)`,
                  });
                } else {
                  opponentPiece.position = 0;
                  opponentPiece.isStealth = false; // 죽으면 스텔스 해제
                  caughtOpponent = true;
                }
              }
            });
          }
        });
      }

      this.state.remainingThrows.splice(throwIndex, 1);

      const hasWon = player.pieces.every((p) => p.position === 99);
      if (hasWon) {
        this.state.winnerSessionId = client.sessionId;
        this.state.gamePhase = 'finished';
        this.broadcast('chat', {
          clientId: 'System',
          message: `🎉 게임 종료! ${client.sessionId}님이 윷놀이를 제패했습니다!`,
        });
        return;
      }

      if (caughtOpponent) {
        this.broadcast('chat', {
          clientId: 'System',
          message: `⚔️ 피의 숙청! ${client.sessionId}님이 상대방 말을 짓밟았습니다! 보너스 턴 획득!`,
        });
        this.state.gamePhase = 'throwing';
      } else if (this.state.remainingThrows.length === 0) {
        this.state.gamePhase = 'throwing';
        this.passTurn();
      }
    });

    // 🎯 3. 대기실 복귀 로직
    this.onMessage('return_to_table', async (client) => {
      if (this.state.gamePhase !== 'finished' || this.isReturning) return;
      this.isReturning = true;

      try {
        const newTable = await matchMaker.createRoom('table_room', {
          roomName: '🔥 피 튀기는 리벤지 매치!',
        });

        this.broadcast('move_room', {
          roomId: newTable.roomId,
          gameType: 'table',
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

      if (player.usedSkillThisTurn) {
        return this.broadcast('chat', {
          clientId: 'System',
          message: `❌ 이번 턴에는 이미 초능력을 사용했습니다!`,
        });
      }

      if (player.activeSkill === skillId) {
        player.activeSkill = '';
        return this.broadcast('chat', {
          clientId: 'System',
          message: `🛡️ ${client.sessionId}님이 스킬 장전을 취소했습니다.`,
        });
      }

      const skillIndex = player.skills.indexOf(skillId);

      if (skillIndex !== -1) {
        player.activeSkill = skillId;

        // 💥 [대지진] 즉발형
        if (skillId === 'EARTHQUAKE') {
          player.skills.splice(skillIndex, 1);
          player.activeSkill = '';
          player.usedSkillThisTurn = true;

          this.state.players.forEach((p) => {
            p.pieces.forEach((piece) => {
              if (piece.position !== 99) piece.position = 0;
            });
          });
          this.broadcast('chat', {
            clientId: 'System',
            message: `💥 [대지진] 발동!! 보드판 위의 모든 말이 대기실로 쳐박혔습니다!`,
          });
        }
        // 👣 [무지성거인 투하] 즉발형
        else if (skillId === 'TITAN_DROP') {
          player.skills.splice(skillIndex, 1);
          player.activeSkill = '';
          player.usedSkillThisTurn = true;

          // 보드판 빈 칸 찾기
          const occupiedNodes = new Set();
          this.state.players.forEach((p) => {
            p.pieces.forEach((piece) => occupiedNodes.add(piece.position));
          });
          const emptyNodes = [];
          for (let i = 1; i <= 28; i++) {
            if (!occupiedNodes.has(i) && !this.state.titans.includes(i)) {
              emptyNodes.push(i);
            }
          }

          if (emptyNodes.length > 0) {
            const randomNode =
              emptyNodes[Math.floor(Math.random() * emptyNodes.length)];
            this.state.titans.push(randomNode);
            this.broadcast('chat', {
              clientId: 'System',
              message: `👣 쿵! [무지성거인 투하]!! ${randomNode}번 칸에 거인이 나타났습니다!!`,
            });
          } else {
            this.broadcast('chat', {
              clientId: 'System',
              message: `👣 빈 칸이 없어 거인 투하에 실패했습니다... (스킬만 소모됨)`,
            });
          }
        }
        // 👻 [스텔스] & 일반 장전형
        else {
          let msg = `⚡ ${client.sessionId}님이 [${skillId}] 스킬을 장전했습니다! (다시 누르면 취소)`;
          if (skillId === 'STEALTH_MODE') {
            msg = `👻 ${client.sessionId}님이 [스텔스 모드]를 장전했습니다! 이번 턴에 움직이는 말은 투명해집니다.`;
          }
          this.broadcast('chat', { clientId: 'System', message: msg });
        }
      }
    });
  }

  onJoin(client: Client) {
    const player = new YutPlayer();
    player.sessionId = client.sessionId;
    player.teamColor = this.state.players.size % 2 === 0 ? 'red' : 'blue';

    for (let i = 0; i < 4; i++) {
      const piece = new YutPiece();
      piece.id = `${client.sessionId}-p${i}`;
      piece.position = 0;
      player.pieces.push(piece);
    }

    const ALL_SKILLS = [
      'MO_MAGNET',
      'DOUBLE_CAST',
      'BACK_GEAR',
      'EARTHQUAKE',
      'TITAN_DROP',
      'STEALTH_MODE',
    ];
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

    this.state.players.forEach((p) => {
      p.usedSkillThisTurn = false;
      p.activeSkill = '';
    });
  }
}
