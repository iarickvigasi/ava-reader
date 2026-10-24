import { WORK_CARD_SELECT } from './work-card-select';
import { Prisma } from '#catalog-client';
import { Injectable } from '@nestjs/common';
import { CatalogDatabase } from '../database/catalog-database';
import { browseWhere } from './browse-where';
import type { BrowseQuery } from './browse-query';

@Injectable()
export class BrowseService {
  constructor(private readonly db: CatalogDatabase) {}

  async list(input: BrowseQuery) {
    const where = browseWhere(input);
    const rows = await this.db.work.findMany({
      where,
      orderBy: { id: input.before ? 'desc' : 'asc' },
      take: input.limit + 1,
      select: WORK_CARD_SELECT,
    });
    const items = rows.slice(0, input.limit);
    if (input.before) items.reverse();
    return {
      items,
      nextCursor:
        items.length && (input.before || rows.length > input.limit)
          ? items.at(-1)!.id
          : null,
      previousCursor:
        items.length &&
        (input.cursor || (input.before && rows.length > input.limit))
          ? items[0].id
          : null,
    };
  }

  async filters() {
    const languages = await this.db.$queryRaw<
      { language: string }[]
    >(Prisma.sql`
      SELECT DISTINCT "language" FROM "Edition" WHERE "language" IS NOT NULL
      ORDER BY "language" ASC LIMIT 200
    `);
    return { languages: languages.map((row) => row.language) };
  }
}
