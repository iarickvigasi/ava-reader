import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { listReviews } from './list-reviews';
import { previewImport } from './preview-import';

@Controller('admin/reading-reviews')
@UseGuards(ClerkAuthGuard)
export class ReviewsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}
  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    await this.users.assertAdmin(request.auth.clerkUserId);
    return listReviews(this.prisma);
  }
  @Post('preview')
  async preview(
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    const admin = await this.users.assertAdmin(request.auth.clerkUserId);
    if (
      !body ||
      typeof body.editionId !== 'string' ||
      typeof body.checksum !== 'string'
    )
      throw new BadRequestException('Missing preview identity');
    return previewImport(this.prisma, admin.id, body.editionId, body.checksum);
  }
}
