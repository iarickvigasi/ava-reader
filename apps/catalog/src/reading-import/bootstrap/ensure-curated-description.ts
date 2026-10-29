import { createHash } from 'node:crypto';
import type { Tx } from '../../importer/types';
import type { BootstrapBook } from './read-bootstrap';
export async function ensureCuratedDescription(
  tx: Tx,
  sourceId: string,
  book: BootstrapBook,
) {
  const authorKey = createHash('sha256').update(book.author).digest('hex');
  const workKey = createHash('sha256')
    .update(`${book.language}:${book.author}:${book.title}`)
    .digest('hex');
  const author = await tx.sourceMapping.findUnique({
    where: {
      sourceId_entityKind_externalId: {
        sourceId,
        entityKind: 'AUTHOR',
        externalId: authorKey,
      },
    },
  });
  const authorId =
    author?.authorId ??
    (await tx.author.create({ data: { displayName: book.author } })).id;
  if (!author)
    await tx.sourceMapping.create({
      data: { sourceId, entityKind: 'AUTHOR', externalId: authorKey, authorId },
    });
  const existing = await tx.sourceMapping.findUnique({
    where: {
      sourceId_entityKind_externalId: {
        sourceId,
        entityKind: 'WORK',
        externalId: workKey,
      },
    },
  });
  if (existing?.workId) {
    const work = await tx.work.findUniqueOrThrow({
      where: { id: existing.workId },
    });
    if (work.deletedAt) throw new Error('Curated work was deleted');
    return work.id;
  }
  const work = await tx.work.create({
    data: {
      originalTitle: book.title,
      originalLanguage: book.language,
      texts: { create: { locale: book.language, title: book.title } },
      credits: { create: { authorId } },
    },
  });
  await tx.sourceMapping.create({
    data: {
      sourceId,
      entityKind: 'WORK',
      externalId: workKey,
      workId: work.id,
    },
  });
  return work.id;
}
