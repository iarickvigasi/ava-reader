import type { PrismaService } from '../../../prisma/prisma.service';
import { jobTransaction, databaseNow } from '../jobs/transaction';
import { candidateAuthority } from './candidate-authority';
import { terminalFailure } from '../jobs/terminal-failure';
import { PdfPublicationError } from './errors';
export function rejectPdfCandidate(
  prisma: PrismaService,
  operationId: string,
  code: 'INVALID_RESULT' | 'CONVERSION_FAILED',
) {
  if (!['INVALID_RESULT', 'CONVERSION_FAILED'].includes(code))
    throw new PdfPublicationError('PDF_REJECTION_INVALID');
  return jobTransaction(prisma, async (tx) => {
    const previous = await tx.pdfImportOperation.findUnique({
      where: { id: operationId },
    });
    if (previous?.status === 'FAILED' && !previous.deletedAt)
      return { status: 'FAILED' as const, failureId: previous.failureId };
    const { op, job, attempt } = await candidateAuthority(tx, operationId);
    return terminalFailure(tx, {
      job,
      operation: op,
      candidateAttemptId: attempt.id,
      code,
      now: await databaseNow(tx),
    });
  });
}
