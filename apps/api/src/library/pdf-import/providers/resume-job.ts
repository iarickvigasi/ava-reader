import type { PrismaService } from '../../../prisma/prisma.service';
import {
  jobTransaction,
  lockLibraryItem,
  databaseNow,
} from '../jobs/transaction';
import { costLock } from './cost-lock';
import { PdfProviderError } from './errors';
import { recordOperationEvent } from '../reports/operation-event';
// Operator recovery before terminal failure, never reader retry or content replacement.
export function resumeReconciledPdfJob(
  prisma: PrismaService,
  operationId: string,
) {
  return jobTransaction(prisma, async (tx) => {
    const initial = await tx.pdfImportOperation.findUniqueOrThrow({
      where: { id: operationId },
    });
    await lockLibraryItem(tx, initial.libraryItemId);
    await costLock(tx);
    const op = await tx.pdfImportOperation.findUniqueOrThrow({
      where: { id: operationId },
    });
    const job = await tx.pdfConversionJob.findUniqueOrThrow({
        where: { operationId },
        include: { dispatchAuthorization: { include: { route: true } } },
      }),
      grant = job.dispatchAuthorization,
      now = await databaseNow(tx);
    const attempt = job.currentAttemptId
      ? await tx.pdfJobAttempt.findUnique({
          where: { id: job.currentAttemptId },
          include: { principal: true },
        })
      : null;
    if (
      op.status !== 'WAITING' ||
      op.deletedAt ||
      op.finalContentId ||
      job.state !== 'WAITING' ||
      ![
        'INTERNAL_BUDGET',
        'PROVIDER_RECONCILIATION',
        'EXECUTION_AUTHORITY',
      ].includes(job.waitReason ?? '') ||
      !attempt ||
      attempt.status !== 'WAITING' ||
      attempt.principal.revokedAt ||
      job.attemptCount >= 3 ||
      !job.deadlineAt ||
      job.deadlineAt <= now ||
      !grant ||
      grant.state !== 'ACTIVE' ||
      grant.route.state !== 'ACTIVE' ||
      grant.route.verifiedAt > now ||
      grant.route.validUntil <= now ||
      (await tx.pdfProviderCall.count({
        where: {
          grantId: grant.id,
          state: { in: ['DISPATCHING', 'UNCERTAIN'] },
        },
      })) ||
      !(await tx.libraryItem.findFirst({
        where: { id: op.libraryItemId, userId: op.ownerId, bookId: op.bookId },
      }))
    )
      throw new PdfProviderError('PDF_PROVIDER_RESUME_UNAUTHORIZED');
    await tx.pdfConversionJob.update({
      where: { id: job.id },
      data: { state: 'QUEUED', waitReason: null, availableAt: now },
    });
    await tx.pdfImportOperation.update({
      where: { id: op.id },
      data: { status: 'QUEUED' },
    });
    await recordOperationEvent(
      tx,
      op.id,
      `provider-resume:${attempt.id}:${op.generation}`,
      {
        kind: 'RECOVERED',
        stage: op.stage,
        severity: 'INFO',
        attemptId: attempt.id,
        details: {},
      },
      { status: 'QUEUED' },
    );
    return { operationId, status: 'QUEUED' };
  });
}
