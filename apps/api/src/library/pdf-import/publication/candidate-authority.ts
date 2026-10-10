import type { Tx } from '../jobs/types';
import { lockLibraryItem } from '../jobs/transaction';
import { PdfPublicationError } from './errors';
export async function candidateAuthority(tx: Tx, operationId: string) {
  const initial = await tx.pdfImportOperation.findUnique({
    where: { id: operationId },
  });
  if (!initial) throw new PdfPublicationError('PDF_PUBLICATION_UNAVAILABLE');
  await lockLibraryItem(tx, initial.libraryItemId);
  const op = await tx.pdfImportOperation.findUniqueOrThrow({
    where: { id: operationId },
  });
  const job = await tx.pdfConversionJob.findUnique({ where: { operationId } });
  const attempt = job?.currentAttemptId
    ? await tx.pdfJobAttempt.findUnique({
        where: { id: job.currentAttemptId },
        include: { principal: true },
      })
    : null;
  if (
    op.status !== 'WAITING' ||
    op.deletedAt ||
    op.finalContentId ||
    !job ||
    job.state !== 'WAITING' ||
    job.waitReason !== 'REVIEW' ||
    !attempt ||
    attempt.status !== 'CANDIDATE' ||
    attempt.principal.revokedAt ||
    attempt.fence !== job.attemptFence ||
    !attempt.resultSha256 ||
    !(await tx.libraryItem.findFirst({
      where: { id: op.libraryItemId, userId: op.ownerId, bookId: op.bookId },
    }))
  )
    throw new PdfPublicationError('PDF_PUBLICATION_AUTHORITY_INVALID');
  return { op, job, attempt };
}
