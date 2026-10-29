import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import type { AuthenticatedRequest } from '../../auth/authenticated-request';
import { readingImportUpload } from './reading-import-upload';
import { ReadingImportService } from './reading-import.service';

@Controller('admin/reading-imports')
@UseGuards(ClerkAuthGuard)
export class ReadingImportController {
  constructor(private readonly service: ReadingImportService) {}

  @Post()
  @UseInterceptors(FileInterceptor('sourceFile', readingImportUpload))
  ingest(
    @Req() request: AuthenticatedRequest,
    @Body('manifest') manifest: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.ingest(request.auth.clerkUserId, manifest, file);
  }

  @Get()
  status(
    @Req() request: AuthenticatedRequest,
    @Query('editionId') editionId: string,
    @Query('checksum') checksum: string,
  ) {
    return this.service.status(request.auth.clerkUserId, editionId, checksum);
  }

  @Post('publish')
  publish(
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.publish(request.auth.clerkUserId, body);
  }
}
