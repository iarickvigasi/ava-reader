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
import { getPublishedPdfResource } from './artifacts/get-resource';
import { getPublishedPdfEpub } from './artifacts/get-epub';
import { getPdfArtifact } from './artifacts/get-artifact';
import { getPdfCover } from './artifacts/get-cover';
import { sendOwnedBlob } from './artifacts/send-owned-blob';

@Controller('library/pdf-imports')
@UseGuards(ClerkAuthGuard)
export class PdfArtifactsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}
  @Get(':operationId/artifacts/:artifactId')
  async artifact(
    @Req() request: AuthenticatedRequest,
    @Param('operationId') operationId: string,
    @Param('artifactId') artifactId: string,
    @Res() response: Response,
  ) {
    const user = await this.users.getCurrentUserRecord(
      request.auth.clerkUserId,
    );
    sendOwnedBlob(
      response,
      await getPdfArtifact(this.prisma, user.id, operationId, artifactId),
    );
  }

  @Get(':operationId/formats/epub')
  async epub(
    @Req() request: AuthenticatedRequest,
    @Param('operationId') operationId: string,
    @Res() response: Response,
  ) {
    const user = await this.users.getCurrentUserRecord(
      request.auth.clerkUserId,
    );
    sendOwnedBlob(
      response,
      await getPublishedPdfEpub(this.prisma, user.id, operationId),
    );
  }

  @Get(':operationId/resources/:resourceId')
  async resource(
    @Req() request: AuthenticatedRequest,
    @Param('operationId') operationId: string,
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
      await getPublishedPdfResource(
        this.prisma,
        user.id,
        operationId,
        resourceId,
        schema,
        build,
      ),
      false,
    );
  }

  @Get(':operationId/cover')
  async cover(
    @Req() request: AuthenticatedRequest,
    @Param('operationId') operationId: string,
    @Res() response: Response,
  ) {
    const user = await this.users.getCurrentUserRecord(
      request.auth.clerkUserId,
    );
    sendOwnedBlob(
      response,
      await getPdfCover(this.prisma, user.id, operationId),
      false,
    );
  }
}
