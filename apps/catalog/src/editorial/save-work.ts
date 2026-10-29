import { readMetadataOverrides } from './read-metadata-overrides';
import { BadRequestException } from '@nestjs/common';
import { CATEGORY_KEYS, CATEGORY_VERSION } from '../importer/reader-categories';
import { editorialLanguage } from './editorial-language';
import { ConflictException } from '@nestjs/common';
import type { CatalogDatabase } from '../database/catalog-database';
import { cover, rows, strings, text } from './editorial-values';
import { editorialCredits } from './editorial-credits';
import { loadEditorial } from './load-editorial';

export async function saveWork(
  db: CatalogDatabase,
  id: string,
  revision: number,
  data: Record<string, unknown>,
) {
  const categories = strings(data.categories);
  if (categories.some((category) => !CATEGORY_KEYS.includes(category)))
    throw new BadRequestException('Unknown reader category');
  await db.$transaction(async (tx) => {
    const metadataOverrides = await readMetadataOverrides(
      tx,
      'works',
      id,
      data,
    );
    const result = await tx.work.updateMany({
      where: { id, revision, deletedAt: null },
      data: {
        originalTitle: text(data.originalTitle)!,
        originalLanguage: editorialLanguage(data.originalLanguage, true),
        coverImageUrl: cover(data.coverImageUrl),
        subjects: strings(data.subjects),
        categories,
        categoryVersion: CATEGORY_VERSION,
        metadataOverrides,
        revision: { increment: 1 },
      },
    });
    if (!result.count)
      throw new ConflictException('Book changed; reload before editing');
    await tx.workText.deleteMany({ where: { workId: id } });
    await tx.workText.createMany({
      data: rows(data.texts).map((row) => ({
        workId: id,
        locale: editorialLanguage(row.locale)!,
        title: text(row.title)!,
        description: text(row.description, true),
      })),
    });
    await tx.workCredit.deleteMany({ where: { workId: id } });
    await tx.workCredit.createMany({
      data: editorialCredits(data.credits).map((credit) => ({
        workId: id,
        ...credit,
      })),
    });
  });
  return loadEditorial(db, 'works', id);
}
