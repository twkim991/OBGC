import { Room, Client } from '@colyseus/core';
import { createRematchTable } from '../games/rematch';
import {
  readChatMessage,
  sendRoomError,
  SlidingWindowRateLimiter,
} from '../games/protocol';
import {
  MigrationSeatRegistry,
  isMigrationGroupReady,
  MIGRATION_ABORT_MS,
  MIGRATION_RETRY_MS,
  MIGRATION_SEAT_SECONDS,
  type MigrationParticipant,
} from '../games/migration';
import {
  canMoveYutPiece,
  isBackwardThrowNak,
  traceYutMove,
} from '../games/yutnori/domain/board';
import { getNextPlayerId } from '../games/yutnori/domain/engine';
import {
  getEmptyTitanNodes,
  hasFinishedAllPieces,
  resolveCaptures,
  resolveSkillActivation,
  resolveTitanCollision,
  resolveYutThrow,
  selectRandomNode,
} from '../games/yutnori/domain/effects';
import { drawSkills } from '../games/yutnori/domain/skills';
import { throwYut } from '../games/yutnori/domain/throw';
import { YUTNORI_GAME } from '../games/yutnori/metadata';
import {
  YUTNORI_MESSAGES,
  parseMovePiecePayload,
  parseSkillId,
} from '../games/yutnori/protocol';
import {
  YutnoriState,
  YutPiece,
  YutPlayer,
} from '../games/yutnori/schema';
import { logRoomError, logRoomEvent } from '../games/logging';

export class YutnoriRoom extends Room<YutnoriState> {
  private isReturning = false;
  private readonly chatLimiter = new SlidingWindowRateLimiter(5, 5000);
  private readonly playerIds = new Map<string, string>();
  private readonly skills = new Map<string, string[]>();
  private readonly clientProtocols = new Map<string, Record<string, number>>();
  private migrationSeats = new MigrationSeatRegistry();

  onCreate(options: any) {
    this.setState(new YutnoriState());
    this.setSeatReservationTime(MIGRATION_SEAT_SECONDS);
    this.migrationSeats = new MigrationSeatRegistry(options);
    this.maxClients = this.migrationSeats.total || YUTNORI_GAME.maxPlayers;
    this.clock.setTimeout(async () => {
      if (this.state.migrationReady) return;
      this.migrationSeats.expire();
      this.logRejectedRequest('MIGRATION_TIMEOUT', 'yutnori.migration_aborted');
      this.broadcast('migration_aborted', {
        message: '모든 참가자가 제한 시간 안에 게임방으로 이동하지 못했습니다.',
      });
      await this.disconnect();
    }, MIGRATION_ABORT_MS);

    this.onMessage(YUTNORI_MESSAGES.requestPrivateState, (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) this.syncPrivateSkills(player);
    });

    this.onMessage(YUTNORI_MESSAGES.startGame, (client) => {
      if (this.state.gamePhase !== 'waiting') return;

      const player = this.state.players.get(client.sessionId);
      if (!player?.isHost) return;

      if (this.state.players.size < YUTNORI_GAME.minPlayers) {
        client.send('chat', {
          clientId: 'System',
          message: `${YUTNORI_GAME.label}는 ${YUTNORI_GAME.minPlayers}명 이상 모여야 시작할 수 있습니다.`,
        });
        return;
      }

      this.state.currentTurnId = client.sessionId;
      this.state.gamePhase = 'throwing';
      this.broadcast('chat', {
        clientId: 'System',
        message: `${player.nickname} 방장이 윷놀이를 시작했습니다.`,
      });
    });

    this.onMessage('chat', (client, message) => {
      const normalized = readChatMessage(message);
      if (!normalized) {
        this.logRejectedRequest('INVALID_CHAT');
        sendRoomError(client, 'INVALID_CHAT', '채팅은 1~300자로 입력해주세요.');
        return;
      }
      if (!this.chatLimiter.allow(client.sessionId)) {
        this.logRejectedRequest('CHAT_RATE_LIMIT');
        sendRoomError(client, 'CHAT_RATE_LIMIT', '채팅을 너무 빠르게 보내고 있습니다.');
        return;
      }

      const player = this.state.players.get(client.sessionId);
      this.broadcast('chat', {
        clientId: player?.nickname ?? client.sessionId,
        message: `[윷놀이] ${normalized}`,
      });
    });

