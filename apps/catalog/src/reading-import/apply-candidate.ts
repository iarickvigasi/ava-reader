import { publishCollectionCopy } from './publication/publish-collection-copy';
import { recordImportEvidence } from './evidence/record-import-evidence';
import { setTimeout as delay } from 'node:timers/promises';
import type { CatalogDatabase } from '../database/catalog-database';
import { assertCandidateMapping } from './assert-candidate-mapping';
import { loadReviewedBytes } from './load-reviewed-bytes';
import { mainApi } from './main-api';
import type { Candidate } from './types';

export async function applyCandidate(
  db: CatalogDatabase,
  candidate: Candidate,
) {
  await assertCandidateMapping(db, candidate);
  const bytes = await loadReviewedBytes(candidate);
  let status = await mainApi(candidate, bytes);
  for (
    let attempt = 0;
    status.status === 'PENDING' && attempt < 30;
    attempt++
  ) {
    await delay(2000);
    status = await mainApi(candidate);
  }
  if (status.status === 'FAILED')
    throw new Error(
      `Reader processing failed: ${status.error ?? 'unknown error'}`,
    );
  await recordImportEvidence(db, candidate, status.coverCatalogBlobId);
  return publishCollectionCopy(candidate, status);
}
