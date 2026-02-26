import { Room, Client } from 'colyseus';

export class OneCardRoom extends Room {
  onCreate(options: any) {
    this.maxClients = 4;
    this.onMessage('chat', (client, message) => {
      this.broadcast('chat', { clientId: client.sessionId, message: `[원카드] ${message}` });
    });
  }
  onJoin(client: Client) {
    this.broadcast('chat', { clientId: 'System', message: `${client.sessionId} 님이 원카드 테이블에 앉았습니다.` });
  }
  onLeave(client: Client) {}
}