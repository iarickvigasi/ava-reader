import type { PrismaService } from '../../../prisma/prisma.service';
import { jobTransaction } from '../jobs/transaction';
import { terminalFailure } from '../jobs/terminal-failure';
import {
  requireValidationRun,
  type ValidationAuthority,
} from './validation-authority';
import type { ConversionWorkTiming } from '../reports/work-timing';
export function failPdfValidation(
  prisma: PrismaService,
  authority: ValidationAuthority,
  contentInvalid: boolean,
  work?: ConversionWorkTiming,
) {
  return jobTransaction(prisma, async (tx) => {
    const { op, job, attempt, run, now } = await requireValidationRun(
      tx,
      authority,
    );
    const terminal = contentInvalid || run.attempts >= 3;
    await tx.pdfValidationRun.update({
      where: { operationId: op.id },
      data: {
        state: terminal ? 'FAILED' : 'WAITING',
        leaseExpiresAt: null,
        tokenHash: null,
        lastFailureCode: contentInvalid
          ? 'INVALID_RESULT'
          : 'VALIDATOR_UNAVAILABLE',
        availableAt: new Date(now.getTime() + 1000),
      },
    });
    if (terminal)
      return terminalFailure(tx, {
        job,
        operation: op,
        candidateAttemptId: attempt.id,
        code: contentInvalid ? 'INVALID_RESULT' : 'WORKER_CRASH',
        now,
        work,
        validationFence: run.fence,
      });
    return { status: 'retry_wait' as const };
  });
}
