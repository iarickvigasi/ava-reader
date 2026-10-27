import { WORK_COVER_SELECT } from './work-cover-select';
import { READY_READING_ASSET } from './ready-reading-assets';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PAGE_SIZE } from '../page-size';
import { CatalogDatabase } from '../database/catalog-database';

@Injectable()
export class WorksService {
  constructor(private readonly db: CatalogDatabase) {}

  async find(id: string) {
    const work = await this.db.work.findUnique({
      where: { id },
      include: {
        editions: WORK_COVER_SELECT.editions,
        texts: { orderBy: { locale: 'asc' } },
        credits: {
          orderBy: [{ position: 'asc' }, { authorId: 'asc' }],
          include: { author: { select: { id: true, displayName: true } } },
        },
      },
    });
    if (!work) throw new NotFoundException('Work not found');
    const readingAssets = await this.db.readingAsset.findMany({
      where: { ...READY_READING_ASSET, edition: { workId: id } },
      orderBy: { id: 'asc' },
      take: PAGE_SIZE,
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
    });
    return { ...work, readingAssets };
  }

  async editions(workId: string, after?: string) {
    if (
      !(await this.db.work.findUnique({
        where: { id: workId },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Work not found');
    }
    const rows = await this.db.edition.findMany({
      where: { workId, ...(after ? { id: { gt: after } } : {}) },
      orderBy: { id: 'asc' },
      take: PAGE_SIZE + 1,
      include: {
        identifiers: { include: { identifier: true } },
        credits: {
          orderBy: [{ position: 'asc' }, { authorId: 'asc' }],
          include: { author: { select: { id: true, displayName: true } } },
        },
      },
    });
    return {
      items: rows.slice(0, PAGE_SIZE),
      nextCursor: rows.length > PAGE_SIZE ? rows[PAGE_SIZE - 1].id : null,
    };
  }
}