    // 🎯 1. 윷 던지기
    this.onMessage(YUTNORI_MESSAGES.throwYut, (client) => {
      if (
        client.sessionId !== this.state.currentTurnId ||
        this.state.gamePhase !== 'throwing'
      )
        return;

      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const activeSkill = player.activeSkill;
      const resolution = resolveYutThrow(throwYut(), activeSkill);
      const isNak = resolution.result.name === '낙';
      const backwardNak =
        resolution.throws.length > 0 &&
        resolution.throws.every((steps) =>
          isBackwardThrowNak(Array.from(player.pieces), steps),
        );
      if (!isNak && !backwardNak) {
        this.state.remainingThrows.push(...resolution.throws);
      }

      resolution.notices.forEach((notice) => {
        const messages = {
          mo_magnet: '🧲 [모 확정] 우주의 기운이 윷에 스며듭니다!',
          back_gear: '⏪ [백기어] 이번 윷은 무자비하게 뒤로 갑니다!',
          double_cast: '👯 [복제 술법] 스택이 2배로 쌓였습니다!',
        };
        this.broadcast('chat', { clientId: 'System', message: messages[notice] });
      });

      if (resolution.consumeSkill) {
        const skills = this.getSkills(player);
        const skillIndex = skills.indexOf(activeSkill);
        if (skillIndex !== -1) skills.splice(skillIndex, 1);
        player.activeSkill = '';
        player.usedSkillThisTurn = true;
        this.syncPrivateSkills(player);
      }

      let message = `🎲 ${player.nickname}님이 [${resolution.result.name}]를 던졌습니다!`;

      if (isNak || backwardNak) {
        this.state.remainingThrows.clear();
        this.state.gamePhase = 'throwing';
        message += backwardNak
          ? ' 움직일 수 있는 말이 없어 낙으로 처리됩니다.'
          : ' 윷가락이 판 밖으로 나가 낙으로 처리됩니다.';
        this.broadcast('chat', { clientId: 'System', message });
        this.passTurn();
        return;
      } else if (resolution.keepsThrowing) {
        message += ' 한 번 더 던지세요!! 🔥';
      } else {
        message += ' 이동할 말과 사용할 윷을 선택하세요.';
        this.state.gamePhase = 'moving';
      }

      this.broadcast('chat', { clientId: 'System', message });
    });

