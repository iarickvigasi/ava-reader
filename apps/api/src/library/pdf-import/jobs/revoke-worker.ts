import type { PrismaService } from '../../../prisma/prisma.service';
import { jobTransaction, databaseNow, lockLibraryItem } from './transaction';
import { stopOperation } from './stop-internal';
export async function revokePdfWorker(
  prisma: PrismaService,
  principalId: string,
) {
  await jobTransaction(prisma, async (tx) => {
    await tx.pdfWorkerPrincipal.updateMany({
      where: { id: principalId, revokedAt: null },
      data: { revokedAt: await databaseNow(tx) },
    });
  });
  // Revocation commits first: all attempt access fails even if cleanup is interrupted.
  const attempts = await prisma.pdfJobAttempt.findMany({
    where: {
      principalId,
      job: { state: { in: ['RUNNING', 'WAITING', 'QUEUED'] } },
    },
    select: { id: true, jobId: true },
  });
  let stopped = 0;
  for (const attempt of attempts)
    stopped += await jobTransaction(prisma, async (tx) => {
      const job = await tx.pdfConversionJob.findUniqueOrThrow({
        where: { id: attempt.jobId },
        include: { operation: true },
      });
      if (
        job.currentAttemptId !== attempt.id ||
        ['FAILED', 'STOPPED'].includes(job.state)
      )
        return 0;
      await lockLibraryItem(tx, job.operation.libraryItemId);
      const op = await tx.pdfImportOperation.findUniqueOrThrow({
        where: { id: job.operationId },
      });
      await stopOperation(tx, op, await databaseNow(tx), 'EXECUTION_REVOKED');
      return 1;
    });
  return { principalId, stopped };
}
