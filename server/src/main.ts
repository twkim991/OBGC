import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Server, LobbyRoom } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { TableRoom } from './rooms/TableRoom';
import { registerGameRooms } from './games/registry';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const gameServer = new Server({
    transport: new WebSocketTransport({
      server: app.getHttpServer(),
    }),
  });

  gameServer.define('lobby', LobbyRoom);
  gameServer.define('table_room', TableRoom).enableRealtimeListing();

  // 실제 게임 방은 중앙 레지스트리에서 일괄 등록합니다.
  registerGameRooms(gameServer);

  // 환경 변수는 항상 문자열이므로 숫자로 변환해야 TCP 포트로 리슨합니다.
  // 문자열을 그대로 넘기면 Node.js가 IPC 소켓 경로로 해석할 수 있습니다.
  const port = Number(process.env.PORT ?? 8002);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`올바르지 않은 PORT 값입니다: ${process.env.PORT}`);
  }

  await app.listen(port, '0.0.0.0');
  console.log(`서버가 ${port}번 포트에서 돌아가고 있습니다!`);
}

bootstrap().catch((error) => {
  console.error('서버를 시작하지 못했습니다.', error);
  process.exitCode = 1;
});
