import { Logger } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ClaimedPdfJob } from '../../library/pdf-import/jobs';
import { requireAttempt } from '../../library/pdf-import/jobs/authority';
import { tryQueueLock } from '../../library/pdf-import/jobs/transaction';
import { tryCostLock } from '../../library/pdf-import/providers/cost-lock';
import { recordOperationEvent } from '../../library/pdf-import/reports/operation-event';
import {
  safeEventSchema,
  type SafeConversionEvent,
} from '../../library/pdf-import/reports/event-contract';

const logger = new Logger('PdfWorkerObservation');
// Optional observations never delay source/provider work or renew authority.
// A bounded queue and short transaction bound their independent resource cost.
export function workerObservationSink(
  prisma: PrismaService,
  claim: ClaimedPdfJob,
) {
  const authority = { ...claim.authority },
    job = structuredClone(claim.job),
    jobId = claim.jobId;
  let tail = Promise.resolve(),
    pending = 0,
    lost = 0,
    ordinal = 0;
  const summary = () => ({
    pending,
    lost,
    state: lost
      ? ('PARTIAL' as const)
      : pending
        ? ('PENDING' as const)
        : ('RECORDED' as const),
  });
  return {
    summary,
    whenSettled: () => tail,
    emit(event: SafeConversionEvent) {
      const parsed = safeEventSchema.safeParse(event);
      if (!parsed.success || pending >= 16) {
        lost++;
        logger.warn('PDF_WORKER_OBSERVATION_NOT_RECORDED');
        return;
      }
      const unit = parsed.data.details.unitId ?? `capture-${++ordinal}`;
      const key = `worker-observation:${authority.attemptId}:${unit}:${parsed.data.stage}:${parsed.data.kind}`;
      pending++;
      tail = tail.then(async () => {
        try {
          await prisma.$transaction(
            async (tx) => {
              if (!(await tryQueueLock(tx)) || !(await tryCostLock(tx)))
                throw new Error('PDF_WORKER_OBSERVATION_BUSY');
              const scope = await requireAttempt(tx, authority, true);
              if (
                scope.job.operation_id !== job.operation_id ||
                scope.job.source.sha256 !== job.source.sha256 ||
                scope.job.config_sha256 !== job.config_sha256 ||
                scope.job.profile_id !== job.profile_id ||
                scope.job.worker_fingerprint !== job.worker_fingerprint ||
                scope.job.generation !== job.generation ||
                scope.job.attempt_fence !== job.attempt_fence ||
                scope.job.cancellation_epoch !== job.cancellation_epoch ||
                (jobId && scope.attempt.jobId !== jobId)
              )
                throw new Error('PDF_WORKER_OBSERVATION_FENCE_INVALID');
              await recordOperationEvent(
                tx,
                job.operation_id,
                key,
                parsed.data,
              );
            },
            { maxWait: 100, timeout: 750 },
          );
        } catch {
          lost++;
          logger.warn('PDF_WORKER_OBSERVATION_NOT_RECORDED');
        } finally {
          pending--;
        }
      });
    },
  };
}
