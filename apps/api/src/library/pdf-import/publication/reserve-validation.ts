import { startValidationRun } from './start-validation-run';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { WorkerCredential } from '../jobs/types';
import { jobTransaction, databaseNow } from '../jobs/transaction';
import { authenticateWorker } from '../jobs/authenticate-worker';
import { terminalFailure } from '../jobs/terminal-failure';
import { reconcileCandidate } from './reconcile-candidate';
import { PdfPublicationError } from './errors';
export async function reservePdfValidation(
  prisma: PrismaService,
  credential: WorkerCredential,
  fingerprint: string,
  excludedOperationIds: string[] = [],
) {
  const worker = { ...credential };
  return jobTransaction(prisma, async (tx) => {
    const principal = await authenticateWorker(tx, worker),
      now = await databaseNow(tx);
    if (principal.workerFingerprint !== fingerprint)
      throw new PdfPublicationError('PDF_VALIDATION_AUTHORITY_INVALID');
    const candidates = await tx.pdfImportOperation.findMany({
      where: {
        id: { notIn: excludedOperationIds.slice(0, 100) },
        status: 'WAITING',
        deletedAt: null,
        job: { state: 'WAITING', waitReason: 'REVIEW' },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    for (const op of candidates) {
      const scope = await reconcileCandidate(tx, op.id, now);
      if (!scope) continue;
      const validation = await tx.pdfCandidateValidation.findUnique({
        where: {
          attemptId_validatorFingerprint: {
            attemptId: scope.attempt.id,
            validatorFingerprint: fingerprint,
          },
        },
        include: { review: true },
      });
      if (validation) {
        if (
          validation.hardBlocks.length ||
          validation.review?.decision === 'REJECT'
        ) {
          await terminalFailure(tx, {
            job: scope.job,
            operation: scope.op,
            candidateAttemptId: scope.attempt.id,
            code: 'INVALID_RESULT',
            now,
          });
          return { kind: 'failed' as const, operationId: op.id };
        }
        if (validation.reviewFindings.length && !validation.review) continue;
        return {
          kind: 'publish' as const,
          operationId: op.id,
          validationId: validation.id,
        };
      }
      if (!scope.job.deadlineAt || scope.job.deadlineAt <= now) {
        await terminalFailure(tx, {
          job: scope.job,
          operation: scope.op,
          candidateAttemptId: scope.attempt.id,
          code: 'EXECUTION_TIMEOUT',
          now,
        });
        return { kind: 'failed' as const, operationId: op.id };
      }
      const prior = await tx.pdfValidationRun.findUnique({
        where: { operationId: op.id },
      });
      if (
        prior &&
        (prior.availableAt > now ||
          (prior.state === 'RUNNING' &&
            prior.leaseExpiresAt &&
            prior.leaseExpiresAt > now))
      )
        continue;
      if ((prior?.attempts ?? 0) >= 3) {
        await terminalFailure(tx, {
          job: scope.job,
          operation: op,
          candidateAttemptId: scope.attempt.id,
          code: 'EXECUTION_TIMEOUT',
          now,
        });
        return { kind: 'failed' as const, operationId: op.id };
      }
      const claimed = await startValidationRun(tx, scope, prior, worker, now);
      if (claimed) return claimed;
    }
    return { kind: 'idle' as const };
  });
}
