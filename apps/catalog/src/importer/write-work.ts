import { text } from './raw-fields';
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
  const originalTitle = text(raw.title)!;
  const originalLanguage = normalizeLanguage(raw.original_language);
  await tx.work.upsert({
    where: { id },
    create: { id, originalTitle, originalLanguage, revision },
    update: { originalTitle, originalLanguage, revision },
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
}
