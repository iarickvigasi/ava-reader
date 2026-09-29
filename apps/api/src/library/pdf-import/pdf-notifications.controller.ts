import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { listPdfNotifications } from './notifications/list';
import { acknowledgePdfNotification } from './notifications/acknowledge';

@Controller('library/pdf-imports/notifications')
@UseGuards(ClerkAuthGuard)
export class PdfNotificationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    const user = await this.users.getCurrentUserRecord(
      request.auth.clerkUserId,
    );
    return listPdfNotifications(this.prisma, user.id);
  }

  @Post(':id/delivered')
  async delivered(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const user = await this.users.getCurrentUserRecord(
      request.auth.clerkUserId,
    );
    return acknowledgePdfNotification(this.prisma, user.id, id, false);
  }

  @Post(':id/acknowledged')
  async acknowledged(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const user = await this.users.getCurrentUserRecord(
      request.auth.clerkUserId,
    );
    return acknowledgePdfNotification(this.prisma, user.id, id, true);
  }
}
