import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CatalogDatabase } from '../database/catalog-database';
@Controller('edition-covers')
export class EditionCoversController {
  constructor(private readonly db: CatalogDatabase) {}
  @Get(':id')
  async read(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() response: Response,
  ) {
    const edition = await this.db.edition.findFirst({
      where: {
        coverImageUrl: `/catalog/api/edition-covers/${id}`,
        work: { deletedAt: null },
      },
      select: { id: true },
    });
    if (!edition) throw new NotFoundException('Cover not found');
    const blob = await this.db.publicBlob.findFirst({
      where: {
        id,
        purpose: 'BOOK_COVER',
        mimeType: {
          in: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        },
      },
    });
    if (!blob) throw new NotFoundException('Cover not found');
    response.setHeader('Content-Type', blob.mimeType);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'public, max-age=300');
    response.send(Buffer.from(blob.bytes));
  }
}
