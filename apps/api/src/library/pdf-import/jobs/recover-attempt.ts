import type { AttemptRecord, ExecutionFailure, Tx } from './types';
import { parseJobPolicy } from './policy';
import { terminalFailure } from './terminal-failure';
import { costLock } from '../providers/cost-lock';
import { recordOperationEvent } from '../reports/operation-event';
export async function recoverAttempt(
  tx: Tx,
  attempt: AttemptRecord,
  now: Date,
  code: ExecutionFailure,
) {
  await costLock(tx);
  const { job } = attempt,
    op = job.operation,
    policy = parseJobPolicy(job.policy);
  if (
    !['WORKER_CRASH', 'LEASE_EXPIRED'].includes(code) ||
    job.attemptCount >= policy.maxAttempts ||
    !job.deadlineAt ||
    job.deadlineAt <= now
  )
    return terminalFailure(tx, {
      job,
      operation: op,
      attemptId: attempt.id,
      code:
        job.deadlineAt && job.deadlineAt <= now ? 'EXECUTION_TIMEOUT' : code,
      now,
    });
  await tx.pdfJobAttempt.update({
    where: { id: attempt.id },
    data: {
      status: code === 'LEASE_EXPIRED' ? 'EXPIRED' : 'RETRY',
      failureCode: code,
      finishedAt: now,
    },
  });
  await tx.pdfConversionJob.update({
    where: { id: job.id },
    data: {
      state: 'QUEUED',
      availableAt: new Date(now.getTime() + policy.retryDelayMs),
    },
  });
  await tx.pdfImportOperation.update({
    where: { id: op.id },
    data: { status: 'QUEUED' },
  });
  await recordOperationEvent(
    tx,
    op.id,
    `recovery:${attempt.id}:${code}`,
    {
      kind: 'RECOVERED',
      stage: op.stage,
      severity: 'WARN',
      code,
      attemptId: attempt.id,
      attemptFence: attempt.fence,
      generation: op.generation,
      cancellationEpoch: op.cancellationEpoch,
      observedAt: now.toISOString(),
      details: { jobId: job.id },
    },
    { status: 'QUEUED' },
  );
  return { status: 'QUEUED' as const };
}
