import { Room, Client, matchMaker } from 'colyseus';
import { Schema, MapSchema, type } from '@colyseus/schema';

// 1. 플레이어 상태 정의
export class Player extends Schema {
  @type("string") sessionId: string;
  @type("boolean") isHost: boolean = false;
}

// 2. 방 전체 상태 정의
export class TableState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("string") hostId: string = "";
  @type("string") roomName: string = "";
}

// 3. 테이블 룸(대기실) 클래스
export class TableRoom extends Room<TableState> {
  onCreate(options: any) {
    this.setState(new TableState());
    
    // 유저가 입력한 방 제목
    const title = options.roomName || "🎲 즐거운 보드게임 한 판!";
    this.state.roomName = title;
    
    // 🔥 핵심 로직: 로비 목록에 노출될 간판(Metadata) 달아주기!
    this.setMetadata({ roomName: title });

    this.maxClients = 4;

    this.onMessage('chat', (client, message) => {
      this.broadcast('chat', { clientId: client.sessionId, message });
    });

    // 🔥 핵심 로직: 방장이 게임 시작 버튼을 눌렀을 때
    this.onMessage('start_game', async (client, selectedGame) => {
      if (client.sessionId === this.state.hostId) {
        try {
          // 1. 서버가 선택된 게임(yutnori or onecard)의 방을 동적으로 생성
          const gameRoom = await matchMaker.createRoom(selectedGame, {});
          
          // 2. 현재 대기실에 있는 모든 유저에게 새 방 ID와 게임 종류를 쏴줌
          this.broadcast('move_room', { 
            roomId: gameRoom.roomId, 
            gameType: selectedGame 
          });
        } catch (e) {
          console.error("게임방 생성 실패:", e);
        }
      }
    });
  }

  onJoin(client: Client, options: any) {
    const player = new Player();
    player.sessionId = client.sessionId;

    // 방에 처음 들어온 사람이 방장!
    if (this.state.players.size === 0) {
      player.isHost = true;
      this.state.hostId = client.sessionId;
    }

    this.state.players.set(client.sessionId, player);

    this.broadcast('chat', {
      clientId: 'System',
      message: `${client.sessionId} 님이 테이블에 앉았습니다.`,
    });
  }

  onLeave(client: Client, consented: boolean) {
    this.state.players.delete(client.sessionId);

    // TODO: 방장이 나가면 다음 사람에게 방장을 넘기는 로직은 나중에 추가하자!
    this.broadcast('chat', {
      clientId: 'System',
      message: `${client.sessionId} 님이 떠났습니다.`,
    });
  }
}