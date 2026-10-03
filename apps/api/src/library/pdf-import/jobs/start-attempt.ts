import { randomBytes } from 'node:crypto';
import type { Prisma, PdfConversionJob } from '@prisma/client';
import type { JobInputV1 } from '../../../pdf-conversion/contracts/generated/ava-pdf-job-1';
import type { Tx } from './types';
import { secretDigest } from './secrets';
export async function startAttempt(
  tx: Tx,
  job: PdfConversionJob,
  input: JobInputV1,
  principalId: string,
  now: Date,
  deadline: Date,
  leaseMs: number,
) {
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
  return { attempt, attemptToken, leaseExpiresAt };
}
