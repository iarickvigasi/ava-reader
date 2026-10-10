import { getImportedEpubCover } from './get-cover';
import {
  Controller,
  Get,
  Headers,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { sendOwnedBlob } from '../pdf-import/artifacts/send-owned-blob';
import { getImportedEpubResource } from './get-resource';
@Controller('library/epub-imports')
@UseGuards(ClerkAuthGuard)
export class EpubResourcesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}
  @Get('covers/:libraryItemId')
  async cover(
    @Req() request: AuthenticatedRequest,
    @Param('libraryItemId') libraryItemId: string,
    @Res() response: Response,
  ) {
    const user = await this.users.getCurrentUserRecord(
      request.auth.clerkUserId,
    );
    sendOwnedBlob(
      response,
      await getImportedEpubCover(this.prisma, user.id, libraryItemId),
      false,
    );
  }
  @Get(':importId/resources/:resourceId')
  async resource(
    @Req() request: AuthenticatedRequest,
    @Param('importId') importId: string,
    @Param('resourceId') resourceId: string,
    @Headers('x-ava-reader-schema') schema: string,
    @Headers('x-ava-reader-build') build: string,
    @Res() response: Response,
  ) {
    const user = await this.users.getCurrentUserRecord(
      request.auth.clerkUserId,
    );
    sendOwnedBlob(
      response,
      await getImportedEpubResource(
        this.prisma,
        user.id,
        importId,
        resourceId,
        schema,
        build,
      ),
      false,
    );
  }
}
