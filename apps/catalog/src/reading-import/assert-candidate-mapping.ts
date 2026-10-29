import { providerReference } from './providers/provider-reference';
import type { CatalogDatabase } from '../database/catalog-database';
import { iaIdentifiers } from './ia-identifiers';
import { candidateSource } from './candidate-source';
import type { Candidate } from './types';

export async function assertCandidateMapping(
  db: Pick<CatalogDatabase, 'sourceMapping' | 'importRecord'>,
  candidate: Candidate,
) {
  const mapping = await db.sourceMapping.findFirst({
    where: {
      source: { key: candidateSource(candidate) },
      entityKind: 'EDITION',
      externalId: candidate.externalId,
      editionId: candidate.editionId,
      sourceRevision: candidate.sourceRevision,
      payloadHash: candidate.sourcePayloadHash,
      edition: {
        workId: candidate.workId,
        language: candidate.language,
        work: { deletedAt: null },
      },
    },
  });
  if (!mapping)
    throw new Error(
      'Candidate metadata changed or edition identity is invalid; regenerate inventory',
    );
  const raw = await db.importRecord.findFirst({
    where: {
      externalId: mapping.externalId,
      payloadHash: mapping.payloadHash,
      run: { sourceId: mapping.sourceId, status: 'STAGED' },
      status: { in: ['APPLIED', 'SKIPPED'] },
    },
    select: { payload: true },
  });
  const source = providerReference(candidate);
  const payload = raw?.payload as Record<string, unknown> | undefined;
  const linked =
    source.provider === 'internet-archive'
      ? payload && iaIdentifiers(payload).includes(source.id)
      : payload?.provider === source.provider &&
        payload.providerId === source.id &&
        payload.sourceUrl === source.sourceUrl;
  if (!linked)
    throw new Error('Provider item is not linked to this source edition');
}
