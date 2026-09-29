import type { Prisma, PdfArtifact } from '@prisma/client';
import { titleFromFilename } from '../../../shared/blob-utils';
import { addBookToUserLibraryTx } from '../../membership/add-book-to-user-library';
import { PDF_IMPORT_PROFILE } from '../admission/profile';
import type { PdfInspection } from '../admission/inspect-pdf';

export async function createOwnedPdfImport(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    artifact: PdfArtifact;
    filename: string;
    inspection: PdfInspection;
    idempotencyKey: string;
    sourceSha256: string;
    requestSha256: string;
    configSha256: string;
  },
  operationId?: string,
) {
  const book = await tx.book.create({
    data: {
      pdfImportPrivate: true,
      title: titleFromFilename(input.filename),
      estimatedPageCount: input.inspection.page_count,
      files: {
        create: {
          blobId: input.artifact.blobId,
          kind: 'SOURCE',
          format: 'PDF',
          isPrimary: true,
          processingStatus: 'READY',
        },
      },
    },
  });
  const item = await addBookToUserLibraryTx(tx, {
    bookId: book.id,
    source: 'IMPORTED',
    userId: input.userId,
  });
  const operation = await tx.pdfImportOperation.create({
    data: {
      ...(operationId ? { id: operationId } : {}),
      ownerId: input.userId,
      idempotencyKey: input.idempotencyKey,
      requestSha256: input.requestSha256,
      sourceSha256: input.sourceSha256,
      configSha256: input.configSha256,
      configuration: PDF_IMPORT_PROFILE,
      profileId: PDF_IMPORT_PROFILE.profileId,
      bookId: book.id,
      libraryItemId: item.libraryItemId,
      sourceArtifactId: input.artifact.id,
      metadataClaims: {
        create: Object.entries(input.inspection.metadata).map(
          ([field, value]) => ({
            field,
            value,
            origin: 'pdf_metadata',
            sourceSha256: input.sourceSha256,
            evidence: {
              source: 'document-info',
              sourceSha256: input.sourceSha256,
            },
            observedVersion: 0,
          }),
        ),
      },
    },
  });
  await tx.pdfArtifact.update({
    where: { id: input.artifact.id },
    data: {
      operationId: operation.id,
      retention: 'OPERATION',
      expiresAt: null,
    },
  });
  return operation;
}
