import { stopOperation } from './stop-internal';
import { leaseClock } from './lease-clock';
import type { PdfWorkerPrincipal } from '@prisma/client';
import { parseJobPolicy, ARTIFACT_BYTE_LIMIT } from './policy';
import { lockLibraryItem } from './transaction';
import { createJobInput } from './claim-input';
import { startAttempt } from './start-attempt';
import { terminalFailure } from './terminal-failure';
import type { Tx, WorkerCredential, ClaimedPdfJob } from './types';
export async function claimOne(
  tx: Tx,
  jobId: string,
  principal: PdfWorkerPrincipal,
  credential: WorkerCredential,
  now: Date,
): Promise<ClaimedPdfJob | null> {
  const initial = await tx.pdfConversionJob.findUniqueOrThrow({
    where: { id: jobId },
    include: { operation: true },
  });
  await lockLibraryItem(tx, initial.operation.libraryItemId);
  const job = await tx.pdfConversionJob.findUniqueOrThrow({
    where: { id: jobId },
    include: { operation: { include: { sourceArtifact: true, book: true } } },
  });
  const op = job.operation,
    policy = parseJobPolicy(job.policy);
  if (
    job.state !== 'QUEUED' ||
    op.status !== 'QUEUED' ||
    op.deletedAt ||
    !(await tx.libraryItem.findFirst({
      where: { id: op.libraryItemId, userId: op.ownerId, bookId: op.bookId },
    }))
  )
    return null;
  if (
    job.attemptCount >= policy.maxAttempts ||
    (job.deadlineAt && job.deadlineAt <= now)
  ) {
    await terminalFailure(tx, {
      job,
      operation: op,
      code: 'EXECUTION_TIMEOUT',
      now,
    });
    return null;
  }
  if (
    job.currentAttemptId &&
    (await tx.pdfJobAttempt.findFirst({
      where: {
        id: job.currentAttemptId,
        principal: { revokedAt: { not: null } },
      },
    }))
  ) {
    await stopOperation(tx, op, now, 'EXECUTION_REVOKED');
    return null;
  }
  const deadline =
    job.deadlineAt ?? new Date(now.getTime() + policy.totalTimeoutMs);
  const fence = job.attemptFence + 1,
    generation = op.generation + (job.attemptCount ? 1 : 0);
  const input = createJobInput({
    op,
    source: op.sourceArtifact,
    policy,
    fingerprint: principal.workerFingerprint,
    fence,
    generation,
    mode: job.providerMode,
    dispatchAuthorizationId: job.dispatchAuthorizationId,
    now,
    deadline,
    pages: op.book.estimatedPageCount ?? 500,
  });
  const { attempt, attemptToken, leaseExpiresAt } = await startAttempt(
    tx,
    job,
    input,
    principal.id,
    now,
    deadline,
    policy.leaseMs,
  );
  return {
    ...(await leaseClock(tx, leaseExpiresAt, deadline)),
    authority: { ...credential, attemptId: attempt.id, attemptToken },
    job: input,
    leaseExpiresAt,
    deadlineAt: deadline,
    artifactByteLimit: ARTIFACT_BYTE_LIMIT,
  };
}
