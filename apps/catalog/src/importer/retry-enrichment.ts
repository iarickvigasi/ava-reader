import type { SourceMapping } from '#catalog-client';
import { references, object } from './raw-fields';
import { openLibraryCover } from './open-library-cover';
import { CATEGORY_VERSION } from './reader-categories';
import type { Raw, Tx } from './types';

export async function retryEnrichment(
  tx: Tx,
  mapping: SourceMapping,
  raw: Raw,
) {
  const keys = references(raw.authors, 'authors');
  const authors = await tx.sourceMapping.findMany({
    where: {
      sourceId: mapping.sourceId,
      entityKind: 'AUTHOR',
      externalId: { in: keys },
    },
    select: { authorId: true },
  });
  const expected = authors.flatMap((row) => row.authorId ?? []).sort();
  const target = mapping.workId
    ? await tx.work.findUniqueOrThrow({
        where: { id: mapping.workId },
        include: { credits: true },
      })
    : await tx.edition.findUniqueOrThrow({
        where: { id: mapping.editionId! },
        include: { credits: true },
      });
  const actual = target.credits
    .filter((credit) => credit.role === 'AUTHOR')
    .map((credit) => credit.authorId)
    .sort();
  const cover = openLibraryCover(raw.covers);
  const needsWrite =
    JSON.stringify(expected) !== JSON.stringify(actual) ||
    (cover.coverId !== undefined && cover.coverId !== target.coverId) ||
    (cover.coverImageUrl !== undefined &&
      cover.coverImageUrl !== target.coverImageUrl) ||
    (mapping.workId &&
      raw.subjects !== undefined &&
      object(target).categoryVersion !== CATEGORY_VERSION);
  return {
    needsWrite: !!needsWrite,
    incomplete: expected.length < keys.length,
  };
}
