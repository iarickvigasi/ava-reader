import type { Prisma } from '@prisma/client';
import type { WorkerResultV1 } from '../../../pdf-conversion/contracts/generated/ava-pdf-worker-result-1';
import type { AttemptRecord, Tx } from './types';
import { terminalFailure } from './terminal-failure';
export async function acceptResult(
  tx: Tx,
  attempt: AttemptRecord,
  result: WorkerResultV1,
  resultSha256: string,
  artifactMap: Record<string, string>,
  now: Date,
) {
  await tx.pdfJobAttempt.update({
    where: { id: attempt.id },
    data: {
      resultSha256,
      result: result as unknown as Prisma.InputJsonValue,
      artifactMap,
    },
  });
  if (result.outcome.status !== 'candidate')
    return terminalFailure(tx, {
      job: attempt.job,
      operation: attempt.job.operation,
      attemptId: attempt.id,
      code:
        result.outcome.status === 'unsupported'
          ? 'UNSUPPORTED_PDF'
          : 'CONVERSION_FAILED',
      now,
    });
  await tx.pdfJobAttempt.update({
    where: { id: attempt.id },
    data: { status: 'CANDIDATE', finishedAt: now },
  });
  await tx.pdfConversionJob.update({
    where: { id: attempt.jobId },
    data: { state: 'WAITING', waitReason: 'REVIEW' },
  });
  await tx.pdfImportOperation.update({
    where: { id: attempt.job.operationId },
    data: { status: 'WAITING', stage: 'VALIDATION' },
  });
  return {
    status: 'WAITING' as const,
    candidateId: result.outcome.candidate_id,
  };
}
