import type { CanonicalEpubImport } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ReaderPackageV3 } from '../../pdf-conversion/contracts/generated/ava-reader-3';
import {
  jobTransaction,
  lockLibraryItem,
} from '../pdf-import/jobs/transaction';
import { requireReaderQualification } from '../pdf-import/publication/qualification';
import { CANONICAL_EPUB_PIPELINE } from './enqueue';
export async function activateImportedRecord(
  prisma: PrismaService,
  record: CanonicalEpubImport,
  reader: ReaderPackageV3,
  qualificationId: string,
) {
  return jobTransaction(prisma, async (tx) => {
    await lockLibraryItem(tx, record.libraryItemId);
    if (
      !(await tx.libraryItem.findFirst({
        where: {
          id: record.libraryItemId,
          userId: record.ownerId,
          bookId: record.bookId,
        },
      }))
    )
      return false;
    const current = await tx.canonicalEpubImport.findUniqueOrThrow({
      where: { id: record.id },
      include: { acceptance: true },
    });
    if (current.acceptance) return false;
    if (
      current.readerSha256 !== record.readerSha256 ||
      current.finalContentId !== reader.final_content_id ||
      current.canonicalDigest !== reader.canonical_sha256
    )
      throw new Error('EPUB_IMPORT_CONTENT_CHANGED');
    await requireReaderQualification(
      tx,
      qualificationId,
      reader.required_capabilities,
    );
    const completed = await tx.bookProcessingRun.updateMany({
      where: {
        bookId: record.bookId,
        sourceFileId: record.sourceFileId,
        canonicalContentId: record.finalContentId,
        canonicalOwnerId: record.ownerId,
        canonicalLibraryItemId: record.libraryItemId,
        pipeline: CANONICAL_EPUB_PIPELINE,
        status: 'PROCESSING',
        outputFileId: record.readerFileId,
        leaseExpiresAt: null,
        leaseTokenHash: null,
      },
      data: { status: 'READY', completedAt: new Date(), errorMessage: null },
    });
    if (completed.count !== 1)
      throw new Error('EPUB_IMPORT_ACTIVATION_CONFLICT');
    await tx.canonicalEpubAcceptance.create({
      data: { importId: record.id, qualificationId },
    });
    await tx.bookFile.update({
      where: { id: record.readerFileId },
      data: { isPrimary: true, processingStatus: 'READY' },
    });
    return true;
  });
}
