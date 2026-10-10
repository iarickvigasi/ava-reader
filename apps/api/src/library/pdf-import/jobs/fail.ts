import type { PrismaService } from '../../../prisma/prisma.service';
import type { AttemptAuthority, ExecutionFailure } from './types';
import { jobTransaction } from './transaction';
import { requireAttempt } from './authority';
import { recoverAttempt } from './recover-attempt';
import { PdfJobError } from './errors';
import { failureReason } from './failure-reason';
import { costLock } from '../providers/cost-lock';
import { recordOperationEvent } from '../reports/operation-event';
import {
  safeObservationWatermark,
  observationWatermarkDetails,
} from '../reports/observation-contract';
export function failPdfJob(
  prisma: PrismaService,
  authority: AttemptAuthority,
  code: ExecutionFailure,
  observationWatermark?: unknown,
) {
  if (!failureReason(code)) throw new PdfJobError('PDF_JOB_FAILURE_INVALID');
  const credential = { ...authority };
  const capture = safeObservationWatermark(
    observationWatermark,
    credential.attemptId,
  );
  return jobTransaction(prisma, async (tx) => {
    await costLock(tx);
    const { attempt, now } = await requireAttempt(tx, credential);
    if (code === 'DISPATCH_NOT_AUTHORIZED') {
      await tx.pdfJobAttempt.update({
        where: { id: attempt.id },
        data: { status: 'WAITING', finishedAt: now, failureCode: code },
      });
      await tx.pdfConversionJob.update({
        where: { id: attempt.jobId },
        data: { state: 'WAITING', waitReason: 'EXECUTION_AUTHORITY' },
      });
      await tx.pdfImportOperation.update({
        where: { id: attempt.job.operationId },
        data: { status: 'WAITING' },
      });
      await recordOperationEvent(
        tx,
        attempt.job.operationId,
        `wait:${attempt.id}:${code}`,
        {
          kind: 'RECOVERED',
          stage: attempt.job.operation.stage,
          severity: 'WARN',
          code,
          attemptId: attempt.id,
          attemptFence: attempt.fence,
          generation: attempt.job.operation.generation,
          cancellationEpoch: attempt.job.operation.cancellationEpoch,
          details: observationWatermarkDetails(
            capture,
            attempt.id,
            () => ({
              jobId: attempt.jobId,
              sourceSha256: attempt.job.operation.sourceSha256,
              configSha256: attempt.job.operation.configSha256,
              profileId: attempt.job.operation.profileId,
              workerFingerprint: attempt.job.workerFingerprint,
            }),
            true,
          ),
        },
        { status: 'WAITING' },
      );
      return { status: 'WAITING' as const };
    }
    return recoverAttempt(tx, attempt, now, code, capture);
  });
}
