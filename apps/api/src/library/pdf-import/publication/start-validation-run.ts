import { hasClaimCapacity } from '../jobs/claim-capacity';
import { parseJobPolicy } from '../jobs/policy';
import { validationLeaseMs } from './validation-policy';
import { randomBytes } from 'node:crypto';
import type { PdfValidationRun } from '@prisma/client';
import type { Tx, WorkerCredential } from '../jobs/types';
import { secretDigest } from '../jobs/secrets';
import type { candidateAuthority } from './candidate-authority';
export async function startValidationRun(
  tx: Tx,
  scope: Awaited<ReturnType<typeof candidateAuthority>>,
  prior: PdfValidationRun | null,
  worker: WorkerCredential,
  now: Date,
) {
  const op = scope.op,
    principal = { id: worker.principalId };
  if (
    !(await hasClaimCapacity(
      tx,
      parseJobPolicy(scope.job.policy),
      op.ownerId,
      principal.id,
      now,
    ))
  )
    return null;
  const validationToken = randomBytes(32).toString('hex'),
    fence = (prior?.fence ?? 0) + 1;
  const leaseExpiresAt = new Date(
    Math.min(
      now.getTime() + validationLeaseMs(),
      scope.job.deadlineAt!.getTime(),
    ),
  );
  const data = {
    attemptId: scope.attempt.id,
    attempts: (prior?.attempts ?? 0) + 1,
    fence,
    state: 'RUNNING',
    principalId: principal.id,
    tokenHash: secretDigest(validationToken),
    leaseExpiresAt,
    availableAt: now,
    lastFailureCode: null,
  };
  await tx.pdfValidationRun.upsert({
    where: { operationId: op.id },
    create: { operationId: op.id, ...data },
    update: data,
  });
  return {
    kind: 'validate' as const,
    operationId: op.id,
    authority: { ...worker, operationId: op.id, fence, validationToken },
    leaseRemainingMs: leaseExpiresAt.getTime() - now.getTime(),
    deadlineRemainingMs: scope.job.deadlineAt!.getTime() - now.getTime(),
  };
}
