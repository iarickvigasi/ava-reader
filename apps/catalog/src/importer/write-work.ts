import { references, text } from './raw-fields';
import { workData } from './work-data';
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
  const data = workData(raw, revision);
  await tx.work.upsert({
    where: { id },
    create: { id, ...data },
    update: data,
  });
  const locale = data.originalLanguage ?? 'und';
  const description = text(raw.description);
  await tx.workText.upsert({
    where: { workId_locale: { workId: id, locale } },
    create: { workId: id, locale, title: data.originalTitle, description },
    update: { title: data.originalTitle, description },
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
