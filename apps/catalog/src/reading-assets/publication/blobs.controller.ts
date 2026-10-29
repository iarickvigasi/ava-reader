import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CatalogDatabase } from '../../database/catalog-database';
import { verifyPublication } from './verify-publication';
import { PublicStorageGuard } from './storage.guard';
import { loadPublicBlob } from './load-public-blob';

@Controller('reading-assets/blobs')
@UseGuards(PublicStorageGuard)
export class PublicBlobsController {
  constructor(private readonly db: CatalogDatabase) {}
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 256 * 1024 * 1024,
        files: 1,
        fields: 1,
        fieldSize: 16_384,
      },
    }),
  )
  async store(
    @Body('metadata') json: string,
    @UploadedFile() file: { buffer: Buffer },
    @Headers('x-reading-timestamp') timestamp: string,
    @Headers('x-reading-signature') signature: string,
  ) {
    let metadata: {
      checksum: string;
      purpose: string;
      mimeType: string;
      originalFilename: string;
      sizeBytes: number;
    };
    try {
      metadata = JSON.parse(json) as typeof metadata;
    } catch {
      throw new BadRequestException('Invalid metadata');
    }
    verifyPublication(metadata, timestamp, signature);
    if (
      !file ||
      ![
        'BOOK_SOURCE',
        'BOOK_COVER',
        'DERIVED_READER',
        'IMPORT_METADATA',
      ].includes(metadata.purpose) ||
      typeof metadata.mimeType !== 'string' ||
      metadata.mimeType.length > 255 ||
      typeof metadata.originalFilename !== 'string' ||
      metadata.originalFilename.length > 4000 ||
      metadata.sizeBytes !== file.buffer.length ||
      createHash('sha256').update(file.buffer).digest('hex') !==
        metadata.checksum
    )
      throw new BadRequestException('Invalid public blob');
    return this.db.publicBlob.upsert({
      where: {
        checksum_purpose: {
          checksum: metadata.checksum,
          purpose: metadata.purpose,
        },
      },
      update: {},
      create: { ...metadata, bytes: Uint8Array.from(file.buffer) },
      select: { id: true, checksum: true, sizeBytes: true },
    });
  }
  @Get(':id')
  async read(
    @Param('id') id: string,
    @Headers('x-reading-timestamp') timestamp: string,
    @Headers('x-reading-signature') signature: string,
    @Res() response: Response,
  ) {
    verifyPublication({ blobId: id }, timestamp, signature);
    if (!/^[\da-f-]{36}$/i.test(id))
      throw new BadRequestException('Invalid blob ID');
    const blob = await loadPublicBlob(this.db, id);
    response.setHeader('Content-Type', blob.mimeType);
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(Buffer.from(blob.bytes));
  }
}
