import { Controller, Get, Req, UseGuards, Query, Header } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { HomeService } from './home.service';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get('mastery')
  @UseGuards(ClerkAuthGuard)
  @Header('Cache-Control', 'no-store')
  getMasteryHistory(
    @Req() request: AuthenticatedRequest,
    @Query('before') before: string,
  ) {
    return this.homeService.getMasteryHistory(request.auth.clerkUserId, before);
  }

  @Get()
  @UseGuards(ClerkAuthGuard)
  getHome(@Req() request: AuthenticatedRequest) {
    return this.homeService.getHome(request.auth.clerkUserId);
  }
}
