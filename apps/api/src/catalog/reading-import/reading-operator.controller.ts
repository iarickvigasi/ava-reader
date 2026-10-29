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
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ReadingOperatorGuard } from './reading-operator.guard';
import { readingImportUpload } from './reading-import-upload';
import { operatorContentDigest } from './operator-content-digest';
import { ingestImport } from './ingest-import';
import { loadImport } from './load-import';
import { publishReadingImport } from './publish-reading-import';

@Controller('internal/reading-imports')
@UseGuards(ReadingOperatorGuard)
export class ReadingOperatorController {
  constructor(private readonly prisma: PrismaService) {}
  @Post()
  @UseInterceptors(FileInterceptor('sourceFile', readingImportUpload))
  ingest(
    @Req() request: Request,
    @Body('manifest') manifest: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    operatorContentDigest(manifest, request.get('x-reading-import-digest'));
    return ingestImport(this.prisma, null, manifest, file);
  }
  @Get()
  async status(
    @Query('editionId') editionId: string,
    @Query('checksum') checksum: string,
  ) {
    return (await loadImport(this.prisma, editionId, checksum)).receipt;
  }
  @Post('publish')
  publish(@Body() body: Record<string, unknown>) {
    return publishReadingImport(this.prisma, 'server-operator', body);
  }
}
