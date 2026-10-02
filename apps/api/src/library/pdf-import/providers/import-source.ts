import type { PdfImportOperation } from '@prisma/client';
import type { Tx } from '../jobs/types';
import { PdfProviderError } from './errors';
export async function requireOwnedImportSource(tx: Tx, op: PdfImportOperation) {
  const source = await tx.pdfArtifact.findFirst({
    where: {
      id: op.sourceArtifactId,
      operationId: op.id,
      ownerId: op.ownerId,
      checksum: op.sourceSha256,
      role: 'SOURCE_PDF',
    },
  });
  const item = await tx.libraryItem.findFirst({
    where: {
      id: op.libraryItemId,
      userId: op.ownerId,
      bookId: op.bookId,
    },
  });
  if (
    !source ||
    !item ||
    op.deletedAt ||
    op.status !== 'QUEUED' ||
    op.finalContentId ||
    op.generation !== 1
  )
    throw new PdfProviderError('PDF_PROVIDER_IMPORT_UNAUTHORIZED');
}
