import { JobAuthorityError } from './errors';
import type { AttemptRecord } from './types';
import { validateStructure } from '../../../pdf-conversion/contracts/validate-structure';
export function assertAttemptScope(
  attempt: AttemptRecord,
  now: Date,
  allowReceipt: boolean,
) {
  const { job } = attempt,
    op = job.operation;
  const input = validateStructure('ava-pdf-job-1', attempt.jobInput);
  if (
    op.deletedAt ||
    op.finalContentId ||
    job.currentAttemptId !== attempt.id ||
    job.attemptFence !== attempt.fence ||
    input.profile_id !== op.profileId ||
    input.provider_mode !== job.providerMode ||
    (input.provider_mode === 'live' &&
      input.dispatch_authority_id !== job.dispatchAuthorizationId) ||
    input.operation_id !== op.id ||
    input.owner_id !== op.ownerId ||
    input.library_item_id !== op.libraryItemId ||
    input.source.sha256 !== op.sourceSha256 ||
    input.source.id !== op.sourceArtifactId ||
    input.config_sha256 !== op.configSha256 ||
    input.request_sha256 !== op.requestSha256 ||
    input.generation !== op.generation ||
    input.cancellation_epoch !== op.cancellationEpoch ||
    input.attempt_fence !== attempt.fence ||
    input.worker_fingerprint !== job.workerFingerprint
  )
    throw new JobAuthorityError();
  const receipt =
    allowReceipt &&
    attempt.resultSha256 &&
    ['CANDIDATE', 'FAILED'].includes(attempt.status) &&
    ['WAITING', 'FAILED'].includes(op.status);
  if (
    !receipt &&
    (attempt.status !== 'RUNNING' ||
      job.state !== 'RUNNING' ||
      op.status !== 'RUNNING' ||
      attempt.leaseExpiresAt <= now ||
      attempt.deadlineAt <= now)
  )
    throw new JobAuthorityError();
  return input;
}
