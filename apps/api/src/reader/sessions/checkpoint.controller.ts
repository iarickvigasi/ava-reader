import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import type { CheckpointRequest } from './checkpoint-types';
import { validateCheckpoint } from './validate-checkpoint';
import { saveReadingCheckpoint } from './save-checkpoint';

@Controller('library/:libraryItemId/reader/session/checkpoint')
@UseGuards(ClerkAuthGuard)
export class CheckpointController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  @Post()
  async save(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') libraryItemId: string,
    @Body() body: CheckpointRequest,
  ) {
    const checkpoint = validateCheckpoint(body);
    const user = await this.users.getCurrentUserRecord(
      request.auth.clerkUserId,
    );
    return saveReadingCheckpoint(
      this.prisma,
      user.id,
      libraryItemId,
      checkpoint,
    );
  }
}
