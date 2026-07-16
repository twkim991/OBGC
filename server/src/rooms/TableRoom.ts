import { Room, Client, matchMaker } from 'colyseus';
import { Schema, MapSchema, type } from '@colyseus/schema';

type GameType = 'yutnori' | 'onecard';

// 1. 플레이어 상태 정의
export class Player extends Schema {
  @type('string') sessionId: string = '';
  @type('string') playerId: string = '';
  @type('string') nickname: string = '';
  @type('boolean') isHost: boolean = false;
}

// 2. 방 전체 상태 정의
export class TableState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type('string') hostId: string = '';
  @type('string') roomName: string = '';
  @type('string') gameType: GameType = 'yutnori';
}

// 3. 테이블 룸(대기실) 클래스
export class TableRoom extends Room<TableState> {
  private isStarting = false;
  private isChangingGame = false;

  async onCreate(options: any) {
    this.setState(new TableState());

    // 유저가 입력한 방 제목
    const title = this.readIdentity(options?.roomName, '즐거운 보드게임 한 판');
    const gameType = this.readGameType(options?.gameType);
    if (!gameType) throw new Error('지원하지 않는 게임입니다.');

    this.state.roomName = title;
    this.state.gameType = gameType;

    // 로비 목록에 방 제목과 선택 게임을 함께 노출합니다.
    await this.setMetadata({ roomName: title, gameType });

    this.maxClients = 4;

    this.onMessage('chat', (client, message) => {
      const player = this.state.players.get(client.sessionId);
      this.broadcast('chat', {
        clientId: player?.nickname || client.sessionId,
        message,
      });
    });

    this.onMessage('change_game', async (client, requestedGame) => {
      if (client.sessionId !== this.state.hostId || this.isStarting || this.isChangingGame) return;

      const nextGame = this.readGameType(requestedGame);
      if (!nextGame || nextGame === this.state.gameType) return;

      this.isChangingGame = true;

      try {
        await this.setMetadata({ roomName: this.state.roomName, gameType: nextGame });
        this.state.gameType = nextGame;

        this.broadcast('chat', {
          clientId: 'System',
          message: `방장이 게임을 ${this.gameLabel(nextGame)}로 변경했습니다.`,
        });
      } catch (error) {
        console.error('게임 변경 실패:', error);
      } finally {
        this.isChangingGame = false;
      }
    });

    // 방 생성 또는 대기실에서 확정된 서버 상태의 게임을 시작합니다.
    this.onMessage('start_game', async (client) => {
      if (client.sessionId !== this.state.hostId || this.isStarting || this.isChangingGame) return;

      const selectedGame = this.readGameType(this.state.gameType);
      if (!selectedGame) return;

      const host = this.state.players.get(client.sessionId);
      this.isStarting = true;

      try {
        // 새 방에서도 동일 사용자의 방장 권한을 복원할 수 있도록 playerId를 전달한다.
        const gameRoom = await matchMaker.createRoom(selectedGame, {
          hostPlayerId: host?.playerId || '',
        });

        this.broadcast('move_room', {
          roomId: gameRoom.roomId,
          gameType: selectedGame,
        });
      } catch (e) {
        console.error('게임방 생성 실패:', e);
        this.isStarting = false;
      }
    });
  }

  onJoin(client: Client, options: any) {
    const player = new Player();
    player.sessionId = client.sessionId;
    player.playerId = this.readIdentity(options?.playerId, client.sessionId);
    player.nickname = this.readIdentity(
      options?.nickname,
      `플레이어 ${player.playerId.slice(0, 4).toUpperCase()}`,
    );

    // 방에 처음 들어온 사람이 방장!
    if (this.state.players.size === 0) {
      player.isHost = true;
      this.state.hostId = client.sessionId;
    }

    this.state.players.set(client.sessionId, player);

    this.broadcast('chat', {
      clientId: 'System',
      message: `${player.nickname} 님이 테이블에 앉았습니다.`,
    });
  }

  onLeave(client: Client, consented: boolean) {
    const leavingPlayer = this.state.players.get(client.sessionId);
    const wasHost = this.state.hostId === client.sessionId;

    this.state.players.delete(client.sessionId);

    this.broadcast('chat', {
      clientId: 'System',
      message: `${leavingPlayer?.nickname || client.sessionId} 님이 떠났습니다.`,
    });

    if (wasHost) this.transferHost();
  }

  private transferHost() {
    this.state.players.forEach((player) => {
      player.isHost = false;
    });

    const nextEntry = Array.from(this.state.players.entries())[0];
    if (!nextEntry) {
      this.state.hostId = '';
      return;
    }

    const [nextSessionId, nextPlayer] = nextEntry;
    nextPlayer.isHost = true;
    this.state.hostId = nextSessionId;

    this.broadcast('chat', {
      clientId: 'System',
      message: `${nextPlayer.nickname} 님이 새 방장이 되었습니다.`,
    });
  }

  private readIdentity(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  private readGameType(value: unknown): GameType | null {
    return value === 'yutnori' || value === 'onecard' ? value : null;
  }

  private gameLabel(gameType: GameType) {
    return gameType === 'onecard' ? '메이플 원카드' : '초능력 윷놀이';
  }
}
