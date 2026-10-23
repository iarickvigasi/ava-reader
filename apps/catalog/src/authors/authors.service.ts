import { Injectable, NotFoundException } from '@nestjs/common';
import { PAGE_SIZE } from '../page-size';
import { CatalogDatabase } from '../database/catalog-database';

@Injectable()
export class AuthorsService {
  constructor(private readonly db: CatalogDatabase) {}

  async find(id: string) {
    const author = await this.db.author.findUnique({
      where: { id },
      include: {
        aliases: { orderBy: { name: 'asc' } },
        texts: { orderBy: { locale: 'asc' } },
      },
    });
    if (!author) throw new NotFoundException('Author not found');
    return author;
  }

  async works(authorId: string, after?: string) {
    if (
      !(await this.db.author.findUnique({
        where: { id: authorId },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Author not found');
    }
    const rows = await this.db.work.findMany({
      where: {
        credits: { some: { authorId } },
        ...(after ? { id: { gt: after } } : {}),
      },
      orderBy: { id: 'asc' },
      take: PAGE_SIZE + 1,
      select: {
        id: true,
        originalTitle: true,
        originalLanguage: true,
        revision: true,
      },
    });
    return {
      items: rows.slice(0, PAGE_SIZE),
      nextCursor: rows.length > PAGE_SIZE ? rows[PAGE_SIZE - 1].id : null,
    };
  }
}
