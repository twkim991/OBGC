import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Server, LobbyRoom } from 'colyseus';
import { TableRoom } from './rooms/TableRoom';
import { YutnoriRoom } from './rooms/YutnoriRoom'; // <-- 추가
import { OneCardRoom } from './rooms/OneCardRoom'; // <-- 추가

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const gameServer = new Server({
    server: app.getHttpServer(),
  });

  gameServer.define('lobby', LobbyRoom);
  gameServer.define('table_room', TableRoom).enableRealtimeListing();

  // 실제 게임 방 등록 (로비 목록에는 띄우지 않음!)
  gameServer.define('yutnori', YutnoriRoom);
  gameServer.define('onecard', OneCardRoom);

  // 🔥 Cafe24가 던져주는 PORT 환경변수를 최우선으로 쓰도록 설정!
  const port = process.env.PORT || 8002;
  await app.listen(port);
  console.log(`서버가 ${port}번 포트에서 돌아가고 있습니다!`);
}
bootstrap();
