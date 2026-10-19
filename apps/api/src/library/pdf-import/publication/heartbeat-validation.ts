import { validationLeaseMs } from './validation-policy';
import type { PrismaService } from '../../../prisma/prisma.service';
import { jobTransaction } from '../jobs/transaction';
import {
  requireValidationRun,
  type ValidationAuthority,
} from './validation-authority';
export function heartbeatPdfValidation(
  prisma: PrismaService,
  authority: ValidationAuthority,
) {
  return jobTransaction(prisma, async (tx) => {
    const { run, job, now } = await requireValidationRun(tx, authority);
    const leaseExpiresAt = new Date(
      Math.min(now.getTime() + validationLeaseMs(), job.deadlineAt!.getTime()),
    );
    await tx.pdfValidationRun.update({
      where: { operationId: run.operationId },
      data: { leaseExpiresAt },
    });
    return {
      leaseRemainingMs: leaseExpiresAt.getTime() - now.getTime(),
      deadlineRemainingMs: job.deadlineAt!.getTime() - now.getTime(),
    };
  });
}
