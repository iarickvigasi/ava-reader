import type { PrismaService } from '../../../prisma/prisma.service';
import type { AttemptAuthority } from '../jobs';
import { jobTransaction } from '../jobs/transaction';
import { requireAttempt } from '../jobs/authority';
import { PdfProviderError } from './errors';
import { costLock } from './cost-lock';
import { recordOperationEvent } from '../reports/operation-event';
const reasons: Record<string, string> = {
  PDF_PROVIDER_BUDGET_EXHAUSTED: 'INTERNAL_BUDGET',
  PDF_PROVIDER_OUTCOME_UNCERTAIN: 'PROVIDER_RECONCILIATION',
  PDF_PROVIDER_ROUTE_UNAVAILABLE: 'EXECUTION_AUTHORITY',
};
export function waitPdfJobForProvider(
  prisma: PrismaService,
  authority: AttemptAuthority,
  code: string,
) {
  const credential = { ...authority };
  if (!Object.hasOwn(reasons, code))
    throw new PdfProviderError('PDF_PROVIDER_WAIT_INVALID');
  return jobTransaction(prisma, async (tx) => {
    await costLock(tx);
    const { attempt, now } = await requireAttempt(tx, credential);
    await tx.pdfJobAttempt.update({
      where: { id: attempt.id },
      data: { status: 'WAITING', finishedAt: now, failureCode: code },
    });
    await tx.pdfConversionJob.update({
      where: { id: attempt.jobId },
      data: { state: 'WAITING', waitReason: reasons[code] },
    });
    await tx.pdfImportOperation.update({
      where: { id: attempt.job.operationId },
      data: { status: 'WAITING' },
    });
    await recordOperationEvent(
      tx,
      attempt.job.operationId,
      `provider-wait:${attempt.id}:${code}`,
      {
        kind: 'RECOVERED',
        stage: attempt.job.operation.stage,
        severity: 'WARN',
        code,
        attemptId: attempt.id,
        details: {},
      },
      { status: 'WAITING' },
    );
    return { status: 'WAITING' as const };
  });
}
