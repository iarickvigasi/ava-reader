import { leaseClock } from './lease-clock';
import type { PrismaService } from '../../../prisma/prisma.service';
import { jobTransaction } from './transaction';
import { requireAttempt } from './authority';
import { PdfJobError } from './errors';
import type { AttemptAuthority, JobProgress, JobStage } from './types';
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
  const value =
    typeof progress === 'string'
      ? { stage: progress }
      : progress
        ? { ...progress }
        : undefined;
  return jobTransaction(prisma, async (tx) => {
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
