import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { HomeService } from './home.service';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get()
  @UseGuards(ClerkAuthGuard)
  getHome(@Req() request: AuthenticatedRequest) {
    return this.homeService.getHome(request.auth.clerkUserId);
  }
}
