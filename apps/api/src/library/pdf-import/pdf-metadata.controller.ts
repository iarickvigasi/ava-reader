import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { editPdfMetadata } from './metadata/edit-metadata';
import { readPdfMetadata } from './metadata/read-metadata';

@Controller('library/pdf-imports')
@UseGuards(ClerkAuthGuard)
export class PdfMetadataController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  @Get(':operationId/metadata')
  async read(
    @Req() request: AuthenticatedRequest,
    @Param('operationId') operationId: string,
  ) {
    const user = await this.users.getCurrentUserRecord(
      request.auth.clerkUserId,
    );
    return readPdfMetadata(this.prisma, user.id, operationId);
  }

  @Patch(':operationId/metadata')
  async edit(
    @Req() request: AuthenticatedRequest,
    @Param('operationId') operationId: string,
    @Body() body: unknown,
  ) {
    const user = await this.users.getCurrentUserRecord(
      request.auth.clerkUserId,
    );
    return editPdfMetadata(this.prisma, user.id, operationId, body);
  }
}
