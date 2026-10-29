import {
  Controller,
  Get,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { UsersService } from '../../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';
@Controller('private-catalog-links')
@UseGuards(ClerkAuthGuard)
export class PrivateCatalogLinksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}
  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('workId', new ParseUUIDPipe()) workId: string,
  ) {
    const user = await this.users.getCurrentUserRecord(req.auth.clerkUserId);
    return this.prisma.libraryItem.findMany({
      where: {
        userId: user.id,
        source: 'IMPORTED',
        isArchived: false,
        book: { visibility: 'PRIVATE', privateOwnerId: user.id },
        catalogLink: { path: ['workId'], equals: workId },
      },
      select: { id: true, catalogLink: true, catalogLinkVersion: true },
      take: 100,
    });
  }
}
