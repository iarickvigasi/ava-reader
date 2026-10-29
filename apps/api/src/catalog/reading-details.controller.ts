import {
  BookVisibility,
  CatalogStatus,
  ProcessingStatus,
  UserRole,
} from '@prisma/client';
import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Controller('catalog/editions')
@UseGuards(ClerkAuthGuard)
export class ReadingDetailsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}
  @Get(':id/reading-details')
  @Header('Cache-Control', 'private, no-store')
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const user = await this.users.getCurrentUserRecord(
      request.auth.clerkUserId,
    );
    const entry = await this.prisma.catalogEntry.findFirst({
      where: {
        importKey: { not: null },
        status: user.roles.includes(UserRole.ADMIN)
          ? { in: [CatalogStatus.DRAFT, CatalogStatus.PUBLISHED] }
          : CatalogStatus.PUBLISHED,
        importEvidence: { path: ['editionId'], equals: id },
        book: {
          visibility: BookVisibility.PUBLIC,
          privateOwnerId: null,
          processingRuns: {
            some: {
              pipeline: 'normalize-reader-package-v1',
              status: ProcessingStatus.READY,
            },
          },
        },
      },
      orderBy: [
        { status: 'desc' },
        { importPublishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        book: {
          select: {
            estimatedPageCount: true,
            estimatedBodyPageCount: true,
            description: true,
          },
        },
      },
    });
    return {
      description: entry?.book.description ?? null,
      approximatePageCount: entry?.book.estimatedPageCount ?? null,
      approximateBodyPageCount: entry?.book.estimatedBodyPageCount ?? null,
    };
  }
}
