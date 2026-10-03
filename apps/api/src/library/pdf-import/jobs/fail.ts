import type { PrismaService } from '../../../prisma/prisma.service';
import type { AttemptAuthority, ExecutionFailure } from './types';
import { jobTransaction } from './transaction';
import { requireAttempt } from './authority';
import { recoverAttempt } from './recover-attempt';
import { PdfJobError } from './errors';
import { failureReason } from './failure-reason';
export function failPdfJob(
  prisma: PrismaService,
  authority: AttemptAuthority,
  code: ExecutionFailure,
) {
  if (!failureReason(code)) throw new PdfJobError('PDF_JOB_FAILURE_INVALID');
  const credential = { ...authority };
  return jobTransaction(prisma, async (tx) => {
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
      return { status: 'WAITING' as const };
    }
    return recoverAttempt(tx, attempt, now, code);
  });
}
