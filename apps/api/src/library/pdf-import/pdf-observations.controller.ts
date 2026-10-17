import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { findPdfRequest } from './operations/find-request';
import { observePdfImports } from './operations/observe-imports';

@Controller('library/pdf-imports')
@UseGuards(ClerkAuthGuard)
export class PdfObservationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  @Get('observations/list')
  async observe(@Req() request: AuthenticatedRequest, @Query('ids') ids = '') {
    const user = await this.users.getCurrentUserRecord(
      request.auth.clerkUserId,
    );
    return observePdfImports(this.prisma, user.id, ids);
  }

  @Get('requests/:requestKey')
  async request(
    @Req() request: AuthenticatedRequest,
    @Param('requestKey') requestKey: string,
  ) {
    const user = await this.users.getCurrentUserRecord(
      request.auth.clerkUserId,
    );
    return findPdfRequest(this.prisma, user.id, requestKey);
  }
}
