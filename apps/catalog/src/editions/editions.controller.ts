import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { WORK_COVER_SELECT } from '../works/work-cover-select';
import { READY_READING_ASSET } from '../works/ready-reading-assets';
import { PAGE_SIZE } from '../page-size';
import { CatalogDatabase } from '../database/catalog-database';

@Controller('editions')
export class EditionsController {
  constructor(private readonly db: CatalogDatabase) {}
  @Get(':id')
  async find(@Param('id', new ParseUUIDPipe()) id: string) {
    const edition = await this.db.edition.findUnique({
      omit: { metadataOverrides: true },
      where: { id, work: { deletedAt: null } },
      include: {
        work: {
          select: {
            id: true,
            originalTitle: true,
            ...WORK_COVER_SELECT,
            credits: {
              orderBy: [{ position: 'asc' }, { authorId: 'asc' }],
              include: { author: { select: { id: true, displayName: true } } },
            },
          },
        },
        readingAssets: {
          where: READY_READING_ASSET,
          take: PAGE_SIZE,
          orderBy: { id: 'asc' },
          include: {
            edition: {
              select: {
                id: true,
                title: true,
                language: true,
                format: true,
                publishedYear: true,
              },
            },
          },
        },
        importEvidence: {
          select: {
            checksum: true,
            provider: true,
            sourceUrl: true,
            downloadUrl: true,
            filename: true,
          },
          take: PAGE_SIZE,
          orderBy: [{ inspectedAt: 'desc' }, { checksum: 'asc' }],
        },
        identifiers: { include: { identifier: true } },
        credits: {
          orderBy: [{ position: 'asc' }, { authorId: 'asc' }],
          include: { author: { select: { id: true, displayName: true } } },
        },
      },
    });
    if (!edition) throw new NotFoundException('Edition not found');
    return edition;
  }
}
