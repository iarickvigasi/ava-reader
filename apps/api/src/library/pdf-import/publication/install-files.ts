import type { PdfCandidateValidation } from '@prisma/client';
import type { Tx } from '../jobs/types';
import type { candidateAuthority } from './candidate-authority';
export async function installPublishedFiles(
  tx: Tx,
  scope: Awaited<ReturnType<typeof candidateAuthority>>,
  v: PdfCandidateValidation,
) {
  const files = await tx.pdfArtifact.findMany({
    where: { id: { in: [v.epubArtifactId, v.readerArtifactId] } },
  });
  await tx.bookFile.updateMany({
    where: { bookId: scope.op.bookId, isPrimary: true },
    data: { isPrimary: false },
  });
  for (const a of files)
    await tx.bookFile.create({
      data: {
        bookId: scope.op.bookId,
        blobId: a.blobId,
        kind: a.role === 'DERIVED_EPUB' ? 'SOURCE' : 'DERIVED_READER',
        format: a.role === 'DERIVED_EPUB' ? 'EPUB' : 'READER_PACKAGE',
        processingStatus: 'READY',
        isPrimary: a.role === 'DERIVED_EPUB',
      },
    });
  await tx.pdfConversionJob.update({
    where: { id: scope.job.id },
    data: { state: 'SUCCEEDED', waitReason: null },
  });
  await tx.pdfImportOperation.update({
    where: { id: scope.op.id },
    data: {
      status: 'READY',
      stage: 'COMPLETE',
      finalContentId: v.finalContentId,
      notificationPendingAt: new Date(),
    },
  });
  await tx.pdfNotificationIntent.create({
    data: {
      operationId: scope.op.id,
      kind: 'pdf_import_ready',
      failureId: null,
    },
  });
}
