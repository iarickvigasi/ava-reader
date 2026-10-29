import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { UsersService } from '../../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { loadImport } from './load-import';
import { syncPublication } from '../publication/sync-publication';
@Controller('admin/reading-imports')
@UseGuards(ClerkAuthGuard)
export class ReadingUnpublishController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}
  @Post('unpublish')
  async unpublish(
    @Req() request: AuthenticatedRequest,
    @Body() body: { editionId: string; checksum: string },
  ) {
    await this.users.assertAdmin(request.auth.clerkUserId);
    if (
      !/^[\da-f-]{36}$/i.test(body?.editionId ?? '') ||
      !/^[a-f\d]{64}$/.test(body?.checksum ?? '')
    )
      throw new BadRequestException('Invalid import identity');
    const { entry } = await loadImport(
      this.prisma,
      body.editionId,
      body.checksum,
    );
    await this.prisma.catalogEntry.updateMany({
      where: {
        id: entry.id,
        importKey: entry.importKey,
        book: { visibility: 'PUBLIC', privateOwnerId: null },
      },
      data: {
        status: 'ARCHIVED',
        importSyncPending: true,
        importSyncRevision: { increment: 1 },
      },
    });
    try {
      await syncPublication(this.prisma, entry.id);
    } catch {
      throw new ServiceUnavailableException(
        'Unpublished; Catalog synchronization is pending and will retry automatically',
      );
    }
    return (await loadImport(this.prisma, body.editionId, body.checksum))
      .receipt;
  }
}
