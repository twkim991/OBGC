import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    // 🔥 프론트엔드 화면을 서빙해주는 마법의 모듈!
    ServeStaticModule.forRoot({
      // 아까 옮겨둔 Vue 빌드 폴더 경로
      rootPath: join(__dirname, '..', 'client-dist'),
      exclude: ['/api/(.*)'], // API 경로는 프론트 화면 대신 백엔드가 처리하도록 예외 처리
    }),
  ],
})
export class AppModule {}
