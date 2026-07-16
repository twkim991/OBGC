import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Server, LobbyRoom } from 'colyseus';
import { TableRoom } from './rooms/TableRoom';
import { registerGameRooms } from './games/registry';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const gameServer = new Server({
    server: app.getHttpServer(),
  });

  gameServer.define('lobby', LobbyRoom);
  gameServer.define('table_room', TableRoom).enableRealtimeListing();

  // 실제 게임 방은 중앙 레지스트리에서 일괄 등록합니다.
  registerGameRooms(gameServer);

  // 🔥 Cafe24가 던져주는 PORT 환경변수를 최우선으로 쓰도록 설정!
  const port = process.env.PORT || 8002;
  await app.listen(port);
  console.log(`서버가 ${port}번 포트에서 돌아가고 있습니다!`);
}
bootstrap();
