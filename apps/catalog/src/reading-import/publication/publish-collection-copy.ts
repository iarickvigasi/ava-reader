import type { Candidate, MainStatus } from '../types';
import { researchedWork } from '../evidence/researched-work';
import { mainRequest } from '../main-request';
import { mainApi } from '../main-api';
export async function publishCollectionCopy(
  candidate: Candidate,
  status: MainStatus,
) {
  if (
    researchedWork(candidate)?.publicationPolicy !==
      'PUBLISH_WITH_REVIEW_DEFERRED' ||
    !(
      status.status === 'PROCESSED' ||
      (status.status === 'READY' && status.syncPending)
    )
  )
    return status;
  await mainRequest(
    'reading-imports/publish',
    JSON.stringify({
      editionId: candidate.editionId,
      checksum: candidate.checksum,
      review: status.status === 'READY' ? undefined : { reviewDeferred: true },
    }),
  );
  const published = await mainApi(candidate);
  if (published.status !== 'READY' || published.syncPending !== false)
    throw new Error('Publication synchronization is pending; retry the import');
  return published;
}
