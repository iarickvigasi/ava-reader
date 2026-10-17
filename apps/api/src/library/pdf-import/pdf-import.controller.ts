import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { withUploadedFilename } from '../../shared/uploaded-filename';
import { importPdf } from './import-pdf';
import { PdfIntakeCapacityInterceptor } from './admission/intake-capacity.interceptor';
import {
  PdfInvestigationInterceptor,
  type PdfAdmissionRequest,
} from './admission/investigation.interceptor';
import { PDF_IMPORT_PROFILE } from './admission/profile';
import { ownedPdfImport } from './operations/owned-import';
import { serializePdfImport } from './operations/import-status';

@Controller('library/pdf-imports')
@UseGuards(ClerkAuthGuard)
export class PdfImportController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  @Post()
  @UseInterceptors(
    PdfInvestigationInterceptor,
    PdfIntakeCapacityInterceptor,
    FileInterceptor('file', {
      limits: {
        fileSize: PDF_IMPORT_PROFILE.maxSourceBytes,
        files: 1,
        fields: 2,
      },
    }),
  )
  async create(
    @Req() request: PdfAdmissionRequest,
    @UploadedFile() file: Express.Multer.File,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: { convertToEpub?: unknown; originalFilename?: unknown },
  ) {
    const user = await this.users.getCurrentUserRecord(
      request.auth.clerkUserId,
    );
    return importPdf({
      prisma: this.prisma,
      userId: user.id,
      file: withUploadedFilename(file, body.originalFilename),
      idempotencyKey,
      convertToEpub: body.convertToEpub,
      admission: request.pdfAdmission,
    });
  }

  @Get(':operationId')
  async status(
    @Req() request: AuthenticatedRequest,
    @Param('operationId') operationId: string,
  ) {
    const user = await this.users.getCurrentUserRecord(
      request.auth.clerkUserId,
    );
    const operation = await ownedPdfImport(this.prisma, user.id, operationId);
    const book = await this.prisma.book.findUniqueOrThrow({
      where: { id: operation.bookId },
      select: { metadataEditVersion: true },
    });
    return { ...serializePdfImport(operation, 'existing'), ...book };
  }
}
