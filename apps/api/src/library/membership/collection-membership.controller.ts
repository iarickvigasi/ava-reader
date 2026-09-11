import { Body, Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { updateCollectionMembership } from './update-collection-membership';

@Controller('library')
@UseGuards(ClerkAuthGuard)
export class CollectionMembershipController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  @Patch(':libraryItemId/collections')
  async updateMembership(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') libraryItemId: string,
    @Body() input: unknown,
  ) {
    const user = await this.usersService.getCurrentUserRecord(
      request.auth.clerkUserId,
    );
    return updateCollectionMembership({
      input,
      libraryItemId,
      prisma: this.prisma,
      userId: user.id,
    });
  }
}
