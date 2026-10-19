import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { listPdfReviews } from './review/list';
import { getPdfReview } from './review/snapshot';
import { getPdfReviewArtifact } from './review/artifact';
import { decidePdfReview } from './review/decide';
import { pdfReviewResponse } from './review/response';
import { sendOwnedBlob } from './artifacts/send-owned-blob';

@Controller('admin/pdf-imports')
@UseGuards(ClerkAuthGuard)
export class PdfReviewController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}
  @Get('reviews')
  @Header('Cache-Control', 'private, no-store')
  list(@Req() request: AuthenticatedRequest) {
    return pdfReviewResponse(async () => {
      const user = await this.users.assertAdmin(request.auth.clerkUserId);
      return listPdfReviews(this.prisma, user.id);
    });
  }
  @Get(':operationId/review')
  @Header('Cache-Control', 'private, no-store')
  snapshot(
    @Req() request: AuthenticatedRequest,
    @Param('operationId') operationId: string,
  ) {
    return pdfReviewResponse(async () => {
      const user = await this.users.assertAdmin(request.auth.clerkUserId);
      return getPdfReview(this.prisma, user.id, operationId);
    });
  }
  @Post(':operationId/review')
  @Header('Cache-Control', 'private, no-store')
  decide(
    @Req() request: AuthenticatedRequest,
    @Param('operationId') operationId: string,
    @Body() body: unknown,
  ) {
    return pdfReviewResponse(async () => {
      const user = await this.users.assertAdmin(request.auth.clerkUserId);
      return decidePdfReview(this.prisma, user.id, operationId, body);
    });
  }
  @Get(':operationId/review/artifacts/:artifactId')
  async artifact(
    @Req() request: AuthenticatedRequest,
    @Param('operationId') operationId: string,
    @Param('artifactId') artifactId: string,
    @Res() response: Response,
  ) {
    const blob = await pdfReviewResponse(async () => {
      const user = await this.users.assertAdmin(request.auth.clerkUserId);
      return getPdfReviewArtifact(
        this.prisma,
        user.id,
        operationId,
        artifactId,
      );
    });
    sendOwnedBlob(response, blob, false);
  }
}
