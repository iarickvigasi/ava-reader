import { NotFoundException } from '@nestjs/common';
import type { CatalogDatabase } from '../database/catalog-database';
import type { EditorialKind } from './types';

export async function loadEditorial(
  db: CatalogDatabase,
  kind: EditorialKind,
  id: string,
) {
  const credits = {
    orderBy: { position: 'asc' as const },
    include: { author: { select: { id: true, displayName: true } } },
  };
  const record =
    kind === 'works'
      ? await db.work.findUnique({
          where: { id },
          include: {
            texts: true,
            credits,
            sourceMappings: true,
            editions: {
              select: {
                id: true,
                title: true,
                readingAssets: { select: { mainCatalogEntryId: true } },
              },
            },
          },
        })
      : kind === 'authors'
        ? await db.author.findUnique({
            where: { id },
            include: { aliases: true, texts: true, sourceMappings: true },
          })
        : await db.edition.findUnique({
            where: { id },
            include: {
              credits,
              identifiers: { include: { identifier: true } },
              sourceMappings: true,
              readingAssets: true,
              importEvidence: { take: 20, orderBy: { inspectedAt: 'desc' } },
            },
          });
  if (!record) throw new NotFoundException('Catalog record not found');
  return record;
}
