import { readMetadataOverrides } from './read-metadata-overrides';
import { editorialLanguage } from './editorial-language';
import { ConflictException } from '@nestjs/common';
import type { CatalogDatabase } from '../database/catalog-database';
import { rows, strings, text } from './editorial-values';
import { loadEditorial } from './load-editorial';

export async function saveAuthor(
  db: CatalogDatabase,
  id: string,
  revision: number,
  data: Record<string, unknown>,
) {
  await db.$transaction(async (tx) => {
    const metadataOverrides = await readMetadataOverrides(
      tx,
      'authors',
      id,
      data,
    );
    const result = await tx.author.updateMany({
      where: { id, revision },
      data: {
        displayName: text(data.displayName)!,
        metadataOverrides,
        revision: { increment: 1 },
      },
    });
    if (!result.count)
      throw new ConflictException('Author changed; reload before editing');
    await tx.authorAlias.deleteMany({ where: { authorId: id } });
    await tx.authorAlias.createMany({
      data: strings(data.aliases).map((name) => ({ authorId: id, name })),
    });
    await tx.authorText.deleteMany({ where: { authorId: id } });
    await tx.authorText.createMany({
      data: rows(data.texts).map((row) => ({
        authorId: id,
        locale: editorialLanguage(row.locale)!,
        biography: text(row.biography)!,
      })),
    });
  });
  return loadEditorial(db, 'authors', id);
}
