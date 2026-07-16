import { Controller, Get } from '@nestjs/common';
import { getPublicGameCatalog } from './registry';

@Controller('api/games')
export class GameCatalogController {
  @Get()
  getGames() {
    return getPublicGameCatalog();
  }
}
