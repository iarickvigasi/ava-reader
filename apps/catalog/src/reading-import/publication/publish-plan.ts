import { mainRequest } from '../main-request';
import type { MainStatus } from '../types';
import type { Approval } from './types';
export async function publishApproval(approval: Approval) {
  const query = new URLSearchParams({
    editionId: approval.editionId,
    checksum: approval.checksum,
  });
  const path = `reading-imports?${query}`;
  const before = await mainRequest<MainStatus>(path);
  assertReceipt(before, approval);
  if (before.status === 'READY' && before.syncPending === false)
    return 'already-published';
  if (
    before.status !== 'PROCESSED' &&
    !(before.status === 'READY' && before.syncPending === true)
  )
    throw new Error(
      `Draft is ${before.status}; not eligible for batch publication`,
    );
  await mainRequest(
    'reading-imports/publish',
    JSON.stringify({
      editionId: approval.editionId,
      checksum: approval.checksum,
      review: approval.review,
    }),
  );
  const after = await mainRequest<MainStatus>(path);
  assertReceipt(after, approval);
  if (after.status !== 'READY' || after.syncPending !== false)
    throw new Error(
      'Publication not confirmed; retry after checking synchronization',
    );
  return 'published';
}
function assertReceipt(status: MainStatus, approval: Approval) {
  if (
    status.editionId !== approval.editionId ||
    status.checksum !== approval.checksum ||
    !status.id ||
    typeof status.syncPending !== 'boolean'
  )
    throw new Error('Import receipt does not match reviewed bytes');
}
