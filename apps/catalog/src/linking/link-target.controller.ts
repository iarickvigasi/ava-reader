import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { CatalogDatabase } from '../database/catalog-database';
@Controller()
export class LinkTargetController {
  constructor(private readonly db: CatalogDatabase) {}
  @Get('works/:id/link-target')
  async target(@Param('id', new ParseUUIDPipe()) id: string) {
    const work = await this.db.work.findUnique({
      where: { id, deletedAt: null },
      include: {
        credits: {
          where: { role: 'AUTHOR' },
          orderBy: { position: 'asc' },
          include: { author: true },
        },
      },
    });
    if (!work) throw new NotFoundException('Work not found');
    return {
      workId: id,
      title: work.originalTitle,
      revision: work.revision,
      authors: work.credits.map((credit) => credit.author.displayName),
    };
  }
  @Get('editions')
  async editions(@Query('query') query = '') {
    if (query.length > 100) throw new BadRequestException('Search too long');
    return this.db.edition.findMany({
      where: {
        title: {
          contains: query.replace(/[\\%_]/g, '\\$&'),
          mode: 'insensitive',
        },
        work: { deletedAt: null },
      },
      select: {
        id: true,
        workId: true,
        revision: true,
        title: true,
        language: true,
        work: { select: { originalTitle: true } },
      },
      orderBy: { id: 'asc' },
      take: 30,
    });
  }
}
