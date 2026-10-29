import type { CatalogDatabase } from '../database/catalog-database';
import type { findClassicEditions } from './find-classic-editions';
import { iaIdentifiers } from './ia-identifiers';
import type { Candidate } from './types';

type Edition = Awaited<ReturnType<typeof findClassicEditions>>[number];
export async function editionCandidates(
  db: CatalogDatabase,
  edition: Edition,
): Promise<Candidate[]> {
  if (!edition.language) return [];
  const mapping = edition.sourceMappings[0];
  if (!mapping?.payloadHash || !mapping.sourceRevision) return [];
  const record = await db.importRecord.findFirst({
    where: {
      externalId: mapping.externalId,
      payloadHash: mapping.payloadHash,
      run: { sourceId: mapping.sourceId, status: 'STAGED' },
      status: { in: ['APPLIED', 'SKIPPED'] },
    },
    select: { payload: true },
  });
  if (!record?.payload || typeof record.payload !== 'object') return [];
  return iaIdentifiers(record.payload as Record<string, unknown>).map(
    (iaIdentifier) => ({
      editionId: edition.id,
      workId: edition.workId,
      externalId: mapping.externalId,
      sourceRevision: mapping.sourceRevision!,
      sourcePayloadHash: mapping.payloadHash!,
      title: edition.title,
      language: edition.language!,
      iaIdentifier,
      authors: edition.work.credits.map((credit) => credit.author.displayName),
      review: null,
    }),
  );
}
