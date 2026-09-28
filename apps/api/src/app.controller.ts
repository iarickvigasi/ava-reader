import { Controller, Get, Header } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('reachability')
  @Header('Cache-Control', 'no-store')
  getReachability(this: void) {
    return { service: 'ava-reader-api' };
  }

  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }
}
