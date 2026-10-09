import { randomBytes } from 'node:crypto';
import type { Prisma, PdfConversionJob } from '@prisma/client';
import type { JobInputV1 } from '../../../pdf-conversion/contracts/generated/ava-pdf-job-1';
import type { Tx } from './types';
import { secretDigest } from './secrets';
import { costLock } from '../providers/cost-lock';
import { recordOperationEvent } from '../reports/operation-event';
export async function startAttempt(
  tx: Tx,
  job: PdfConversionJob,
  input: JobInputV1,
  principalId: string,
  now: Date,
  deadline: Date,
  leaseMs: number,
) {
  await costLock(tx);
  const jobId = job.id,
    fence = input.attempt_fence,
    generation = input.generation;
  const attemptToken = randomBytes(32).toString('base64url');
  const leaseExpiresAt = new Date(
    Math.min(now.getTime() + leaseMs, deadline.getTime()),
  );
  const attempt = await tx.pdfJobAttempt.create({
    data: {
      jobId,
      principalId: principalId,
      fence,
      attemptTokenHash: secretDigest(attemptToken),
      jobInput: input as unknown as Prisma.InputJsonValue,
      leaseExpiresAt,
      deadlineAt: deadline,
    },
  });
  await tx.pdfConversionJob.update({
    where: { id: jobId },
    data: {
      state: 'RUNNING',
      workerFingerprint: input.worker_fingerprint,
      currentAttemptId: attempt.id,
      attemptFence: fence,
      attemptCount: { increment: 1 },
      startedAt: job.startedAt ?? now,
      deadlineAt: deadline,
      waitReason: null,
    },
  });
  await tx.pdfImportOperation.update({
    where: { id: input.operation_id },
    data: {
      status: 'RUNNING',
      stage: 'PREFLIGHT',
      generation,
      progressCompleted: null,
      progressTotal: null,
    },
  });
  await recordOperationEvent(
    tx,
    input.operation_id,
    `claimed:${attempt.id}`,
    {
      kind: 'CLAIMED',
      stage: 'PREFLIGHT',
      severity: 'INFO',
      attemptId: attempt.id,
      attemptFence: fence,
      generation,
      cancellationEpoch: input.cancellation_epoch,
      observedAt: now.toISOString(),
      details: {
        jobId,
        workerFingerprint: input.worker_fingerprint,
        sourceSha256: input.source.sha256,
        configSha256: input.config_sha256,
        profileId: input.profile_id,
        observationProtocol: {
          version: 1,
          producerId: attempt.id,
          scope: 'COORDINATOR_PRE_SETTLEMENT_WORKER_EVENT_DELIVERY',
        },
      },
    },
    {
      status: 'RUNNING',
      stage: 'PREFLIGHT',
      jobId,
      workerFingerprint: input.worker_fingerprint,
    },
  );
  return { attempt, attemptToken, leaseExpiresAt };
}
