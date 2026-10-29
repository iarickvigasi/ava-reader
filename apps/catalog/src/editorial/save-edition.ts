import { readMetadataOverrides } from './read-metadata-overrides';
import { normalizeIsbn } from '../importer/normalize-isbn';
import { editorialLanguage } from './editorial-language';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PublicationFormat } from '#catalog-client';
import type { CatalogDatabase } from '../database/catalog-database';
import { cover, rows, text } from './editorial-values';
import { editorialCredits } from './editorial-credits';
import { loadEditorial } from './load-editorial';

export async function saveEdition(
  db: CatalogDatabase,
  id: string,
  revision: number,
  data: Record<string, unknown>,
) {
  const language = editorialLanguage(data.language, true);
  const format = data.format as PublicationFormat;
  const year = data.publishedYear;
  if (
    !Object.values(PublicationFormat).includes(format) ||
    (year !== null &&
      (!Number.isInteger(year) || Number(year) < 1 || Number(year) > 3000))
  )
    throw new BadRequestException('Invalid edition year or format');
  await db.$transaction(async (tx) => {
    const metadataOverrides = await readMetadataOverrides(
      tx,
      'editions',
      id,
      data,
    );
    const current = await tx.edition.findUniqueOrThrow({
      where: { id },
      include: { readingAssets: { select: { id: true }, take: 1 } },
    });
    if (current.readingAssets.length && current.language !== language)
      throw new BadRequestException(
        'A reading copy exists; import a new copy to change its language',
      );
    const result = await tx.edition.updateMany({
      where: { id, revision },
      data: {
        title: text(data.title)!,
        language,
        format,
        publishedYear: year as number | null,
        publisher: text(data.publisher, true),
        coverImageUrl: cover(data.coverImageUrl),
        metadataOverrides,
        revision: { increment: 1 },
      },
    });
    if (!result.count)
      throw new ConflictException('Edition changed; reload before editing');
    await tx.editionCredit.deleteMany({ where: { editionId: id } });
    await tx.editionCredit.createMany({
      data: editorialCredits(data.credits).map((credit) => ({
        editionId: id,
        ...credit,
      })),
    });
    await tx.editionIdentifier.deleteMany({ where: { editionId: id } });
    for (const row of rows(data.identifiers)) {
      const inputScheme = text(row.scheme)!;
      const value = text(row.normalizedValue)!;
      const isbn = inputScheme.startsWith('ISBN_')
        ? normalizeIsbn(value)
        : null;
      if (inputScheme.startsWith('ISBN_') && !isbn)
        throw new BadRequestException('Invalid ISBN');
      const scheme = isbn ? 'ISBN_13' : inputScheme;
      const normalizedValue = isbn ?? value;
      const identifier = await tx.identifier.upsert({
        where: { scheme_normalizedValue: { scheme, normalizedValue } },
        create: { scheme, normalizedValue },
        update: {},
      });
      await tx.editionIdentifier.create({
        data: { editionId: id, identifierId: identifier.id },
      });
    }
  });
  return loadEditorial(db, 'editions', id);
}