    // 🎯 2. 스택을 소비해서 말 이동하기 (스텔스 & 거인 판정 추가!)
    this.onMessage(YUTNORI_MESSAGES.movePiece, (client, payload: unknown) => {
      if (
        client.sessionId !== this.state.currentTurnId ||
        this.state.gamePhase !== 'moving'
      )
        return;

      const parsedPayload = parseMovePiecePayload(payload);
      if (!parsedPayload) {
        this.rejectRequest(client, 'INVALID_PAYLOAD', '말 이동 정보가 올바르지 않습니다.');
        return;
      }
      const { pieceIndex, throwIndex } = parsedPayload;

      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const targetPiece = player.pieces[pieceIndex];
      const steps = this.state.remainingThrows[throwIndex];

      if (!targetPiece || targetPiece.position === 99) {
        this.rejectRequest(client, 'INVALID_PIECE', '이동할 수 없는 말입니다.');
        return;
      }
      if (steps === undefined) {
        this.rejectRequest(client, 'INVALID_THROW', '사용할 수 없는 윷 결과입니다.');
        return;
      }
      if (!canMoveYutPiece(targetPiece.position, steps)) {
        this.rejectRequest(
          client,
          'INVALID_BACK_DO_MOVE',
          '스타트 위치의 말은 빽도로 움직일 수 없습니다.',
        );
        return;
      }

      const startPosition = targetPiece.position;
      const movingPieces =
        startPosition === 0
          ? [targetPiece]
          : player.pieces.filter((p) => p.position === startPosition);

      // 👻 [스텔스 버프 부여 및 스킬 소모]
      if (player.activeSkill === 'STEALTH_MODE') {
        movingPieces.forEach((p) => (p.isStealth = true));
        const skills = this.getSkills(player);
        const skillIndex = skills.indexOf('STEALTH_MODE');
        if (skillIndex !== -1) skills.splice(skillIndex, 1);
        player.activeSkill = '';
        player.usedSkillThisTurn = true;
        this.syncPrivateSkills(player);
        this.broadcast('chat', {
          clientId: 'System',
          message: `👻 [스텔스 모드] 가동! ${player.nickname}의 말이 투명해졌습니다!`,
        });
      }

      const collision = resolveTitanCollision(
        traceYutMove(startPosition, steps),
        Array.from(this.state.titans),
        movingPieces[0].isStealth,
      );

      for (let index = 0; index < collision.passedTitanCount; index++) {
        this.broadcast('chat', {
          clientId: 'System',
          message: `💨 스텔스 말이 거인의 다리 사이를 무사히 통과했습니다!`,
        });
      }

      if (collision.eaten) {
        this.state.titans.splice(collision.consumedTitanIndex, 1);
        this.broadcast('chat', {
          clientId: 'System',
          message: `🩸 콰직!! 무지성거인이 ${player.nickname}의 말을 잡아먹고 사라졌습니다!`,
        });
      }

      // 묶여있는 모든 말의 위치를 목적지로 일괄 이동 (먹혔으면 0번)
      const endPosition = collision.endPosition;
      movingPieces.forEach((p) => {
        p.position = endPosition;
        if (collision.eaten) p.isStealth = false;
      });

      // 🔥 [잡기 로직] 거인에게 안 먹히고 무사히 도착했을 때 적을 덮침
      let caughtOpponent = false;
      if (endPosition !== 0 && endPosition !== 99 && !collision.eaten) {
        const capture = resolveCaptures(
          Array.from(this.state.players.entries()).map(([sessionId, target]) => ({
            sessionId,
            pieces: Array.from(target.pieces),
          })),
          client.sessionId,
          endPosition,
        );

        capture.captured.forEach(({ sessionId, pieceIndex }) => {
          const capturedPiece = this.state.players.get(sessionId)?.pieces[pieceIndex];
          if (!capturedPiece) return;
          capturedPiece.position = 0;
          capturedPiece.isStealth = false;
        });
        caughtOpponent = capture.captured.length > 0;

        if (capture.stealthOverlapCount > 0) {
          this.broadcast('chat', {
            clientId: 'System',
            message: `👻 스텔스 상태인 적 말을 덮쳤지만 통과해 버렸습니다! (동거 시작)`,
          });
        }
      }

      this.state.remainingThrows.splice(throwIndex, 1);

      const hasWon = hasFinishedAllPieces(Array.from(player.pieces));
      if (hasWon) {
        this.state.winnerSessionId = client.sessionId;
        this.state.gamePhase = 'finished';
        this.broadcast('chat', {
          clientId: 'System',
          message: `🎉 게임 종료! ${player.nickname}님이 윷놀이를 제패했습니다!`,
        });
        return;
      }

      if (caughtOpponent) {
        this.broadcast('chat', {
          clientId: 'System',
          message: `⚔️ 피의 숙청! ${player.nickname}님이 상대방 말을 짓밟았습니다! 보너스 턴 획득!`,
        });
        this.state.gamePhase = 'throwing';
      } else if (this.state.remainingThrows.length === 0) {
        this.state.gamePhase = 'throwing';
        this.passTurn();
      }
    });

