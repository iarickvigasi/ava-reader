import { leaseClock } from './lease-clock';
import type { PrismaService } from '../../../prisma/prisma.service';
import { jobTransaction } from './transaction';
import { requireAttempt } from './authority';
import { PdfJobError } from './errors';
import type { AttemptAuthority, JobProgress, JobStage } from './types';
import { costLock } from '../providers/cost-lock';
import { recordOperationEvent } from '../reports/operation-event';
import {
  safeObservationWatermark,
  observationWatermarkDetails,
} from '../reports/observation-contract';
const STAGES: JobStage[] = [
  'PREFLIGHT',
  'EXTRACTION',
  'RECONSTRUCTION',
  'ASSEMBLY',
  'VALIDATION',
];
export function heartbeatPdfJob(
  prisma: PrismaService,
  authority: AttemptAuthority,
  progress?: JobStage | JobProgress,
) {
  const credential = { ...authority };
  const capture = (() => {
    try {
      return typeof progress === 'object'
        ? safeObservationWatermark(
            progress.observationWatermark,
            credential.attemptId,
          )
        : undefined;
    } catch {
      return undefined;
    }
  })();
  const value =
    typeof progress === 'string'
      ? { stage: progress }
      : progress
        ? {
            stage: progress.stage,
            completed: progress.completed,
            total: progress.total,
          }
        : undefined;
  return jobTransaction(prisma, async (tx) => {
    if (value) await costLock(tx);
    const { attempt, job, now, policy } = await requireAttempt(tx, credential);
    const op = attempt.job.operation;
    if (
      value &&
      (STAGES.indexOf(value.stage) < STAGES.indexOf(op.stage as JobStage) ||
        !STAGES.includes(value.stage) ||
        (value.completed !== undefined &&
          (!Number.isSafeInteger(value.completed) ||
            value.completed < (op.progressCompleted ?? 0))) ||
        (value.total !== undefined &&
          (!Number.isSafeInteger(value.total) ||
            value.total < 1 ||
            value.total > job.source_page_limit ||
            (op.progressTotal !== null && value.total !== op.progressTotal))) ||
        (value.completed !== undefined &&
          value.completed > (value.total ?? op.progressTotal ?? 0)))
    )
      throw new PdfJobError('PDF_JOB_PROGRESS_INVALID');
    const leaseExpiresAt = new Date(
      Math.min(now.getTime() + policy.leaseMs, attempt.deadlineAt.getTime()),
    );
    if (
      value &&
      (value.stage !== op.stage ||
        (value.completed !== undefined &&
          value.completed !== op.progressCompleted) ||
        (value.total !== undefined && value.total !== op.progressTotal))
    )
      await recordOperationEvent(
        tx,
        op.id,
        `progress:${attempt.id}:${value.stage}:${value.completed ?? ''}:${value.total ?? ''}`,
        {
          kind: value.stage !== op.stage ? 'STAGE_STARTED' : 'PROGRESS',
          stage: value.stage,
          severity: 'INFO',
          attemptId: attempt.id,
          attemptFence: attempt.fence,
          generation: op.generation,
          cancellationEpoch: op.cancellationEpoch,
          details: {
            completed: value.completed,
            total: value.total,
            ...observationWatermarkDetails(capture, attempt.id, () => ({
              jobId: attempt.jobId,
              sourceSha256: job.source.sha256,
              configSha256: job.config_sha256,
              profileId: job.profile_id,
              workerFingerprint: job.worker_fingerprint,
            })),
          },
        },
        { stage: value.stage },
      );
    await tx.pdfJobAttempt.update({
      where: { id: attempt.id },
      data: {
        leaseExpiresAt,
        stage: value?.stage,
        progressCompleted: value?.completed,
        progressTotal: value?.total,
      },
    });
    if (value)
      await tx.pdfImportOperation.update({
        where: { id: op.id },
        data: {
          stage: value.stage,
          progressCompleted: value.completed,
          progressTotal: value.total,
        },
      });
    return {
      leaseExpiresAt,
      ...(await leaseClock(tx, leaseExpiresAt, attempt.deadlineAt)),
    };
  });
}
