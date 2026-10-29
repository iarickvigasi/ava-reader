import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { UsersService } from '../../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { linkEditionWork } from './link-edition-work';
@Controller('admin/explore/edition-work')
@UseGuards(ClerkAuthGuard)
export class EditionWorkController {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
  ) {}
  @Post()
  async link(
    @Req() req: AuthenticatedRequest,
    @Body() body: Parameters<typeof linkEditionWork>[1],
  ) {
    await this.users.assertAdmin(req.auth.clerkUserId);
    if (
      !body ||
      ![body.editionId, body.workId].every(
        (id) => typeof id === 'string' && /^[a-f\d-]{36}$/i.test(id),
      ) ||
      ![body.revision, body.workRevision].every(
        (revision) => Number.isSafeInteger(revision) && revision > 0,
      )
    )
      throw new BadRequestException('Invalid work/edition link');
    return linkEditionWork(this.prisma, {
      editionId: body.editionId,
      workId: body.workId,
      revision: body.revision,
      workRevision: body.workRevision,
    });
  }
}
