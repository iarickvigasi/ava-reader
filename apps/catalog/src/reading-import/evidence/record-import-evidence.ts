import { attachImportedCover } from './attach-imported-cover';
import { Prisma } from '#catalog-client';
import type { CatalogDatabase } from '../../database/catalog-database';
import type { Candidate } from '../types';
import { assertCandidateMapping } from '../assert-candidate-mapping';
import {
  providerDownload,
  providerReference,
} from '../providers/provider-reference';
import { researchedWork } from './researched-work';
export async function recordImportEvidence(
  db: CatalogDatabase,
  candidate: Candidate,
  coverCatalogBlobId?: string | null,
) {
  if (!candidate.checksum || !candidate.filename || !candidate.inspectedAt)
    throw new Error('Inspected file evidence is required');
  const source = providerReference(candidate);
  const research = researchedWork(candidate);
  const data = {
    editionId: candidate.editionId,
    checksum: candidate.checksum,
    provider: source.provider,
    sourceUrl: source.sourceUrl,
    downloadUrl: providerDownload(candidate),
    filename: candidate.filename,
    inspectedAt: new Date(candidate.inspectedAt),
    research: research ? (research as Prisma.InputJsonValue) : Prisma.DbNull,
  };
  return db.$transaction(async (tx) => {
    await assertCandidateMapping(tx, candidate);
    await attachImportedCover(tx, candidate.editionId, coverCatalogBlobId);
    return tx.editionImportEvidence.upsert({
      where: {
        editionId_checksum: {
          editionId: data.editionId,
          checksum: data.checksum,
        },
      },
      create: data,
      update: data,
    });
  });
}
