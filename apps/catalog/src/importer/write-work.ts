import { openLibraryCover } from './open-library-cover';
import { readerCategories, CATEGORY_VERSION } from './reader-categories';
import { references, strings, text } from './raw-fields';
import { normalizeLanguage } from './normalize-language';
import { resolveReferences } from './resolve-references';
import type { Raw, Tx } from './types';

export async function writeWork(
  tx: Tx,
  sourceId: string,
  id: string,
  revision: number,
  raw: Raw,
) {
  const authors = await resolveReferences(tx, sourceId, raw.authors, 'authors');
  const subjects = strings(raw.subjects);
  const enrichment = {
    ...openLibraryCover(raw.covers),
    subjects,
    categories: subjects ? readerCategories(subjects) : undefined,
    categoryVersion: subjects ? CATEGORY_VERSION : undefined,
    metadataIncomplete: false,
  };
  const originalTitle = text(raw.title)!;
  const originalLanguage = normalizeLanguage(raw.original_language);
  await tx.work.upsert({
    where: { id },
    create: { id, originalTitle, originalLanguage, revision, ...enrichment },
    update: { originalTitle, originalLanguage, revision, ...enrichment },
  });
  const locale = originalLanguage ?? 'und';
  const description = text(raw.description);
  await tx.workText.upsert({
    where: { workId_locale: { workId: id, locale } },
    create: { workId: id, locale, title: originalTitle, description },
    update: { title: originalTitle, description },
  });
  if (raw.authors !== undefined) {
    await tx.workCredit.deleteMany({ where: { workId: id } });
    await tx.workCredit.createMany({
      data: authors.map((authorId, position) => ({
        workId: id,
        authorId,
        position,
      })),
    });
  }
  return authors.length < references(raw.authors, 'authors').length;
}