    // 🎯 3. 대기실 복귀 로직
    this.onMessage(YUTNORI_MESSAGES.returnToTable, async (client) => {
      if (this.isReturning) return;
      this.isReturning = true;

      try {
        const participants = this.clients.reduce<MigrationParticipant[]>(
          (result, participantClient) => {
            const player = this.state.players.get(participantClient.sessionId);
            if (player) {
              result.push({
                sourceSessionId: participantClient.sessionId,
                playerId:
                  this.playerIds.get(participantClient.sessionId) ??
                  participantClient.sessionId,
                nickname: player.nickname,
                isHost: player.isHost,
                protocolVersions:
                  this.clientProtocols.get(participantClient.sessionId) ?? {},
              });
            }
            return result;
          },
          [],
        );
        const migration = await createRematchTable(YUTNORI_GAME, participants);

        this.clients.forEach((participantClient) => {
          const reservation = migration.reservations.get(
            participantClient.sessionId,
          );
          if (!reservation) return;
          participantClient.send('move_room', {
            reservation,
            gameType: 'table',
          });
        });
        this.clock.setTimeout(() => {
          this.isReturning = false;
        }, MIGRATION_RETRY_MS);
      } catch (e) {
        logRoomError('yutnori.rematch_migration_failed', e, {
          roomId: this.roomId,
          gameId: YUTNORI_GAME.id,
        });
        this.isReturning = false;
      }
    });

