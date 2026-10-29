import { Prisma } from '#catalog-client';
import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
} from '@nestjs/common';
import { CatalogDatabase } from '../database/catalog-database';
import { verifyPublication } from '../reading-assets/publication/verify-publication';
import { parseEditorial } from './parse-editorial';
import { loadEditorial } from './load-editorial';
import { saveWork } from './save-work';
import { saveAuthor } from './save-author';
import { saveEdition } from './save-edition';
import { deleteWork } from './delete-work';

@Controller('internal/editorial')
export class EditorialController {
  constructor(private readonly db: CatalogDatabase) {}
  @Post()
  async execute(
    @Body() body: unknown,
    @Headers('x-reading-timestamp') timestamp: string,
    @Headers('x-reading-signature') signature: string,
  ) {
    verifyPublication(body, timestamp, signature);
    const request = parseEditorial(body);
    if (request.operation === 'search')
      return this.db.author.findMany({
        where: {
          displayName: {
            contains: request.query.replace(/[\\%_]/g, '\\$&'),
            mode: 'insensitive',
          },
        },
        select: { id: true, displayName: true },
        orderBy: { displayName: 'asc' },
        take: 30,
      });
    if (request.operation === 'get')
      return loadEditorial(this.db, request.kind, request.id);
    if (request.operation === 'delete')
      return deleteWork(this.db, request.id, request.revision!);
    const save =
      request.kind === 'works'
        ? saveWork
        : request.kind === 'authors'
          ? saveAuthor
          : saveEdition;
    try {
      return await save(
        this.db,
        request.id,
        request.revision!,
        request.data ?? {},
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2003'].includes(error.code)
      )
        throw new BadRequestException(
          'Duplicate metadata rows or an unknown contributor; check the form',
        );
      throw error;
    }
  }
}
