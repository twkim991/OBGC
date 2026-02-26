import { Room, Client } from 'colyseus';

export class LobbyRoom extends Room {
  // 방이 생성될 때 한 번 실행 (초기화 로직)
  onCreate(options: any) {
    this.maxClients = 100; // 로비 최대 인원 제한

    // 클라이언트로부터 'chat' 타입의 메시지를 받았을 때의 처리
    this.onMessage('chat', (client, message) => {
      // 접속해 있는 모든 클라이언트에게 메시지 브로드캐스트
      this.broadcast('chat', {
        clientId: client.sessionId,
        message: message,
      });
    });
  }

  // 클라이언트가 방에 접속했을 때
  onJoin(client: Client, options: any) {
    this.broadcast('chat', {
      clientId: 'System',
      message: `${client.sessionId} 님이 입장하셨습니다.`,
    });
  }

  // 클라이언트가 방에서 나갔을 때
  onLeave(client: Client, consented: boolean) {
    this.broadcast('chat', {
      clientId: 'System',
      message: `${client.sessionId} 님이 퇴장하셨습니다.`,
    });
  }

  // 방에 아무도 없어서 소멸될 때
  onDispose() {}
}