    // 🎯 [초능력 발동(장전) 로직]
    this.onMessage(YUTNORI_MESSAGES.activateSkill, (client, requestedSkill: unknown) => {
      if (
        client.sessionId !== this.state.currentTurnId ||
        this.state.gamePhase !== 'throwing'
      )
        return;

      const skillId = parseSkillId(requestedSkill);
      const player = this.state.players.get(client.sessionId);
      if (!skillId || !player) {
        this.rejectRequest(client, 'INVALID_PAYLOAD', '스킬 정보가 올바르지 않습니다.');
        return;
      }

      const skills = this.getSkills(player);
      const activation = resolveSkillActivation({
        skillId,
        availableSkills: skills,
        activeSkill: player.activeSkill,
        usedSkillThisTurn: player.usedSkillThisTurn,
      });

      if (activation.kind === 'already_used') {
        return this.broadcast('chat', {
          clientId: 'System',
          message: `❌ 이번 턴에는 이미 초능력을 사용했습니다!`,
        });
      }

      if (activation.kind === 'cancel') {
        player.activeSkill = '';
        return this.broadcast('chat', {
          clientId: 'System',
          message: `🛡️ ${player.nickname}님이 스킬 장전을 취소했습니다.`,
        });
      }

      if (activation.kind === 'missing') {
        this.rejectRequest(client, 'SKILL_NOT_OWNED', '보유하지 않은 스킬입니다.');
        return;
      }

      player.activeSkill = skillId;

        // 💥 [대지진] 즉발형
        if (activation.kind === 'earthquake') {
          skills.splice(activation.skillIndex, 1);
          player.activeSkill = '';
          player.usedSkillThisTurn = true;
          this.syncPrivateSkills(player);

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
        else if (activation.kind === 'titan_drop') {
          skills.splice(activation.skillIndex, 1);
          player.activeSkill = '';
          player.usedSkillThisTurn = true;
          this.syncPrivateSkills(player);

          const occupiedNodes: number[] = [];
          this.state.players.forEach((p) => {
            p.pieces.forEach((piece) => occupiedNodes.push(piece.position));
          });
          const emptyNodes = getEmptyTitanNodes(
            occupiedNodes,
            Array.from(this.state.titans),
          );

          const randomNode = selectRandomNode(emptyNodes);
          if (randomNode !== null) {
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
          let msg = `⚡ ${player.nickname}님이 [${skillId}] 스킬을 장전했습니다! (다시 누르면 취소)`;
          if (skillId === 'STEALTH_MODE') {
            msg = `👻 ${player.nickname}님이 [스텔스 모드]를 장전했습니다! 이번 턴에 움직이는 말은 투명해집니다.`;
          }
          this.broadcast('chat', { clientId: 'System', message: msg });
        }
    });
  }

  onAuth(client: Client, options: unknown) {
    const authorized =
      this.migrationSeats.total > 0 &&
      !this.migrationSeats.isComplete &&
      this.migrationSeats.authorize(options);
    if (!authorized) this.logRejectedRequest('INVALID_MIGRATION_SEAT');
    return authorized;
  }

  onJoin(client: Client, options: any) {
    if (this.state.gamePhase !== 'waiting') {
      client.leave();
      return;
    }

    const migrationSeat = this.migrationSeats.claim(options);
    if (!migrationSeat) {
      this.logRejectedRequest('MIGRATION_SEAT_ALREADY_USED');
      client.leave();
      return;
    }

    const player = new YutPlayer();
    player.sessionId = client.sessionId;
    this.playerIds.set(client.sessionId, migrationSeat.playerId);
    player.nickname = migrationSeat.nickname;
    player.isHost = migrationSeat.isHost;
    this.clientProtocols.set(client.sessionId, migrationSeat.protocolVersions);

    if (player.isHost) {
      this.state.players.forEach((existingPlayer) => (existingPlayer.isHost = false));
      this.state.hostSessionId = client.sessionId;
    }

    player.teamColor = this.state.players.size % 2 === 0 ? 'red' : 'blue';

    for (let i = 0; i < 4; i++) {
      const piece = new YutPiece();
      piece.id = `${client.sessionId}-p${i}`;
      piece.position = 0;
      player.pieces.push(piece);
    }

    this.skills.set(client.sessionId, drawSkills(2));

    this.state.players.set(client.sessionId, player);
    this.syncPrivateSkills(player);

    this.finalizeMigrationIfReady();

    this.broadcast('chat', {
      clientId: 'System',
      message: `${player.nickname} 님이 입장했습니다.`,
    });
  }

  async onLeave(client: Client, consented: boolean) {
    if (!consented) {
      try {
        await this.allowReconnection(client, 20);
        const reconnectedPlayer = this.state.players.get(client.sessionId);
        if (reconnectedPlayer) this.syncPrivateSkills(reconnectedPlayer);
        this.finalizeMigrationIfReady();
        return;
      } catch {
        // 재연결 제한 시간이 지나면 아래의 일반 퇴장 처리를 수행한다.
      }
    }

    this.chatLimiter.clear(client.sessionId);
    this.clientProtocols.delete(client.sessionId);
    this.playerIds.delete(client.sessionId);
    const leavingPlayer = this.state.players.get(client.sessionId);
    const wasHost = leavingPlayer?.isHost ?? false;
    this.state.players.delete(client.sessionId);
    this.skills.delete(client.sessionId);

    if (wasHost) this.transferHost();

    if (
      this.state.gamePhase !== 'waiting' &&
      this.state.gamePhase !== 'finished' &&
      client.sessionId === this.state.currentTurnId
    ) {
      this.passTurn();
    }
  }

  passTurn() {
    const playerIds = Array.from(this.state.players.keys());
    this.state.currentTurnId = getNextPlayerId(
      playerIds,
      this.state.currentTurnId,
    );

    this.state.players.forEach((p) => {
      p.usedSkillThisTurn = false;
      p.activeSkill = '';
    });
  }

  private transferHost() {
    this.state.players.forEach((player) => (player.isHost = false));
    const nextHost = Array.from(this.state.players.values())[0];

    if (!nextHost) {
      this.state.hostSessionId = '';
      return;
    }

    nextHost.isHost = true;
    this.state.hostSessionId = nextHost.sessionId;
    this.broadcast('chat', {
      clientId: 'System',
      message: `${nextHost.nickname} 님이 새 방장이 되었습니다.`,
    });
  }

  private finalizeMigrationIfReady() {
    if (
      this.state.migrationReady ||
      !isMigrationGroupReady(this.migrationSeats, this.clients.length)
    ) {
      return;
    }

    this.state.migrationReady = true;
    this.broadcast('migration_ready');
  }

  private logRejectedRequest(code: string, event = 'yutnori.request_rejected') {
    logRoomEvent('warn', event, {
      roomId: this.roomId,
      gameId: YUTNORI_GAME.id,
      code,
    });
  }

  private rejectRequest(client: Client, code: string, message: string) {
    this.logRejectedRequest(code);
    sendRoomError(client, code, message);
  }

  private getSkills(player: YutPlayer): string[] {
    return this.skills.get(player.sessionId) ?? [];
  }

  private syncPrivateSkills(player: YutPlayer) {
    const skills = this.getSkills(player);
    player.skillCount = skills.length;

    const client = this.clients.find(
      (candidate) => candidate.sessionId === player.sessionId,
    );
    if (client) {
      client.send(YUTNORI_MESSAGES.privateSkills, { skills: [...skills] });
    }
  }
}
